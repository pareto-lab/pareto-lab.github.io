import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MBTISurvey from "@/components/mbti/MBTISurvey";
import MBTIResult from "@/components/mbti/MBTIResult";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export interface SurveyAnswers {
  age: string;
  gender: string;
  familyType: string;
  driving: boolean;
  plants: boolean;
  pets: boolean;
  camping: boolean;
  hobbies: string[];
  dreams: string[];
}

const HousingMBTI = () => {
  useDocumentTitle("주택 MBTI | 하우스인어스");
  const [answers, setAnswers] = useState<SurveyAnswers | null>(null);
  const [surveyKey, setSurveyKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6">
          <AnimatePresence mode="wait">
            {!answers ? (
              <MBTISurvey key={`survey-${surveyKey}`} onComplete={setAnswers} />
            ) : (
              <MBTIResult key="result" answers={answers} onReset={() => { setAnswers(null); setSurveyKey(k => k + 1); }} />
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default HousingMBTI;
