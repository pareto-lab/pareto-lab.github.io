import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle, RotateCcw, ArrowRight, Lightbulb, Home, Link2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useProperties } from "@/hooks/useProperties";
import type { SurveyAnswers } from "@/pages/HousingMBTI";
import type { Property } from "@/data/properties";
import {
  createInquiry,
  createMbtiResult,
  sendMbtiResultBeacon,
} from "@/lib/publicForms";
import { propertyUrl } from "@/lib/propertyUrl";
import type { MbtiResultCreatePayload } from "@/types/mbti";

const generateParticipantId = () => {
  const existingId = localStorage.getItem("houseinearth_mbti_participant_id");
  if (existingId) return existingId;
  const newId = `user_${Math.random().toString(36).substring(2, 10)}`;
  localStorage.setItem("houseinearth_mbti_participant_id", newId);
  return newId;
};

const buildMbtiPayload = (
  email: string,
  answers: SurveyAnswers,
  participantId: string,
  source: "anonymous" | "email_save",
): MbtiResultCreatePayload => ({
  participant_id: participantId,
  email: email || null,
  email_consent: Boolean(email),
  age: answers.age,
  gender: answers.gender,
  family_type: answers.familyType,
  driving: answers.driving,
  plants: answers.plants,
  pets: answers.pets,
  camping: answers.camping,
  hobbies: answers.hobbies,
  dreams: answers.dreams,
  source,
});

interface MBTIResultProps {
  answers: SurveyAnswers;
  onReset: () => void;
}

interface Tip {
  type: "positive" | "caution";
  text: string;
}

function generateTips(answers: SurveyAnswers): Tip[] {
  const tips: Tip[] = [];

  // Family-based tips
  if (answers.familyType === "young-family" || answers.familyType === "school-family") {
    tips.push({ type: "positive", text: "학교와 유치원이 가까운 곳이 가장 중요합니다." });
    tips.push({ type: "positive", text: "아이들이 안전하게 뛰놀 수 있는 마당이 있으면 좋습니다." });
  }
  if (answers.familyType === "single" || answers.familyType === "couple") {
    tips.push({ type: "positive", text: "관리가 편한 소규모 주택이 라이프스타일에 맞습니다." });
  }

  // Driving
  if (!answers.driving) {
    tips.push({ type: "caution", text: "경사로에 있는 집은 피하세요. 차 없이 이동이 어렵습니다." });
    tips.push({ type: "positive", text: "대중교통 접근성이 좋은 지역을 추천합니다." });
  } else {
    tips.push({ type: "positive", text: "전용 주차장이 있는 매물이 적합합니다." });
  }

  // Plants
  if (!answers.plants) {
    tips.push({ type: "caution", text: "넓은 잔디마당은 관리에 시간과 노력이 많이 듭니다. 신중하게 고려하세요." });
  } else {
    tips.push({ type: "positive", text: "텃밭이나 정원이 있는 집에서 식물 생활을 확장해보세요." });
  }

  // Pets
  if (answers.pets) {
    tips.push({ type: "positive", text: "마당이 있고 산책로가 가까운 곳이 반려동물에게 좋습니다." });
    tips.push({ type: "caution", text: "층간소음이 우려되는 다세대 주택은 피하는 게 좋습니다." });
  }

  // Camping
  if (answers.camping) {
    tips.push({ type: "positive", text: "자연과 가까운 교외 지역이 캠핑 라이프와 잘 어울립니다." });
  }

  // Hobbies
  if (answers.hobbies.includes("cooking")) {
    tips.push({ type: "positive", text: "넓은 주방과 다이닝 공간이 있는 집을 추천합니다." });
  }
  if (answers.hobbies.includes("reading") || answers.hobbies.includes("art") || answers.hobbies.includes("music")) {
    tips.push({ type: "positive", text: "독립된 서재나 작업 공간이 있는 집이 좋습니다." });
  }

  // Dreams
  if (answers.dreams.includes("pool")) {
    tips.push({ type: "caution", text: "수영장은 유지 관리 비용과 노력이 상당히 필요합니다." });
  }
  if (answers.dreams.includes("yard-bbq")) {
    tips.push({ type: "positive", text: "적절한 크기의 마당과 외부 공간이 있는 집을 찾아보세요." });
  }

  return tips;
}

