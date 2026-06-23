import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { buildCardCanvas, buildLifestyleCanvas, canvasToBlob } from "@/lib/buildCardCanvas";
import type { UploadMode } from "@/lib/buildCardCanvas";
import { adaptProperty } from "@/lib/propertyAdapter";
import {
  FileText, ImageDown, BookOpen, Download,
  Loader2, CheckCircle2, Copy, Check, ExternalLink, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { createInquiry } from "@/lib/publicForms";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { Property } from "@/data/properties";
import type { Property as ApiProperty } from "@/types/property";

// localStorage key stores only birthdate per property
const LS_KEY = (propertyId: string) => `houseinus__delivery__${propertyId}`;

// ── DeliveryButton ────────────────────────────────────────────────────────────

const DeliveryButton = ({
  icon: Icon, label, description, onClick, loading, disabled,
}: {
  icon: React.ElementType; label: string; description: string;
  onClick: () => void; loading?: boolean; disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className="w-full flex items-center gap-4 px-5 py-4 rounded-sm border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
  >
    <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center flex-shrink-0">
      {loading
        ? <Loader2 className="w-5 h-5 text-primary animate-spin" />
        : <Icon className="w-5 h-5 text-primary" />}
    </div>
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  </button>
);

// ── DeliveryQuestion ──────────────────────────────────────────────────────────

const DeliveryQuestion = ({ propertyId }: { propertyId: string }) => {
  const [question, setQuestion] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitting(true);
    try {
      await createInquiry({
        type: "delivery_question",
        property_id: propertyId,
        question: question.trim(),
        contact_value: contact.trim() || null,
        privacy_consent: true,
      });
      setSubmitted(true);
      toast.success("문의가 접수되었습니다!");
    } catch {
      toast.error("전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-sm border border-border bg-card p-5 space-y-4">
      <p className="text-muted-foreground text-center" style={{ fontSize: "clamp(11px, 3.5vw, 14px)" }}>
        자료 확인 중 불편한 점이 있으시면 편하게 말씀 주세요.
      </p>
      {submitted ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          문의가 접수되었습니다. 빠르게 확인하겠습니다.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="궁금한 점을 입력해주세요"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="resize-none text-sm"
          />
          <Input
            placeholder="연락처 (선택)"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="text-sm"
          />
          <Button type="submit" className="w-full" disabled={!question.trim() || submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            보내기
          </Button>
        </form>
      )}
    </div>
  );
};

// ── AuthScreen ────────────────────────────────────────────────────────────────

const AuthScreen = ({
  propertyId,
  token,
  onVerified,
}: {
  propertyId: string;
  token: string;
  onVerified: (property: Property, birthdate: string) => void;
}) => {
  const [birthdate, setBirthdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (birthdate.length !== 8) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}?token=${encodeURIComponent(token)}&birthdate=${encodeURIComponent(birthdate)}`,
      );
      if (!res.ok) { setError(true); return; }
      const data: ApiProperty = await res.json();
      localStorage.setItem(LS_KEY(propertyId), birthdate);
      onVerified(adaptProperty(data), birthdate);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background min-h-screen px-6 pt-16 pb-10 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground tracking-widest uppercase">House in Us</p>
          <h1 className="font-serif text-2xl font-medium text-foreground">집 소개 자료</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              자료 확인을 위해 생년월일 8자리를 입력해주세요.
            </p>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="예: 19800101"
              maxLength={8}
              value={birthdate}
              onChange={(e) => { setBirthdate(e.target.value.replace(/\D/g, "")); setError(false); }}
              className={`text-center tracking-widest text-lg ${error ? "border-destructive" : ""}`}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive text-center">
                입력하신 정보가 일치하지 않습니다. 다시 확인해주세요.
              </p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={birthdate.length !== 8 || loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            확인하기
          </Button>
        </form>
      </div>
    </div>
  );
};

// ── DeliveryContent ───────────────────────────────────────────────────────────

const DeliveryContent = ({
  property: initialProperty,
  propertyId,
  token,
  birthdate,
}: {
  property: Property;
  propertyId: string;
  token: string;
  birthdate: string;
}) => {
  const navigate = useNavigate();
  const [property, setProperty] = useState(initialProperty);
  const [published, setPublished] = useState(initialProperty.status === "on");
  // null = not yet decided; true = show content; false = show publish prompt
  const [showContent, setShowContent] = useState<boolean | null>(
    initialProperty.status === "on" ? true : null,
  );
  const [publishing, setPublishing] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [photoLoading, setPhotoLoading] = useState<UploadMode | null>(null);
  const [copied, setCopied] = useState(false);
  const [photoConfirm, setPhotoConfirm] = useState<UploadMode | null>(null);
  const [photoCount, setPhotoCount] = useState(
    (initialProperty.interiorPhotos?.length ?? 0) + (initialProperty.lifestyleScenarios?.length ?? 0),
  );

  // Print PDF state
  type PdfStatus = "idle" | "pending" | "ready" | "failed";
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const printPdfParams = `token=${encodeURIComponent(token)}&birthdate=${encodeURIComponent(birthdate)}`;
  const pdfDownloadUrl = `/api/v1/properties/${propertyId}/print-pdf/download?${printPdfParams}`;

  const startPdfPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/v1/properties/${propertyId}/print-pdf/status?${printPdfParams}`,
        );
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

  const handlePdf = async () => {
    setPdfDialogOpen(true);
    setPdfStatus("pending");
    try {
      const res = await fetch(
        `/api/v1/properties/${propertyId}/print-pdf?${printPdfParams}`,
        { method: "POST" },
      );
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

  const propertyUrl = `${window.location.origin}/properties/${property.slug ?? property.id}`;

  const handlePublish = async () => {
    if (published) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/properties/${propertyId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, birthdate }),
      });
      if (!res.ok) throw new Error("publish failed");
      const data: ApiProperty = await res.json();
      const adapted = adaptProperty(data);
      setProperty(adapted);
      setPublished(true);
      setPhotoCount((adapted.interiorPhotos?.length ?? 0) + (adapted.lifestyleScenarios?.length ?? 0));
      setShowContent(true);
      toast.success("게시되었습니다!");
    } catch {
      toast.error("게시에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setPublishing(false);
    }
  };

  const requestPhotos = (mode: UploadMode) => {
    if (photoLoading) return;
    setPhotoConfirm(mode);
  };

  const handlePhotos = async (mode: UploadMode) => {
    setPhotoLoading(mode);
    const base = property.slug ?? property.id;
    const download = (blob: Blob, name: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    };
    try {
      const interiorPhotos = property.interiorPhotos ?? [];
      const lifestyleScenarios = property.lifestyleScenarios ?? [];

      for (let i = 0; i < interiorPhotos.length; i++) {
        const photo = interiorPhotos[i];
        const floorplan = property.floorplans?.[String(photo.floor)];
        const canvas = await buildCardCanvas(photo, floorplan, mode);
        download(await canvasToBlob(canvas), `${base}_${mode}_${String(i + 1).padStart(2, "0")}.jpg`);
      }

      for (let i = 0; i < lifestyleScenarios.length; i++) {
        const canvas = await buildLifestyleCanvas(lifestyleScenarios[i], i + 1, mode);
        download(await canvasToBlob(canvas), `${base}_${mode}_일상_${String(i + 1).padStart(2, "0")}.jpg`);
      }
    } catch {
      toast.error("이미지 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setPhotoLoading(null);
    }
  };

  const handleCopyLink = () => {
    if (!propertyUrl) return;
    navigator.clipboard.writeText(propertyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Publish prompt (draft, not yet decided) ────────────────────────────────

  if (showContent === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {property.image && (
          <div className="w-full aspect-[4/3] md:aspect-auto md:h-[45vh] bg-muted overflow-hidden">
            <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 px-6 py-8 space-y-6 max-w-lg mx-auto w-full">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground tracking-widest uppercase">하우스인어스 집 소개 자료</p>
            <h1 className="font-serif text-xl font-medium text-foreground leading-snug">{property.title}</h1>
          </div>
          <div className="space-y-3 pt-2">
            <a
              href={`/properties/${property.id}?token=${encodeURIComponent(token)}`}
              className="flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              게시글 미리보기
            </a>
            <label className="flex items-start gap-3 rounded-sm border border-border bg-muted/30 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5 flex-shrink-0 accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                본인은 해당 주택의 소유자 또는 적법한 게시 권한자이며, 본 게시글의 공개를 요청합니다.<br />
                본 게시글은 소유자가 직접 게시하는 주택 소개 자료이며, 하우스인어스는 중개, 알선, 가격 협상, 계약서 작성, 권리관계 검토, 법률 자문을 수행하지 않습니다.<br />
                게시글의 가격, 면적, 권리관계, 시설 상태 등 사실관계는 본인이 확인한 내용이며, 변경 사항이 생기면 직접 수정 또는 비공개 요청을 해야 합니다.
              </span>
            </label>
            <Button
              className="w-full"
              onClick={handlePublish}
              disabled={publishing || !disclaimerChecked}
            >
              {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              게시하기
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowContent(true)}>
              나중에 게시하기 →
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main delivery content ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {property.image && (
        <div className="w-full aspect-[4/3] md:aspect-auto md:h-[45vh] bg-muted overflow-hidden">
          <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex-1 px-6 py-8 space-y-8 max-w-lg mx-auto w-full">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground tracking-widest uppercase">하우스인어스 집 소개 자료</p>
          <h1 className="font-serif text-xl font-medium text-foreground leading-snug">{property.title}</h1>
          <p className="text-sm text-muted-foreground">아래에서 최종 소개서와 사진 자료를 확인하실 수 있습니다.</p>
        </div>

        {/* Download buttons */}
        <div className="space-y-3">
          <DeliveryButton
            icon={FileText}
            label="소개서 PDF 다운로드"
            description="최종 소개서를 다운로드합니다"
            onClick={handlePdf}
          />
          <DeliveryButton
            icon={ImageDown}
            label="사진 다운로드 1 — 피터팬 / 네이버"
            description={photoLoading === "peterpan" ? "이미지 생성 중입니다…" : "피터팬·네이버 업로드용 이미지"}
            onClick={() => requestPhotos("peterpan")}
            loading={photoLoading === "peterpan"}
            disabled={photoLoading === "peterpan"}
          />
          <DeliveryButton
            icon={ImageDown}
            label="사진 다운로드 2 — 당근"
            description={photoLoading === "daangn" ? "이미지 생성 중입니다…" : "당근마켓 업로드용 이미지"}
            onClick={() => requestPhotos("daangn")}
            loading={photoLoading === "daangn"}
            disabled={photoLoading === "daangn"}
          />
          <DeliveryButton
            icon={BookOpen}
            label="자료 활용 가이드 보기"
            description="자료를 어떻게 활용하면 좋을지 확인합니다"
            onClick={() => { navigate("/guide/delivery"); window.scrollTo(0, 0); }}
          />
        </div>

        {/* 내 게시글 링크 */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">내 게시글 링크</p>
          {published && propertyUrl ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-sm border border-border px-3 py-2.5 text-sm text-muted-foreground truncate">
                {propertyUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-sm border border-border bg-card hover:bg-muted/50 transition-colors text-sm text-muted-foreground whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-sm border border-border px-4 py-3">
              게시하기 버튼을 누르면 게시글의 링크를 복사할 수 있어요.
            </p>
          )}
          {!published && !disclaimerChecked && (
            <label className="flex items-start gap-3 rounded-sm border border-border bg-muted/30 px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5 flex-shrink-0 accent-primary"
              />
              <span className="text-xs text-muted-foreground leading-relaxed">
                본인은 해당 주택의 소유자 또는 적법한 게시 권한자이며, 본 게시글의 공개를 요청합니다.<br />
                본 게시글은 소유자가 직접 게시하는 주택 소개 자료이며, 하우스인어스는 중개, 알선, 가격 협상, 계약서 작성, 권리관계 검토, 법률 자문을 수행하지 않습니다.<br />
                게시글의 가격, 면적, 권리관계, 시설 상태 등 사실관계는 본인이 확인한 내용이며, 변경 사항이 생기면 직접 수정 또는 비공개 요청을 해야 합니다.
              </span>
            </label>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={handlePublish}
            disabled={published || publishing || !disclaimerChecked}
          >
            {publishing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {published ? "게시 완료" : "게시하기"}
          </Button>
        </div>
      </div>

      <footer className="px-6 py-8 space-y-5 border-t border-border max-w-lg mx-auto w-full">
        <DeliveryQuestion propertyId={propertyId} />
        <div className="text-center space-y-1 pt-2">
          <p className="text-sm font-serif font-medium text-foreground">House in Us</p>
          <p className="text-xs text-muted-foreground">by ParetoLab</p>
        </div>
      </footer>

      {/* PDF generation dialog */}
      <Dialog
        open={pdfDialogOpen}
        onOpenChange={(open) => {
          if (!open) { stopPolling(); setPdfDialogOpen(false); setPdfStatus("idle"); }
        }}
      >
        <DialogContent className="max-w-xs text-center">
          <DialogHeader>
            <DialogTitle className="text-center">소개서 PDF</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center gap-4">
            {pdfStatus === "pending" && (
              <>
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">파일을 준비중입니다...</p>
              </>
            )}
            {pdfStatus === "ready" && (
              <>
                <CheckCircle2 className="w-8 h-8 text-primary" />
                <p className="text-sm text-foreground font-medium">파일이 준비되었습니다</p>
                <a
                  href={pdfDownloadUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  다운로드
                </a>
              </>
            )}
            {pdfStatus === "failed" && (
              <>
                <XCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-muted-foreground">
                  PDF 생성에 실패했습니다. 잠시 후 다시 시도해주세요.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={photoConfirm !== null} onOpenChange={(open) => { if (!open) setPhotoConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사진 다운로드</AlertDialogTitle>
            <AlertDialogDescription>
              {photoCount > 0
                ? `총 ${photoCount}장의 이미지를 순차적으로 다운로드합니다. 계속하시겠습니까?`
                : "이미지를 다운로드합니다. 계속하시겠습니까?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              const mode = photoConfirm!;
              setPhotoConfirm(null);
              handlePhotos(mode);
            }}>
              다운로드
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ── DeliveryPage ──────────────────────────────────────────────────────────────

const DeliveryPage = () => {
  const { property_id } = useParams<{ property_id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [verified, setVerified] = useState(false);
  const [property, setProperty] = useState<Property | null>(null);
  const [birthdate, setBirthdate] = useState("");

  useDocumentTitle(
    property ? `${property.title} | 하우스인어스` : "집 소개 자료 | 하우스인어스",
  );

  useEffect(() => {
    if (!property_id || !token) { setVerified(true); return; }

    const cached = localStorage.getItem(LS_KEY(property_id));
    if (!cached) { setVerified(true); return; }

    const bd = cached;
    setBirthdate(bd);

    fetch(`/api/v1/properties/${property_id}?token=${encodeURIComponent(token)}&birthdate=${encodeURIComponent(bd)}`)
      .then(async (res) => {
        if (res.ok) {
          const data: ApiProperty = await res.json();
          setProperty(adaptProperty(data));
        } else {
          localStorage.removeItem(LS_KEY(property_id));
        }
        setVerified(true);
      })
      .catch(() => {
        // Network error: clear state, force re-auth
        localStorage.removeItem(LS_KEY(property_id));
        setVerified(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property_id, token]);

  if (!verified) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property || !property_id) {
    return (
      <AuthScreen
        propertyId={property_id ?? ""}
        token={token}
        onVerified={(p, bd) => {
          setBirthdate(bd);
          setProperty(p);
        }}
      />
    );
  }

  return (
    <DeliveryContent
      property={property}
      propertyId={property_id}
      token={token}
      birthdate={birthdate}
    />
  );
};

export default DeliveryPage;
