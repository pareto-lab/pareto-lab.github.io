import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, BarChart3, MessageCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trackLeadGeneration, trackCTAClick, trackFormInteraction } from "@/utils/analytics";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { createInquiry } from "@/lib/publicForms";
import type { InquiryType } from "@/types/inquiry";

const INQUIRY_TYPE: Record<"house" | "metrics", InquiryType> = {
  house: "house_question",
  metrics: "metrics_question",
};

interface InquiryFormData {
  question: string;
  contact: string;
}

const InquiryCard = ({
  type,
  icon: Icon,
  title,
  description,
  propertyId,
}: {
  type: keyof typeof INQUIRY_TYPE;
  icon: typeof Users;
  title: string;
  description: string;
  propertyId?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<InquiryFormData>({ question: "", contact: "" });
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpen = () => {
    if (!isOpen && propertyId) {
      trackCTAClick(`open_inquiry_${type}`, "inquiry_section", propertyId);
      trackFormInteraction(`inquiry_${type}`, "form_opened", propertyId);
    }
    setIsOpen(!isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privacyConsent) {
      toast.error("개인정보 수집에 동의해주세요.");
      return;
    }
    if (!formData.question.trim() || !formData.contact.trim()) {
      toast.error("질문과 연락처를 모두 입력해주세요.");
      return;
    }
    if (!propertyId) {
      toast.error("매물 정보를 확인할 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createInquiry({
        type: INQUIRY_TYPE[type],
        property_id: propertyId,
        question: formData.question.trim(),
        contact_value: formData.contact.trim(),
        privacy_consent: true,
      });
      if (propertyId) {
        trackLeadGeneration(`inquiry_${type}`, `submit_inquiry_${type}`, propertyId);
      }
      setIsSubmitted(true);
      toast.success("문의가 접수되었습니다!");
      setTimeout(() => {
        setIsSubmitted(false);
        setIsOpen(false);
        setFormData({ question: "", contact: "" });
        setPrivacyConsent(false);
      }, 3000);
    } catch {
      toast.error("전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-sm border border-border bg-card">
      <button
        onClick={handleOpen}
        className="flex w-full min-w-0 flex-col items-center gap-5 px-5 py-7 text-center transition-colors hover:bg-secondary/30 sm:p-8 lg:px-5 xl:p-8"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <p className="max-w-full break-words text-sm leading-relaxed text-muted-foreground">{description}</p>
        <span className="max-w-full break-words text-sm font-medium leading-relaxed text-primary">
          {isOpen ? "닫기" : title}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {isSubmitted ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-accent mx-auto mb-3" />
                <p className="font-serif text-lg text-card-foreground">접수 완료!</p>
                <p className="text-sm text-muted-foreground">확인 후 연락드리겠습니다.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-8 pt-2 pb-8 space-y-4">
                <Textarea
                  placeholder="궁금한 점을 자유롭게 작성해주세요"
                  value={formData.question}
                  onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                  onFocus={() => propertyId && trackFormInteraction(`inquiry_${type}`, "focus_question", propertyId)}
                  rows={4}
                  required
                  className="resize-none"
                />
                <Input
                  placeholder="연락처 (이메일 또는 핸드폰 번호)"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  onFocus={() => propertyId && trackFormInteraction(`inquiry_${type}`, "focus_contact", propertyId)}
                  required
                />
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <Checkbox
                    id={`privacy-inquiry-${type}`}
                    checked={privacyConsent}
                    onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`privacy-inquiry-${type}`}
                    className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    문의 답변을 위해 개인정보(연락처)를 수집·이용하는 것에 동의합니다.
                  </label>
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "전송 중..." : "문의 보내기"}
                </Button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InquirySection = ({ propertyId }: { propertyId?: string } = {}) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="py-12"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-primary" />
        </div>
        <h2 className="editorial-subheading text-primary">문의하기</h2>
      </div>
      <div className="h-px bg-border mb-8" />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <InquiryCard
          type="house"
          icon={Users}
          title="판매자에게 질문하기"
          description="집의 방문 일정, 매매 조건, 현장 확인 등 매물 관련 문의는 판매자에게 직접 남겨주세요."
          propertyId={propertyId}
        />
        <InquiryCard
          type="metrics"
          icon={BarChart3}
          title="파레토랩에 질문하기"
          description="집소개서 제작 방식, 산정 지표, 하우스인어스 서비스 관련 문의는 파레토랩이 답변드립니다."
          propertyId={propertyId}
        />
      </div>

      <div className="h-px bg-border mt-8" />
    </motion.section>
  );
};

export default InquirySection;
