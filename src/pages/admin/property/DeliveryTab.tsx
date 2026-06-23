import { useState, useEffect, useRef } from "react";
import { Copy, Loader2, FileDown, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGenerateDeliveryLink } from "@/hooks/useAdminProperties";
import type { AdminPropertyTabProps } from "../AdminPropertyEdit";

type PdfStatus = "idle" | "none" | "pending" | "ready" | "failed";

const DeliveryTab = ({ property }: AdminPropertyTabProps) => {
  const [birthdate, setBirthdate] = useState(property.delivery_birthdate ?? "");
  const generateMut = useGenerateDeliveryLink(property.id);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const deliveryUrl = property.delivery_token
    ? new URL(`/properties/${property.id}/delivery?token=${property.delivery_token}`, window.location.origin).toString()
    : null;

  const pdfParams = property.delivery_token && property.delivery_birthdate
    ? `token=${encodeURIComponent(property.delivery_token)}&birthdate=${encodeURIComponent(property.delivery_birthdate)}`
    : null;
  const pdfDownloadUrl = pdfParams
    ? `/api/v1/properties/${property.id}/print-pdf/download?${pdfParams}`
    : null;

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const startPdfPolling = () => {
    stopPolling();
    if (!pdfParams) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/properties/${property.id}/print-pdf/status?${pdfParams}`);
        if (!res.ok) return;
        const data: { status: string } = await res.json();
        if (data.status !== "pending") {
          setPdfStatus(data.status as PdfStatus);
          stopPolling();
        }
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);
  };

  useEffect(() => {
    if (!pdfParams) {
      setPdfStatus("idle");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/properties/${property.id}/print-pdf/status?${pdfParams}`);
        if (!res.ok || cancelled) return;
        const data: { status: string } = await res.json();
        if (cancelled) return;
        setPdfStatus(data.status as PdfStatus);
        if (data.status === "pending") startPdfPolling();
      } catch {
        // ignore — user can still click generate
      }
    })();
    return () => { cancelled = true; };
  }, [pdfParams, property.id]);

  const handleGeneratePdf = async () => {
    if (!pdfParams) return;
    setPdfStatus("pending");
    try {
      const res = await fetch(`/api/v1/properties/${property.id}/print-pdf?${pdfParams}`, { method: "POST" });
      if (!res.ok) { setPdfStatus("failed"); return; }
      const data: { status: string } = await res.json();
      if (data.status === "ready") {
        setPdfStatus("ready");
      } else if (data.status === "failed") {
        setPdfStatus("failed");
      } else {
        startPdfPolling();
      }
    } catch {
      setPdfStatus("failed");
    }
  };

  const onGenerate = async () => {
    if (birthdate.length !== 8) return;
    try {
      await generateMut.mutateAsync(birthdate);
      toast.success("납품 링크가 생성됐습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "링크 생성 실패");
    }
  };

  const onCopy = async () => {
    if (!deliveryUrl) return;
    try {
      await navigator.clipboard.writeText(deliveryUrl);
      toast.success("납품 링크를 클립보드에 복사했습니다.");
    } catch {
      toast.error("복사 실패 — 직접 선택해서 복사해주세요.");
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {deliveryUrl && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">납품 링크</p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={deliveryUrl}
              className="text-xs text-muted-foreground font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button size="icon" variant="outline" onClick={onCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">고객에게 이 링크를 전달하세요.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">본인 확인용 생년월일</p>
        <Input
          placeholder="19800101"
          maxLength={8}
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value.replace(/\D/g, ""))}
        />
        <p className="text-xs text-muted-foreground">
          고객이 납품 링크 접속 시 입력할 생년월일 8자리입니다.
        </p>
      </div>

      <Button
        onClick={onGenerate}
        disabled={birthdate.length !== 8 || generateMut.isPending}
      >
        {generateMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {deliveryUrl ? "링크 재생성" : "납품 링크 생성하기"}
      </Button>

      {pdfParams && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm font-medium">소개서 PDF</p>

          {pdfStatus === "idle" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              상태 확인 중…
            </div>
          )}

          {pdfStatus === "ready" && pdfDownloadUrl && (
            <>
              <p className="text-xs text-muted-foreground">
                소개서 PDF가 이미 생성되어 있습니다.
              </p>
              <div className="flex items-center gap-3">
                <Button variant="outline" disabled>
                  <FileDown className="w-4 h-4 mr-2" />PDF 생성
                </Button>
                <a href={pdfDownloadUrl} download className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <CheckCircle2 className="w-4 h-4" />
                  다운로드
                </a>
              </div>
            </>
          )}

          {(pdfStatus === "none" || pdfStatus === "pending" || pdfStatus === "failed") && (
            <>
              <p className="text-xs text-muted-foreground">
                수정 후 고객이 받기 전에 미리 PDF를 생성해둘 수 있습니다.
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleGeneratePdf}
                  disabled={pdfStatus === "pending"}
                >
                  {pdfStatus === "pending"
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />생성 중…</>
                    : <><FileDown className="w-4 h-4 mr-2" />PDF 생성</>}
                </Button>
                {pdfStatus === "failed" && (
                  <span className="flex items-center gap-1.5 text-sm text-destructive">
                    <XCircle className="w-4 h-4" />
                    생성 실패 — 다시 시도해주세요.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DeliveryTab;
