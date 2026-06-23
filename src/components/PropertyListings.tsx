import { useState } from "react";
import { motion } from "framer-motion";
import PropertyCard from "./PropertyCard";
import PropertyPlaceholders from "./PropertyPlaceholders";
import { useProperties } from "@/hooks/useProperties";
import { Skeleton } from "@/components/ui/skeleton";
import { trackCTAClick } from "@/utils/analytics";

const FILTER_TAGS = [
  "강남으로 출근",
  "새벽배송",
  "잔디마당",
  "수영장",
  "유치원",
  "초등학교",
  "전용주차장",
];

const PropertyListings = () => {
  const { data: properties, isLoading } = useProperties();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (tag: string) => {
    trackCTAClick(`filter_tag: ${tag}`, "main_property_listings");
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 필터링: 선택된 태그가 없으면 전체 표시, 있으면 하나라도 매칭되는 매물만.
  // 정렬은 백엔드의 display_order 순서를 그대로 따른다.
  const sortedProperties = properties?.filter((p) => {
    if (selectedTags.length === 0) return true;
    return selectedTags.some((tag) => p.tags?.includes(tag));
  });

  return (
    <section id="listings" className="scroll-mt-24 py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="editorial-subheading text-primary mb-4 block">
            현재 매물
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl font-medium text-foreground break-keep">
            당신을 기다리는 이야기
          </h2>
        </motion.div>

        {/* 필터 태그 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-16"
        >
          {FILTER_TAGS.map((tag) => {
            const isActive = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-4">
                <Skeleton className="aspect-[4/3] w-full rounded-sm" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))
          ) : sortedProperties && sortedProperties.length > 0 ? (
            sortedProperties.map((property, index) => (
              <PropertyCard key={property.id} property={property} index={index} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">선택한 조건에 맞는 매물이 없습니다.</p>
            </div>
          )}
          {/* 준비 중 매물 자리채움 — 실매물이 충분해지면 이 한 줄과 import만 제거하면 됨 */}
          {!isLoading && (
            <PropertyPlaceholders startIndex={sortedProperties?.length ?? 0} />
          )}
        </div>
      </div>
    </section>
  );
};

export default PropertyListings;
