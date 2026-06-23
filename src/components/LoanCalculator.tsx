import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { trackSectionView, trackCTAClick } from "@/utils/analytics";
import { Property } from "@/data/properties";
import { Slider } from "@/components/ui/slider";
import { Calculator, TrendingUp, Calendar, Percent } from "lucide-react";

interface LoanCalculatorProps {
  property: Property;
}

const LoanCalculator = ({ property }: LoanCalculatorProps) => {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [downPaymentPercent, setDownPaymentPercent] = useState(20);
  const [loanTerm, setLoanTerm] = useState(30);

  useEffect(() => {
    if (inView && property?.id) trackSectionView("loan_calculator", property.id);
  }, [inView, property?.id]);

  // 대출 정보가 없으면 표시하지 않음
  if (!property.loanInfo?.interestRate) return null;

  const downPayment = (property.price * downPaymentPercent) / 100;
  const loanAmount = property.price - downPayment;
  const monthlyRate = property.loanInfo.interestRate / 100 / 12;
  const numPayments = loanTerm * 12;

  const monthlyPayment =
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);


  const formatCurrency = (amount: number, compact?: boolean) => {
    if (compact) {
      const eok = amount / 100000000;
      return `${eok.toFixed(2)}억`;
    }
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
        <div className="w-10 h-10 bg-primary/10 rounded-sm flex items-center justify-center">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-serif text-xl font-medium text-card-foreground">
            대출 시뮬레이션
          </h3>
          <p className="text-sm text-muted-foreground">
            예상 대출 가능 금액을 확인하세요
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex justify-between mb-3">
            <label className="text-sm text-muted-foreground">자기자본 비율</label>
            <span className="text-sm font-medium text-card-foreground">
              {downPaymentPercent}% ({formatCurrency(downPayment)})
            </span>
          </div>
          <Slider
            value={[downPaymentPercent]}
            onValueChange={(value) => setDownPaymentPercent(value[0])}
            onValueCommit={(value) => trackCTAClick(`change_equity_ratio_${value[0]}`, "loan_calculator", property.id)}
            min={5}
            max={50}
            step={5}
            className="w-full"
          />
        </div>

        <div>
          <div className="flex justify-between mb-3">
            <label className="text-sm text-muted-foreground">대출 기간</label>
            <span className="text-sm font-medium text-card-foreground">{loanTerm}년</span>
          </div>
          <Slider
            value={[loanTerm]}
            onValueChange={(value) => setLoanTerm(value[0])}
            onValueCommit={(value) => trackCTAClick(`change_loan_term_${value[0]}`, "loan_calculator", property.id)}
            min={15}
            max={30}
            step={5}
            className="w-full"
          />
        </div>

        <div className="pt-6 border-t border-border">
          <div className="text-center mb-6">
            <span className="editorial-subheading text-primary block mb-2">
              예상 월 상환금
            </span>
            <span className="font-serif text-4xl text-card-foreground">
              {formatCurrency(monthlyPayment)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-secondary/50 rounded-sm">
              <TrendingUp className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
              <span className="block text-xs text-muted-foreground mb-1">대출 금액</span>
              <span className="text-sm font-medium text-card-foreground">{formatCurrency(loanAmount, true)}</span>
            </div>
            <div className="text-center p-4 bg-secondary/50 rounded-sm">
              <Percent className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
              <span className="block text-xs text-muted-foreground mb-1">금리</span>
              <span className="text-sm font-medium text-card-foreground">{property.loanInfo.interestRate}%</span>
            </div>
            <div className="text-center p-4 bg-secondary/50 rounded-sm">
              <Calendar className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
              <span className="block text-xs text-muted-foreground mb-1">기간</span>
              <span className="text-sm font-medium text-card-foreground">{loanTerm}년</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LoanCalculator;
