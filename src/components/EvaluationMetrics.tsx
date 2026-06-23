import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { BarChart3 } from "lucide-react";
import type { EvaluationMetric, Property } from "@/data/properties";

const PieMeter = ({
  score,
  delay,
  size: sizeOverride,
}: {
  score: number;
  delay: number;
  size?: number;
}) => {
  const meterRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(meterRef, { once: true, amount: 0.45 });
  const size = sizeOverride || 140;
  const strokeWidth = size > 100 ? 18 : 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;

  return (
    <div ref={meterRef} className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          initial={false}
          animate={{ strokeDashoffset: isInView ? circumference - progress : circumference }}
          transition={isInView ? { duration: 1.2, delay, ease: "easeOut" } : { duration: 0 }}
          transform={`rotate(-90 ${center} ${center})`}
          opacity={0.6}
        />
      </svg>
      <motion.span
        className={`absolute font-serif font-medium text-primary ${
          size > 100 ? "text-3xl" : "text-2xl"
        }`}
        initial={false}
        animate={{ opacity: isInView ? 1 : 0, scale: isInView ? 1 : 0.95 }}
        transition={isInView ? { duration: 0.45, delay: delay + 0.45 } : { duration: 0 }}
      >
        {score}
      </motion.span>
    </div>
  );
};

interface Props {
  property: Property;
}

const EvaluationMetrics = ({ property }: Props) => {
  const metrics: EvaluationMetric[] = property.evaluationMetrics ?? [];
  if (metrics.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="py-8 md:py-12"
    >
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <h2 className="editorial-subheading text-primary">하우스인어스 산정 지표</h2>
      </div>

      {/* Desktop: dynamic columns up to 4 */}
      <div
        className="hidden md:grid gap-8"
        style={{
          gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {metrics.map((metric, index) => (
          <div key={index} className="flex flex-col items-center text-center">
            <PieMeter score={metric.score} delay={index * 0.15} />
            <h3 className="font-serif text-base font-medium text-foreground mt-5 mb-3">
              {metric.title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {metric.description}
            </p>
          </div>
        ))}
      </div>

      {/* Mobile: vertical list */}
      <div className="md:hidden space-y-6">
        {metrics.map((metric, index) => (
          <div key={index} className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <PieMeter score={metric.score} delay={index * 0.1} size={80} />
            </div>
            <div className="flex-1 pt-2">
              <h3 className="font-serif text-base font-medium text-foreground mb-1.5">
                {metric.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {metric.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default EvaluationMetrics;
