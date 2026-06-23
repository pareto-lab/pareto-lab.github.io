import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { trackFormInteraction, trackLeadGeneration } from "@/utils/analytics";
import type { SurveyAnswers } from "@/pages/HousingMBTI";

interface MBTISurveyProps {
  onComplete: (answers: SurveyAnswers) => void;
}

const steps = [
  {
    id: "intro",
    title: "나의 주택 MBTI 찾기",
    subtitle: "몇 가지 질문에 답하면, 당신에게 꼭 맞는 주거 스타일과 매물을 추천해드립니다.",
  },
  {
    id: "age",
    title: "나이대를 알려주세요",
    subtitle: "라이프 스테이지에 따라 적합한 주거 환경이 달라집니다.",
    type: "radio" as const,
    field: "age" as const,
    options: [
      { value: "20s", label: "20대" },
      { value: "30s", label: "30대" },
      { value: "40s", label: "40대" },
      { value: "50s", label: "50대 이상" },
    ],
  },
  {
    id: "gender",
    title: "성별을 알려주세요",
    subtitle: "",
    type: "radio" as const,
    field: "gender" as const,
    options: [
      { value: "male", label: "남성" },
      { value: "female", label: "여성" },
      { value: "other", label: "기타" },
    ],
  },
  {
    id: "familyType",
    title: "가족 구성을 알려주세요",
    subtitle: "가족 구성에 따라 필요한 공간과 환경이 달라집니다.",
    type: "radio" as const,
    field: "familyType" as const,
    options: [
      { value: "single", label: "1인 가구" },
      { value: "couple", label: "부부 (아이 없음)" },
      { value: "young-family", label: "영유아 자녀 가족" },
      { value: "school-family", label: "학령기 자녀 가족" },
      { value: "grown-family", label: "성인 자녀 가족" },
    ],
  },
  {
    id: "driving",
    title: "나와 내 가족은 운전을 한다",
    subtitle: "주차 공간과 도로 접근성에 영향을 줍니다.",
    type: "boolean" as const,
    field: "driving" as const,
  },
  {
    id: "plants",
    title: "나는 식물을 키워본 적 있다",
    subtitle: "정원이나 마당 관리에 대한 적합성을 판단합니다.",
    type: "boolean" as const,
    field: "plants" as const,
  },
  {
    id: "pets",
    title: "반려동물을 키우거나 키울 생각이 있다",
    subtitle: "반려견/반려묘 친화적인 환경을 추천합니다.",
    type: "boolean" as const,
    field: "pets" as const,
  },
  {
    id: "camping",
    title: "캠핑을 다니거나 좋아한다",
    subtitle: "아웃도어 라이프스타일과의 궁합을 봅니다.",
    type: "boolean" as const,
    field: "camping" as const,
  },
  {
    id: "hobbies",
    title: "관심 있는 취미를 모두 골라주세요",
    subtitle: "라이프스타일에 맞는 공간을 추천합니다.",
    type: "multi" as const,
    field: "hobbies" as const,
    options: [
      { value: "cooking", label: "요리 / 베이킹" },
      { value: "reading", label: "독서 / 글쓰기" },
      { value: "gardening", label: "정원 가꾸기" },
      { value: "exercise", label: "운동 / 피트니스" },
      { value: "art", label: "그림 / 공예" },
      { value: "music", label: "음악 감상 / 연주" },
    ],
  },
  {
    id: "dreams",
    title: "주택에 대한 로망을 모두 골라주세요",
    subtitle: "당신의 꿈을 실현할 공간을 찾아드립니다.",
    type: "multi" as const,
    field: "dreams" as const,
    options: [
      { value: "yard-bbq", label: "마당에서 바베큐" },
      { value: "home-office", label: "나만의 서재/작업실" },
      { value: "morning-coffee", label: "테라스에서 모닝 커피" },
      { value: "kids-play", label: "아이들이 뛰노는 마당" },
      { value: "pool", label: "프라이빗 수영장" },
      { value: "stargazing", label: "별 보며 와인 한 잔" },
    ],
  },
];