function scoreProperty(property: Property, answers: SurveyAnswers): number {
  let score = 0;
  const tags = property.tags || [];

  // Family match
  if ((answers.familyType === "young-family") && tags.includes("유치원")) score += 3;
  if ((answers.familyType === "school-family") && tags.includes("초등학교")) score += 3;

  // Driving
  if (answers.driving && tags.includes("전용주차장")) score += 2;
  if (answers.driving && tags.includes("강남으로 출근")) score += 2;

  // Plants & gardening
  if (answers.plants && tags.includes("잔디마당")) score += 2;
  if (answers.hobbies.includes("gardening") && tags.includes("잔디마당")) score += 1;

  // Pets & camping → nature
  if (answers.pets && tags.includes("잔디마당")) score += 1;
  if (answers.camping && tags.includes("잔디마당")) score += 1;

  // Dreams
  if (answers.dreams.includes("pool") && tags.includes("수영장")) score += 2;
  if (answers.dreams.includes("kids-play") && tags.includes("잔디마당")) score += 2;

  // Convenience
  if (tags.includes("새벽배송")) score += 1;

  return score;
}

const MBTIResult = ({ answers, onReset }: MBTIResultProps) => {
  const { data: properties = [] } = useProperties();
  const [saveEmail, setSaveEmail] = useState("");
  const [saveConsent, setSaveConsent] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const hasSubmittedRef = useRef(false);
  const participantId = useMemo(() => generateParticipantId(), []);

  useEffect(() => {
    // Persist the MBTI result the moment the user leaves the result page.
    // Triggers cover desktop (beforeunload), mobile/iOS (pagehide,
    // visibilitychange→hidden), and SPA navigation (effect cleanup).
    const submitAnonymously = () => {
      if (hasSubmittedRef.current) return;
      sendMbtiResultBeacon(buildMbtiPayload("", answers, participantId, "anonymous"));
      hasSubmittedRef.current = true;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") submitAnonymously();
    };

    window.addEventListener("beforeunload", submitAnonymously);
    window.addEventListener("pagehide", submitAnonymously);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", submitAnonymously);
      window.removeEventListener("pagehide", submitAnonymously);
      document.removeEventListener("visibilitychange", onVisibility);
      submitAnonymously();
    };
  }, [answers, participantId]);

  const handleReset = () => {
    if (!hasSubmittedRef.current) {
      // Send anonymous data before resetting
      sendMbtiResultBeacon(buildMbtiPayload("", answers, participantId, "anonymous"));
      hasSubmittedRef.current = true;
    }
    onReset();
  };

  const tips = useMemo(() => generateTips(answers), [answers]);

  const recommendations = useMemo(() => {
    const activeProperties = properties.filter((p) => p.status !== "off");
    const scored = activeProperties.map((p) => ({
      property: p,
      score: scoreProperty(p, answers),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0);
  }, [properties, answers]);

  const userName = answers.gender === "male" ? "고객" : answers.gender === "female" ? "고객" : "고객";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto space-y-12"
    >
      {/* Header */}
      <div className="text-center space-y-4 py-8">
        <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <Lightbulb className="w-8 h-8 text-primary" />
        </div>
        <h1 className="editorial-heading text-3xl md:text-4xl">
          나의 주택 리포트
        </h1>
        <p className="text-muted-foreground">
          답변을 기반으로 분석한 맞춤 주거 가이드입니다.
        </p>
      </div>

      {/* Tips */}
      <section className="space-y-4">
        <h2 className="editorial-subheading">맞춤 주거 조언</h2>
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-start gap-3 p-4 rounded-sm border ${tip.type === "positive"
                ? "border-accent/30 bg-accent/5"
                : "border-primary/30 bg-primary/5"
                }`}
            >
              {tip.type === "positive" ? (
                <CheckCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              )}
              <span className="text-foreground font-sans text-sm leading-relaxed">{tip.text}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Recommendations */}
      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="editorial-subheading">매물 추천</h2>
          <p className="editorial-heading text-xl md:text-2xl">
            {userName}님께 가장 잘 맞는 매물을 추천드립니다
          </p>
        </div>

        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map(({ property, score }, i) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <Link
                  to={propertyUrl(property)}
                  className="group flex gap-4 p-4 bg-card rounded-sm border border-border hover:border-primary/40 transition-all"
                >
                  <div className="w-24 h-24 md:w-32 md:h-32 rounded-sm overflow-hidden shrink-0">
                    <img
                      src={property.image}
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-sans text-primary font-medium">
                        매칭도 {Math.min(score * 15, 98)}%
                      </span>
                    </div>
                    <h3 className="editorial-heading text-lg truncate">{property.title}</h3>
                    <p className="text-muted-foreground text-sm">{property.location}</p>
                    <p className="text-foreground font-sans font-medium text-sm">
                      {(property.price / 100000000).toFixed(1)}억 원
                    </p>
                    {property.tags && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {property.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors self-center shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-card rounded-sm border border-border">
            <Home className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-sans">
              현재 활성화된 매물 중 조건에 맞는 매물이 없습니다.
            </p>
            <p className="text-muted-foreground font-sans text-sm mt-1">
              곧 새로운 매물이 등록될 예정입니다.
            </p>
          </div>
        )}
      </section>

      {/* Save Preferences */}
      <section className="space-y-4">
        <h2 className="editorial-subheading">내 취향 저장하기</h2>
        <p className="text-muted-foreground text-sm font-sans">
          이메일을 남겨주시면 맞춤 매물 정보를 보내드립니다.
        </p>
        {saveDone ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-4 rounded-sm border border-accent/30 bg-accent/5"
          >
            <CheckCircle className="w-5 h-5 text-accent shrink-0" />
            <span className="text-foreground font-sans text-sm">저장되었습니다! 맞춤 매물 정보를 보내드리겠습니다.</span>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="이메일 주소를 입력하세요"
                value={saveEmail}
                onChange={(e) => setSaveEmail(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={async () => {
                  if (!saveEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(saveEmail)) {
                    toast({ title: "올바른 이메일 주소를 입력해주세요.", variant: "destructive" });
                    return;
                  }
                  if (!saveConsent) {
                    toast({ title: "개인정보 수집 동의가 필요합니다.", variant: "destructive" });
                    return;
                  }

                  try {
                    await Promise.all([
                      createMbtiResult(
                        buildMbtiPayload(saveEmail, answers, participantId, "email_save"),
                      ),
                      createInquiry({
                        type: "matched_property_subscribe",
                        contact_type: "email",
                        contact_value: saveEmail.trim(),
                        privacy_consent: true,
                      }),
                    ]);
                    hasSubmittedRef.current = true;
                    setSaveDone(true);
                    toast({ title: "취향이 저장되었습니다!" });
                  } catch (error) {
                    console.error("[MBTIPreferenceSave] failed", error);
                    toast({ title: "저장에 실패했습니다. 다시 시도해주세요.", variant: "destructive" });
                  }
                }}
                className="gap-2"
              >
                <Mail className="w-4 h-4" /> 저장
              </Button>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="save-consent"
                checked={saveConsent}
                onCheckedChange={(v) => setSaveConsent(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="save-consent" className="text-xs text-muted-foreground font-sans cursor-pointer">
                개인정보(이메일) 수집 및 이용에 동의합니다. 수집된 정보는 맞춤 매물 안내 목적으로만 사용됩니다.
              </label>
            </div>
          </div>
        )}
      </section>

      {/* Share & Reset */}
      <div className="flex items-center justify-center gap-3 pt-4 pb-8">
        <Button
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast({ title: "링크가 복사되었습니다!" });
          }}
          className="gap-2"
        >
          <Link2 className="w-4 h-4" /> 공유하기
        </Button>
        <Button variant="outline" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" /> 다시 해보기
        </Button>
      </div>
    </motion.div>
  );
};

export default MBTIResult;
