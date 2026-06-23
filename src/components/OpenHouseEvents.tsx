import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { Property } from "@/data/properties";
import { trackSectionView, trackCTAClick, trackLeadGeneration, trackFormInteraction } from "@/utils/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, Users, CheckCircle2, Bell } from "lucide-react";
import { toast } from "sonner";
import {
  createOpenHouseInquiry,
  createOpenHouseReservation,
} from "@/lib/publicForms";

interface OpenHouseEventsProps {
  property: Property;
}

const OpenHouseEvents = ({ property }: OpenHouseEventsProps) => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 });
  
  useEffect(() => {
    if (inView && property?.id) trackSectionView("open_house_events", property.id);
  }, [inView, property?.id]);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 알림 신청 폼
  const [notifyData, setNotifyData] = useState({ name: "", email: "" });
  const [notifyConsent, setNotifyConsent] = useState(false);
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const [notifySubmitting, setNotifySubmitting] = useState(false);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = year && month && day ? new Date(year, month - 1, day) : new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const events = property.openHouseEvents ?? [];

  const handleSubmit = async (e: React.FormEvent, eventId: string) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("성함을 입력해주세요."); return; }
    if (!formData.email.trim()) { toast.error("이메일 주소를 입력해주세요."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast.error("올바른 이메일 주소를 입력해주세요.");
      return;
    }
    if (!formData.phone.trim()) { toast.error("연락처를 입력해주세요."); return; }
    if (!privacyConsent) {
      toast.error("개인정보 수집에 동의해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createOpenHouseReservation(eventId, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        privacy_consent: true,
      });
      trackLeadGeneration("open_house_rsvp", "submit_reservation", property.id);
      setIsSubmitted(true);
      toast.success("예약이 접수되었습니다. 확인 후 연락드리겠습니다.");
      setTimeout(() => {
        setIsSubmitted(false);
        setSelectedEventId(null);
        setFormData({ name: "", email: "", phone: "" });
        setPrivacyConsent(false);
      }, 3000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "예약에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyData.name.trim()) { toast.error("성함을 입력해주세요."); return; }
    if (!notifyData.email.trim()) { toast.error("이메일 주소를 입력해주세요."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyData.email.trim())) {
      toast.error("올바른 이메일 주소를 입력해주세요.");
      return;
    }
    if (!notifyConsent) { toast.error("개인정보 수집에 동의해주세요."); return; }
    setNotifySubmitting(true);
    try {
      await createOpenHouseInquiry({
        property_id: property.id,
        name: notifyData.name.trim(),
        email: notifyData.email.trim(),
        privacy_consent: true,
      });
      trackLeadGeneration("open_house_notify", "notify_signup", property.id);
      setNotifySubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setNotifySubmitting(false);
    }
  };

  /** 다음 일정 안내 받기 폼 (공용) */
  const renderNotifyForm = (idSuffix: string) => (
    notifySubmitted ? (
      <div className="py-6 text-center">
        <CheckCircle2 className="w-8 h-8 text-accent mx-auto mb-2" />
        <p className="font-serif text-base text-card-foreground">신청이 완료되었습니다!</p>
        <p className="text-sm text-muted-foreground mt-1">일정 확정 시 안내 드리겠습니다.</p>
      </div>
    ) : (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-card-foreground">다음 일정 안내 받기</span>
        </div>
        <form onSubmit={handleNotifySubmit} noValidate className="space-y-3">
          <Input
            placeholder="성함"
            value={notifyData.name}
            onChange={(e) => setNotifyData({ ...notifyData, name: e.target.value })}
          />
          <Input
            type="email"
            placeholder="이메일 주소"
            value={notifyData.email}
            onChange={(e) => setNotifyData({ ...notifyData, email: e.target.value })}
          />
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <Checkbox
              id={`privacy-notify-${idSuffix}`}
              checked={notifyConsent}
              onCheckedChange={(c) => setNotifyConsent(c === true)}
              className="mt-0.5"
            />
            <label htmlFor={`privacy-notify-${idSuffix}`} className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              오픈하우스 일정 안내를 위해 개인정보(이름, 이메일)를 수집·이용하는 것에 동의합니다.
            </label>
          </div>
          <Button type="submit" className="w-full" disabled={notifySubmitting}>
            <Bell className="w-4 h-4 mr-2" />
            {notifySubmitting ? "신청 중..." : "다음 일정 안내 받기"}
          </Button>
        </form>
      </div>
    )
  );

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="bg-card rounded-sm p-8 border border-border"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-accent/20 rounded-sm flex items-center justify-center">
          <Calendar className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="font-serif text-xl font-medium text-card-foreground">
            오픈하우스 일정
          </h3>
          <p className="text-sm text-muted-foreground">
            직접 방문하여 집을 경험해보세요
          </p>
        </div>
      </div>

      {events.length === 0 ? (
        /* ── 일정 없음: 안내 신청 폼만 표시 ── */
        renderNotifyForm("no-events")
      ) : (
        /* ── 일정 있음: 이벤트 목록 + 구분선 + 안내 신청 폼 ── */
        <div className="space-y-4">
          {events.map((ev) => {
            const evHasCapacity = (ev.capacity ?? 0) > 0;
            const evIsFull = evHasCapacity && (ev.availableSpots ?? 0) <= 0;
            const isSelected = selectedEventId === ev.id;

            return (
              <div key={ev.id}>
                <button
                  onClick={() => {
                    const next = isSelected ? null : ev.id;
                    setSelectedEventId(next);
                    if (next) trackCTAClick("select_open_house_event", "open_house_events", property.id);
                  }}
                  disabled={evIsFull}
                  className={`w-full p-4 rounded-sm border transition-all text-left ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 bg-secondary/30 disabled:cursor-not-allowed disabled:opacity-60"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:flex-col xl:flex-row">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium text-card-foreground break-keep">
                          {formatDate(ev.date)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          {ev.time}
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          {evHasCapacity ? `${ev.availableSpots}자리 남음` : "정원 미정"}
                        </span>
                      </div>
                    </div>
                    <div className="self-end whitespace-nowrap text-sm font-medium text-primary sm:self-start sm:mt-0.5 lg:self-end xl:self-start">
                      {evIsFull ? "마감" : isSelected ? "닫기" : "예약하기"}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      {isSubmitted ? (
                        <div className="p-6 text-center">
                          <CheckCircle2 className="w-12 h-12 text-accent mx-auto mb-3" />
                          <p className="font-serif text-lg text-card-foreground">예약이 완료되었습니다!</p>
                          <p className="text-sm text-muted-foreground">확인 후 연락드리겠습니다.</p>
                        </div>
                      ) : (
                        <form onSubmit={(e) => handleSubmit(e, ev.id!)} noValidate className="p-4 space-y-4">
                          <Input
                            placeholder="성함"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            onFocus={() => trackFormInteraction("open_house_rsvp", "focus_name", property.id)}
                          />
                          <Input
                            type="email"
                            placeholder="이메일 주소"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            onFocus={() => trackFormInteraction("open_house_rsvp", "focus_email", property.id)}
                          />
                          <Input
                            type="tel"
                            placeholder="연락처"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            onFocus={() => trackFormInteraction("open_house_rsvp", "focus_phone", property.id)}
                          />
                          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                            <Checkbox
                              id={`privacy-oh-${ev.id}`}
                              checked={privacyConsent}
                              onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                              className="mt-0.5"
                            />
                            <label
                              htmlFor={`privacy-oh-${ev.id}`}
                              className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                            >
                              오픈하우스 예약을 위해 개인정보(이름, 연락처, 이메일)를 수집·이용하는 것에 동의합니다.
                            </label>
                          </div>
                          <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? "예약 중..." : "방문 예약하기"}
                          </Button>
                        </form>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          {/* 구분선 + 다음 일정 안내 받기 */}
          <div className="pt-4 border-t border-border">
            {renderNotifyForm("with-events")}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default OpenHouseEvents;
