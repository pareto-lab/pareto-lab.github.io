import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAdminMe, useUpdateAdminMe } from "@/hooks/useAdminMe";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminMe } from "@/types/adminMe";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const TOGGLES: Array<{
  key: keyof Pick<
    AdminMe,
    | "notify_inquiry_house"
    | "notify_inquiry_metrics"
    | "notify_inquiry_portfolio"
    | "notify_open_house_inquiry"
    | "notify_inquiry_matched_property"
    | "notify_inquiry_delivery"
    | "notify_mbti"
    | "notify_delivery_publish"
  >;
  label: string;
  hint: string;
}> = [
  {
    key: "notify_inquiry_house",
    label: "집 문의",
    hint: "새 집 문의가 등록되면 알림",
  },
  {
    key: "notify_inquiry_metrics",
    label: "지표 문의",
    hint: "새 지표 문의가 등록되면 알림",
  },
  {
    key: "notify_inquiry_portfolio",
    label: "포트폴리오 의뢰",
    hint: "새 포트폴리오 의뢰가 들어오면 알림",
  },
  {
    key: "notify_open_house_inquiry",
    label: "오픈하우스 일정 문의",
    hint: "새 오픈하우스 일정 안내 신청이 등록되면 알림",
  },
  {
    key: "notify_inquiry_matched_property",
    label: "맞춤 매물 정보 수신",
    hint: "MBTI 결과에서 맞춤 매물 정보 수신 신청이 등록되면 알림",
  },
  {
    key: "notify_inquiry_delivery",
    label: "최종 결과물 질의",
    hint: "납품 페이지에서 질문이 등록되면 알림",
  },
  {
    key: "notify_mbti",
    label: "MBTI 결과",
    hint: "주택 MBTI 결과가 새로 저장되면 알림",
  },
  {
    key: "notify_delivery_publish",
    label: "납품 페이지 자체 게시",
    hint: "납품 페이지에서 집주인이 매물을 직접 게시하면 알림",
  },
];

const AdminMyProfile = () => {
  useDocumentTitle("내 관리자 정보 | 관리자 | 하우스인어스");
  const { user } = useAuth();
  const { data, isLoading, error } = useAdminMe();
  const update = useUpdateAdminMe();

  const [telegramId, setTelegramId] = useState("");
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setTelegramId(data.telegram_user_id ?? "");
    setToggles({
      notify_inquiry_house: data.notify_inquiry_house,
      notify_inquiry_metrics: data.notify_inquiry_metrics,
      notify_inquiry_portfolio: data.notify_inquiry_portfolio,
      notify_open_house_inquiry: data.notify_open_house_inquiry,
      notify_inquiry_matched_property: data.notify_inquiry_matched_property,
      notify_inquiry_delivery: data.notify_inquiry_delivery,
      notify_mbti: data.notify_mbti,
      notify_delivery_publish: data.notify_delivery_publish,
    });
  }, [data]);

  const dirty =
    !!data &&
    (telegramId.trim() !== (data.telegram_user_id ?? "") ||
      TOGGLES.some((t) => toggles[t.key] !== data[t.key]));

  const onSave = async () => {
    try {
      await update.mutateAsync({
        telegram_user_id: telegramId.trim() || null,
        notify_inquiry_house: toggles.notify_inquiry_house,
        notify_inquiry_metrics: toggles.notify_inquiry_metrics,
        notify_inquiry_portfolio: toggles.notify_inquiry_portfolio,
        notify_open_house_inquiry: toggles.notify_open_house_inquiry,
        notify_inquiry_matched_property: toggles.notify_inquiry_matched_property,
        notify_inquiry_delivery: toggles.notify_inquiry_delivery,
        notify_mbti: toggles.notify_mbti,
        notify_delivery_publish: toggles.notify_delivery_publish,
      });
      toast.success("저장되었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-serif text-2xl md:text-3xl font-medium">
          내 관리자 정보
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          텔레그램 알림 설정과 관리자 전용 환경설정을 관리합니다.
        </p>
      </div>

      {user ? (
        <div className="rounded-sm border border-border bg-card px-4 py-3 text-sm space-y-1">
          <div className="font-medium">{user.display_name}</div>
          <div className="text-muted-foreground">{user.email}</div>
          <div className="text-xs text-muted-foreground">권한: {user.role}</div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          설정을 불러오지 못했습니다: {error instanceof Error ? error.message : ""}
        </div>
      ) : null}

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <section className="rounded-sm border border-border bg-card p-4 md:p-6 space-y-4">
            <div>
              <h2 className="font-medium">텔레그램</h2>
              <p className="text-xs text-muted-foreground mt-1">
                @userinfobot 등으로 본인 user ID를 확인 후 입력하세요. 비워두면
                알림이 발송되지 않습니다.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram-id">텔레그램 user ID</Label>
              <Input
                id="telegram-id"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="예: 123456789"
                inputMode="numeric"
              />
            </div>
          </section>

          <section className="rounded-sm border border-border bg-card p-4 md:p-6 space-y-4">
            <div>
              <h2 className="font-medium">알림 종류</h2>
              <p className="text-xs text-muted-foreground mt-1">
                새 항목이 등록되면 텔레그램으로 푸시됩니다. 종류별로 켜고 끌 수
                있어요.
              </p>
            </div>
            <div className="divide-y divide-border">
              {TOGGLES.map((t) => (
                <div
                  key={t.key}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.hint}
                    </div>
                  </div>
                  <Switch
                    checked={!!toggles[t.key]}
                    onCheckedChange={(v) =>
                      setToggles((prev) => ({ ...prev, [t.key]: v }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={!dirty || update.isPending}>
              {update.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminMyProfile;
