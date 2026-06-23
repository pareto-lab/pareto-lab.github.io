import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LifestyleScenario, Property } from "@/data/properties";

interface Props {
  property: Property;
}

const LifestyleScenarios = ({ property }: Props) => {
  const scenarios: LifestyleScenario[] = property.lifestyleScenarios ?? [];
  const [current, setCurrent] = useState(0);
  const preloadImagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    setCurrent(0);
  }, [scenarios.length]);

  useEffect(() => {
    if (scenarios.length === 0) return;
    preloadImagesRef.current = [1, 2].map((offset) => {
      const image = new Image();
      image.decoding = "async";
      image.src = scenarios[(current + offset) % scenarios.length].src;
      return image;
    });
  }, [current, scenarios]);

  if (scenarios.length === 0) return null;

  const safeIdx = Math.min(current, scenarios.length - 1);
  const scenario = scenarios[safeIdx];

  const prev = () => setCurrent((c) => (c - 1 + scenarios.length) % scenarios.length);
  const next = () => setCurrent((c) => (c + 1) % scenarios.length);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="py-8 md:py-12"
    >
      <div className="relative bg-secondary/30 rounded-sm overflow-hidden border border-border">
        <div className="flex flex-col md:flex-row">
          <div className="order-2 md:order-1 md:w-[320px] flex-shrink-0 p-6 md:p-10 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={safeIdx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-serif text-xl md:text-3xl font-semibold text-foreground mb-3 md:mb-4">
                  이곳에서의 일상
                </h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm md:text-base">
                  {scenario.description}
                </p>
                <p className="md:hidden text-xs text-muted-foreground/60 mt-3">
                  {safeIdx + 1} / {scenarios.length}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="order-1 md:order-2 flex-1 relative aspect-[4/3] md:aspect-auto md:min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.img
                key={safeIdx}
                src={scenario.src}
                alt="이곳에서의 일상"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full h-full object-cover absolute inset-0 object-center"
              />
            </AnimatePresence>

            <button
              onClick={prev}
              className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 bg-background/70 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground hover:bg-background transition-colors"
              aria-label="이전"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-9 h-9 md:w-10 md:h-10 bg-background/70 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground hover:bg-background transition-colors"
              aria-label="다음"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            {scenarios.length > 1 && (
              <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 gap-2">
                {scenarios.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === safeIdx ? "bg-primary-foreground" : "bg-primary-foreground/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default LifestyleScenarios;
