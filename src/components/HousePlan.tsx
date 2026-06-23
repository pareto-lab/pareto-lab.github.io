import { motion } from "framer-motion";
import {
  MapPin,
  School,
  Building2,
  ShoppingCart,
  ChevronDown,
  Home,
  Clock,
  Search,
  Car,
  Info,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import React, { useRef, useState } from "react";
import NaverMapView from "@/components/NaverMapView";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  NearbyCategory,
  NearbyPlace,
  Property,
  HousePlanSpecRow,
} from "@/data/properties";

type ResolvedNearbyCategory = {
  icon: React.ReactNode;
  label: string;
  infoText: string | null;
  hideInfo: boolean;
  places: NearbyPlace[];
};

const ICON_MAP: Record<string, LucideIcon> = {
  School,
  Building2,
  ShoppingCart,
  MapPin,
  Home,
  Car,
};

const resolveIcon = (name: string): React.ReactNode => {
  const Cmp = ICON_MAP[name] ?? MapPin;
  return <Cmp className="w-4 h-4 text-primary" />;
};

const resolveCategories = (cats: NearbyCategory[]): ResolvedNearbyCategory[] =>
  cats.map((c) => ({
    icon: resolveIcon(c.icon),
    label: c.label,
    infoText: c.info_text?.trim() || null,
    hideInfo: c.hide_info ?? false,
    places: c.places,
  }));

