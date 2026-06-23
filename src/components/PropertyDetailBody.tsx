import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { trackSectionView } from "@/utils/analytics";
import { motion } from "framer-motion";
import LoanCalculator from "@/components/LoanCalculator";
import OpenHouseEvents from "@/components/OpenHouseEvents";
import { ArrowLeft, MapPin, Sparkles } from "lucide-react";
import ExpandableText from "@/components/ExpandableText";
import HousePlan from "@/components/HousePlan";
import EvaluationMetrics from "@/components/EvaluationMetrics";
import LifestyleScenarios from "@/components/LifestyleScenarios";
import InquirySection from "@/components/InquirySection";
import InteriorGallery from "@/components/InteriorGallery";
import type { Property } from "@/data/properties";

interface Props {
  property: Property;
  /** When false, skips trackSectionView analytics (e.g. admin preview). */
  trackViews?: boolean;
  /** Back link in the hero overlay. Hidden when null. */
  backLink?: { to: string; label: string } | null;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

const PropertyDetailBody = ({
  property,
  trackViews = true,
  backLink = { to: "/", label: "매물 목록으로" },
}: Props) => {
  const [heroRef, heroInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [infoRef, infoInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [storyRef, storyInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [highlightsRef, highlightsInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [interiorGalleryRef, interiorGalleryInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [housePlanRef, housePlanInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [evalRef, evalInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [lifestyleRef, lifestyleInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [inquiryRef, inquiryInView] = useInView({ triggerOnce: true, threshold: 0.3 });

  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (heroInView) trackSectionView("hero", property.id);
  }, [trackViews, heroInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (infoInView) trackSectionView("property_info", property.id);
  }, [trackViews, infoInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (storyInView) trackSectionView("lifestyle_story", property.id);
  }, [trackViews, storyInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (highlightsInView) trackSectionView("lifestyle_highlights", property.id);
  }, [trackViews, highlightsInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (interiorGalleryInView) trackSectionView("interior_gallery", property.id);
  }, [trackViews, interiorGalleryInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (housePlanInView) trackSectionView("house_plan", property.id);
  }, [trackViews, housePlanInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (evalInView) trackSectionView("evaluation_metrics", property.id);
  }, [trackViews, evalInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (lifestyleInView) trackSectionView("lifestyle_scenarios", property.id);
  }, [trackViews, lifestyleInView, property?.id]);
  useEffect(() => {
    if (!trackViews || !property?.id) return;
    if (inquiryInView) trackSectionView("inquiry_section", property.id);
  }, [trackViews, inquiryInView, property?.id]);

  return (
    <main className="pt-20">
      <section ref={heroRef} className="relative h-[70vh] overflow-hidden">
        <motion.img
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1 }}
          src={property.image}
          alt={property.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/50 via-transparent to-transparent" />
        {backLink ? (
          <Link
            to={backLink.to}
            className="no-print fixed top-[73px] left-4 md:left-8 z-40 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm text-foreground hover:bg-background transition-colors text-sm font-medium px-3 py-1.5 rounded-full shadow border border-border"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">{backLink.label}</span>
          </Link>
        ) : null}
      </section>

      <section className="container mx-auto px-4 md:px-6 py-8 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          <div className="lg:col-span-2">
            <motion.div
              ref={infoRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="editorial-subheading text-primary text-xs md:text-sm">
                  {property.location}
                </span>
              </div>
              <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl font-medium text-foreground leading-tight mb-3 md:mb-4">
                {property.title}
              </h1>
              <p className="text-base md:text-xl text-muted-foreground italic mb-6 md:mb-8 break-keep">
                {property.subtitle}
              </p>
              <div className="pb-6 md:pb-8 border-b border-border">
                <p className="editorial-subheading text-primary mb-2 md:mb-3 text-xs md:text-sm">매물 정보</p>
                <h2 className="font-serif text-2xl md:text-4xl font-medium text-foreground mb-4 md:mb-6">
                  {formatPrice(property.price)}{" "}
                  <span className="text-base md:text-xl text-muted-foreground font-normal">(매매)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 md:gap-y-3 text-sm md:text-[15px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground min-w-[4.5rem] md:min-w-[5.5rem] flex-shrink-0">위치</span>
                    <span className="text-foreground/80">{property.location}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground min-w-[4.5rem] md:min-w-[5.5rem] flex-shrink-0">대지 면적</span>
                    <span className="text-foreground/80">{property.specs?.landArea || "-"}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground min-w-[4.5rem] md:min-w-[5.5rem] flex-shrink-0">사용승인</span>
                    <span className="text-foreground/80">{property.specs?.builtYear || "-"}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground min-w-[4.5rem] md:min-w-[5.5rem] flex-shrink-0">실내 면적</span>
                    <span className="text-foreground/80">{property.specs?.indoorArea || "-"}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground min-w-[4.5rem] md:min-w-[5.5rem] flex-shrink-0">방/화장실</span>
                    <span className="text-foreground/80">
                      방 {property.specs?.beds || "-"}개 / 화장실 {property.specs?.baths || "-"}개
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground min-w-[4.5rem] md:min-w-[5.5rem] flex-shrink-0">설계구조</span>
                    <span className="text-foreground/80">{property.specs?.scale || "-"}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.article
              ref={storyRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="py-8 md:py-12"
            >
              <h2 className="editorial-subheading text-primary mb-4 md:mb-6">이 집의 이야기</h2>
              <div className="hidden md:block prose prose-lg max-w-none">
                {property.lifestyleStory.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="text-foreground/80 leading-relaxed mb-6 text-lg">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="md:hidden">
                <ExpandableText maxLines={8}>
                  <div className="prose max-w-none">
                    {property.lifestyleStory.split("\n\n").map((paragraph, index) => (
                      <p key={index} className="text-foreground/80 leading-relaxed mb-4 text-[15px]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </ExpandableText>
              </div>
            </motion.article>

            <motion.div
              ref={highlightsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="pb-8 md:pb-12"
            >
              <h2 className="editorial-subheading text-primary mb-4 md:mb-6">기다리는 순간들</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {property.lifestyleHighlights.map((highlight, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 md:p-4 bg-secondary/50 rounded-sm"
                  >
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground text-sm md:text-base">{highlight}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <div ref={interiorGalleryRef}>
              <InteriorGallery property={property} />
            </div>
            <div ref={housePlanRef}>
              <HousePlan property={property} />
            </div>
            <div ref={evalRef}>
              <EvaluationMetrics property={property} />
            </div>
            <div ref={lifestyleRef}>
              <LifestyleScenarios property={property} />
            </div>
            <div ref={inquiryRef} className="no-print">
              <InquirySection propertyId={property.id} />
            </div>
            <p className="no-print text-xs text-muted-foreground leading-relaxed">
              본 페이지는 적법한 게시 권한자의 요청에 따라 제작·게시된 주택 소개 자료입니다. 하우스인어스는 포트폴리오 제작 및 게시 도구를 제공하며, 부동산 중개, 거래 알선, 가격 협상, 계약서 작성, 권리관계 검토 또는 법률 자문을 수행하지 않습니다. 거래 관련 판단과 확인은 거래 당사자의 책임으로 진행됩니다.
            </p>
          </div>

          <aside className="lg:col-span-1 space-y-8 no-print">
            <LoanCalculator property={property} />
            <div className="lg:sticky lg:top-24">
              <OpenHouseEvents property={property} />
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
};

export default PropertyDetailBody;
