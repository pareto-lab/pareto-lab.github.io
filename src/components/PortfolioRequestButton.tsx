import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trackFormInteraction, trackLeadGeneration } from "@/utils/analytics";
import { createInquiry } from "@/lib/publicForms";

interface PortfolioRequest {
  name: string;
  contactType: "phone" | "email";
  contactValue: string;
  city: string;
  district: string;
  privacyConsent: boolean;
  submittedAt: string;
}

const PortfolioRequestButton = ({ customTrigger }: { customTrigger?: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<"phone" | "email">("phone");
  const [contactValue, setContactValue] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (window.location.href.includes("request=portfolio")) {
      const timer = setTimeout(() => {
        setOpen(true);
        trackFormInteraction("portfolio_request", "form_opened_via_url");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const resetForm = () => {
    setName("");
    setContactType("phone");
    setContactValue("");
    setCity("");
    setDistrict("");
    setPrivacyConsent(false);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!contactValue.trim()) {
      toast({ title: "연락처를 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!city.trim() || !district.trim()) {
      toast({ title: "주택 위치를 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!privacyConsent) {
      toast({ title: "개인정보 수집에 동의해주세요.", variant: "destructive" });
      return;
    }

    const request: PortfolioRequest = {
      name: name.trim(),
      contactType,
      contactValue: contactValue.trim(),
      city: city.trim(),
      district: district.trim(),
      privacyConsent: true,
      submittedAt: new Date().toISOString(),
    };

    setIsSubmitting(true);

    try {
      await createInquiry({
        type: "portfolio_request",
        name: request.name,
        contact_type: request.contactType,
        contact_value: request.contactValue,
        city: request.city,
        district: request.district,
        privacy_consent: true,
      });
      setSubmitted(true);
      trackLeadGeneration("portfolio", "submit_portfolio_request");
    } catch {
      toast({
        title: "전송에 실패했습니다.",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (value && !open) {
      trackFormInteraction("portfolio_request", "form_opened");
    }
    setOpen(value);
    if (!value) {
      setTimeout(resetForm, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {customTrigger || (
          <Button
            className="fixed bottom-6 right-10 z-50 rounded-full shadow-lg gap-2 px-5 h-12"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">우리 집 포트폴리오 의뢰</span>
            <span className="sm:hidden">포트폴리오 의뢰</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md w-[95vw] sm:w-full">
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-8"
            >
              <CheckCircle className="h-16 w-16 text-primary" />
              <h3 className="font-serif text-xl font-semibold">접수 완료!</h3>
              <p className="text-center text-muted-foreground">
                포트폴리오 작성 의뢰가 접수되었습니다.<br />
                빠른 시일 내에 연락드리겠습니다.
              </p>
              <Button onClick={() => handleOpenChange(false)} className="mt-2">
                닫기
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">
                  우리 집 포트폴리오 작성 의뢰
                </DialogTitle>
                <DialogDescription>
                  아래 정보를 입력하시면, 확인 후 진행 방식에 대해 연락드립니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                {/* 이름 */}
                <div className="space-y-2">
                  <Label htmlFor="req-name">이름</Label>
                  <Input
                    id="req-name"
                    placeholder="홍길동"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => trackFormInteraction("portfolio_request", "focus_name")}
                  />
                </div>

                {/* 연락처 */}
                <div className="space-y-2">
                  <Label>연락처</Label>
                  <div className="flex gap-2">
                    <Select
                      value={contactType}
                      onValueChange={(v) => setContactType(v as "phone" | "email")}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">전화번호</SelectItem>
                        <SelectItem value="email">이메일</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder={contactType === "phone" ? "010-0000-0000" : "email@example.com"}
                      value={contactValue}
                      onChange={(e) => setContactValue(e.target.value)}
                      onFocus={() => trackFormInteraction("portfolio_request", "focus_contact")}
                      type={contactType === "email" ? "email" : "tel"}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 주택 위치 */}
                <div className="space-y-2">
                  <Label>우리 집 위치</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="시 (예: 서울시)"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onFocus={() => trackFormInteraction("portfolio_request", "focus_city")}
                      className="flex-1"
                    />
                    <Input
                      placeholder="구 (예: 강남구)"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      onFocus={() => trackFormInteraction("portfolio_request", "focus_district")}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* 개인정보 동의 */}
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <Checkbox
                    id="privacy-consent"
                    checked={privacyConsent}
                    onCheckedChange={(checked) => setPrivacyConsent(checked === true)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor="privacy-consent"
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    포트폴리오 작성을 위해 위 개인정보(이름, 연락처, 주소)를 수집·이용하는 것에 동의합니다. 수집된 정보는 의뢰 목적으로만 사용됩니다.
                  </label>
                </div>

                <Button onClick={handleSubmit} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "전송 중..." : "의뢰 제출하기"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default PortfolioRequestButton;