const MBTISurvey = ({ onComplete }: MBTISurveyProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<{
    age: string;
    gender: string;
    familyType: string;
    driving?: boolean;
    plants?: boolean;
    camping?: boolean;
    pets?: boolean;
    hobbies: string[];
    dreams: string[];
  }>({
    age: "",
    gender: "",
    familyType: "",
    driving: undefined,
    plants: undefined,
    camping: undefined,
    pets: undefined,
    hobbies: [],
    dreams: [],
  });

  const step = steps[currentStep];
  const isIntro = step.id === "intro";
  const isLast = currentStep === steps.length - 1;

  const currentStepRef = useRef(currentStep);
  const isSubmittedRef = useRef(false);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    // 사용자가 창을 닫거나 뒤로가기 등으로 언마운트 시 포기 시점으로 판별
    return () => {
      if (!isSubmittedRef.current) {
        trackFormInteraction(
          "housing_mbti", 
          `abandoned_${steps[currentStepRef.current].id}`
        );
      }
    };
  }, []);

  const canProceed = () => {
    if (isIntro) return true;
    if (step.type === "boolean" && step.field) return typeof (formData as any)[step.field] === "boolean";
    if (step.type === "radio" && step.field) return !!(formData as any)[step.field];
    if (step.type === "multi") return true;
    return true;
  };

  const handleNext = () => {
    trackFormInteraction("housing_mbti", `step_complete_${step.id}`);
    if (isLast) {
      isSubmittedRef.current = true;
      trackLeadGeneration("housing_mbti", "submit_mbti");
      onComplete(formData as SurveyAnswers);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const setRadio = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setBool = (field: string, value: boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMulti = (field: string, value: string) => {
    setFormData((prev) => {
      const arr = (prev as any)[field] as string[];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const progress = ((currentStep) / (steps.length - 1)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      {/* Progress bar */}
      {!isIntro && (
        <div className="mb-8">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="editorial-subheading mt-2 text-right">
            {currentStep} / {steps.length - 1}
          </p>
        </div>
      )}

      <motion.div
        key={step.id}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={{ duration: 0.3 }}
        className="space-y-8"
      >
        {/* Title */}
        <div className={isIntro ? "text-center py-16 space-y-6" : "space-y-2"}>
          {isIntro && (
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Home className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className={`editorial-heading ${isIntro ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"}`}>
            {step.title}
          </h1>
          {step.subtitle && (
            <p className="text-muted-foreground text-base md:text-lg">
              {step.subtitle}
            </p>
          )}
        </div>

        {/* Content */}
        {step.type === "radio" && step.options && step.field && (
          <RadioGroup
            value={(formData as any)[step.field]}
            onValueChange={(v) => setRadio(step.field!, v)}
            className="space-y-3"
          >
            {step.options.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-4 p-4 rounded-sm border cursor-pointer transition-all ${(formData as any)[step.field!] === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                  }`}
              >
                <RadioGroupItem value={opt.value} />
                <span className="text-foreground font-sans">{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        )}

        {step.type === "boolean" && step.field && (
          <div className="space-y-3">
            {[
              { value: true, label: "네, 그렇습니다" },
              { value: false, label: "아니요" },
            ].map((opt) => (
              <label
                key={String(opt.value)}
                className={`flex items-center gap-4 p-4 rounded-sm border cursor-pointer transition-all ${(formData as any)[step.field!] === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                  }`}
                onClick={() => setBool(step.field!, opt.value)}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${(formData as any)[step.field!] === opt.value ? "border-primary" : "border-muted-foreground"
                    }`}
                >
                  {(formData as any)[step.field!] === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-foreground font-sans">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {step.type === "multi" && step.options && step.field && (
          <div className="grid grid-cols-2 gap-3">
            {step.options.map((opt) => {
              const checked = ((formData as any)[step.field!] as string[]).includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-4 rounded-sm border cursor-pointer transition-all ${checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleMulti(step.field!, opt.value)}
                  />
                  <span className="text-foreground font-sans text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          {currentStep > 0 ? (
            <Button variant="ghost" onClick={handleBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> 이전
            </Button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="gap-2"
            size="lg"
          >
            {isIntro ? "시작하기" : isLast ? "결과 보기" : "다음"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MBTISurvey;