const InfoTooltip = ({ text, label }: { text: string; label: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} 안내`}
          className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
};

const cleanPlaceName = (name: string): string => {
  const sep = name.indexOf(' · ');
  return sep !== -1 ? name.substring(sep + 3) : name;
};

const SpecRow = ({ label, value, info_text, hide_info }: HousePlanSpecRow) => {
  const infoText = info_text?.trim() || null;
  const showInfo = Boolean(infoText) && !hide_info;
  return (
    <div className="flex items-start gap-2 py-2 md:py-2.5 border-b border-border/50 last:border-b-0">
      <span className="text-xs md:text-sm text-foreground flex-shrink-0 inline-flex items-center gap-1.5">
        {label}
        {showInfo && infoText && <InfoTooltip text={infoText} label={label} />}
      </span>
      <span className="text-xs md:text-sm font-medium text-foreground flex items-center gap-1.5">
        <span className="text-primary">▶</span> {value}
      </span>
    </div>
  );
};

const SHOW_HOUSE_PLAN_MAP = false;
const SHOW_TRAVEL_TIME_SEARCH = false;
const DESKTOP_COLLAPSED_MAX_HEIGHT = 420;
const MOBILE_COLLAPSED_MAX_HEIGHT = 420;

const TravelTimeSearchBlock = ({ className = "mb-10" }: { className?: string }) => {
  const [destination, setDestination] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [travelResult, setTravelResult] = useState<{ time: string; dest: string } | null>(null);

  const handleSearch = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (e && e.key !== "Enter") return;
    if (!destination.trim()) return;
    setIsSearching(true);
    setTravelResult(null);
    setTimeout(() => {
      setTravelResult({ time: "15분", dest: destination });
      setIsSearching(false);
    }, 1000);
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-accent/10 rounded-sm flex items-center justify-center">
          <Clock className="w-4 h-4 text-accent" />
        </div>
        <h3 className="font-serif text-lg md:text-xl font-medium text-foreground">이동 시간 검색</h3>
      </div>
      {!travelResult ? (
        <>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="목적지를 입력하세요 (예: 강남역, 판교역)"
              className="w-full h-11 pl-10 pr-10 text-sm bg-background border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"
              disabled={isSearching}
            />
            {isSearching && (
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              </div>
            )}
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground break-keep">
            ※ 현재 네이버 길찾기 연동을 준비 중입니다. 위 결과는 임시 예시입니다.
          </p>
        </>
      ) : (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="p-4 border border-border rounded-sm bg-background overflow-hidden relative"
        >
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0 mt-0.5 text-[13px]">
                도착
              </div>
              <div>
                <p className="text-[15px] text-foreground mb-1 break-keep pr-8">
                  <span className="text-muted-foreground">목적지: </span>
                  {travelResult.dest}
                </p>
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-foreground" />
                  <p className="text-[15px] font-medium text-foreground">
                    자동차로 <span className="font-bold">{travelResult.time}</span> 소요 예상
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setTravelResult(null);
                setDestination("");
              }}
              className="absolute top-4 right-4 text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              수정
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

interface Props {
  property: Property;
}

const HousePlan = ({ property }: Props) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const housePlanTitleRef = useRef<HTMLHeadingElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const specs = property.housePlanSpecs ?? { main: [], collapsed: [] };
  const nearbyPlaces = resolveCategories(property.nearbyPlaces ?? []);
  const allSpecs = [...specs.main, ...specs.collapsed];

  if (allSpecs.length === 0 && nearbyPlaces.length === 0) return null;

  const nearbyRowCount = nearbyPlaces.reduce(
    (count, category) => count + Math.max(category.places.length, 1),
    0,
  );
  const shouldDesktopCollapse = allSpecs.length > 5 || nearbyRowCount > 5;

  const toggleDesktopCollapse = () => {
    if (!isOpen) {
      setIsOpen(true);
      return;
    }

    setIsOpen(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scrollTarget = housePlanTitleRef.current ?? sectionRef.current;
        scrollTarget?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  return (
    <motion.div
      ref={sectionRef}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="py-8 md:py-12"
    >
      {/* Desktop layout */}
      <div className="hidden md:block">
        <div
          className={`relative grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-12 ${
            shouldDesktopCollapse && !isOpen ? "overflow-hidden" : ""
          }`}
          style={
            shouldDesktopCollapse && !isOpen
              ? { maxHeight: `${DESKTOP_COLLAPSED_MAX_HEIGHT}px` }
              : undefined
          }
        >
          {allSpecs.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center">
                  <Home className="w-4 h-4 text-primary" />
                </div>
                <h2 ref={housePlanTitleRef} className="editorial-subheading text-primary scroll-mt-24">
                  House Plan
                </h2>
              </div>
              <div className="border-l border-border pl-6">
                {allSpecs.map((spec, i) => (
                  <SpecRow key={i} {...spec} />
                ))}
              </div>
            </div>
          )}

          {nearbyPlaces.length > 0 && (
            <div>
              {SHOW_HOUSE_PLAN_MAP && (
                <div className="w-full h-[220px] rounded-sm mb-6 border border-border overflow-hidden">
                  <NaverMapView className="w-full h-full" zoom={15} />
                </div>
              )}
              {SHOW_TRAVEL_TIME_SEARCH && <TravelTimeSearchBlock className="mb-10" />}

              <div className="space-y-6">
                {nearbyPlaces.map((category, ci) => (
                  <NearbySection key={ci} category={category} />
                ))}
              </div>
            </div>
          )}

          {shouldDesktopCollapse && !isOpen && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/95 to-transparent" />
          )}
        </div>

        {shouldDesktopCollapse && (
          <button
            onClick={toggleDesktopCollapse}
            className="flex items-center gap-1.5 mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
            {isOpen ? "접기" : "더 보기"}
          </button>
        )}
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <div
          className={`relative space-y-6 ${
            !isMobileOpen ? "overflow-hidden" : ""
          }`}
          style={!isMobileOpen ? { maxHeight: `${MOBILE_COLLAPSED_MAX_HEIGHT}px` } : undefined}
        >
          {allSpecs.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center">
                  <Home className="w-4 h-4 text-primary" />
                </div>
                <h2 className="editorial-subheading text-primary text-sm">House Plan</h2>
              </div>
              <div className="border-l border-border pl-4">
                {allSpecs.map((spec, i) => (
                  <SpecRow key={i} {...spec} />
                ))}
              </div>
            </div>
          )}

          {SHOW_TRAVEL_TIME_SEARCH && <TravelTimeSearchBlock className="mb-8" />}

          {nearbyPlaces.length > 0 && (
            <div className="space-y-4">
              {nearbyPlaces.map((category, ci) => (
                <NearbySection key={ci} category={category} />
              ))}
            </div>
          )}

          {!isMobileOpen && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/95 to-transparent" />
          )}
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="flex items-center gap-1.5 mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isMobileOpen ? "rotate-180" : ""
            }`}
          />
          {isMobileOpen ? "접기" : "더 보기"}
        </button>
      </div>
    </motion.div>
  );
};

const NearbySection = ({
  category,
  hideHeader,
}: {
  category: ResolvedNearbyCategory;
  hideHeader?: boolean;
}) => (
  <div>
    {!hideHeader && (
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center">
          {category.icon}
        </div>
        <div className="flex items-center gap-1.5">
          <h4 className="editorial-subheading text-primary">
            {category.label}
          </h4>
          {category.infoText && !category.hideInfo && (
            <InfoTooltip text={category.infoText} label={category.label} />
          )}
        </div>
      </div>
    )}
    <div className="border-l border-border pl-6">
      {category.places.length > 0 ? (
        category.places.map((place, pi) => (
          <div
            key={pi}
            className="flex items-start gap-2 py-2 md:py-2.5 border-b border-border/50 last:border-b-0"
          >
            <span className="text-xs md:text-sm text-foreground flex-shrink-0">
              {cleanPlaceName(place.name)}
            </span>
            {place.distance && (
              <span className="text-xs md:text-sm font-medium text-foreground flex items-center gap-1.5 ml-auto">
                <span className="text-primary">▶</span> {place.distance}
              </span>
            )}
          </div>
        ))
      ) : (
        <div className="py-2 md:py-2.5 border-b border-border/50">
          <span className="text-xs md:text-sm text-muted-foreground">-</span>
        </div>
      )}
    </div>
  </div>
);

export default HousePlan;
