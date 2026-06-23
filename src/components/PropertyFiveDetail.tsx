import type { ReactNode } from "react";
import { useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { trackSectionView, trackCTAClick, trackLeadGeneration } from "@/utils/analytics";
import { Property } from "@/data/properties";
import { Button } from "@/components/ui/button";
import property1 from "@/assets/property-1.jpg";
import property2 from "@/assets/property-2.jpg";
import property3 from "@/assets/property-3.jpg";
import property4 from "@/assets/property-4.jpg";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  GraduationCap,
  Home,
  MapPin,
} from "lucide-react";

interface PropertyFiveDetailProps {
  property: Property;
}

const imageGallery = [
  property4,
  property3,
  property2,
];

const roomGallery = [
  property1,
  property2,
  property3,
];

const neighborhoodGallery = [
  property4,
  property1,
];

const housePlanRows: [string, string][] = [
  ["총 세대수", "42세대"],
  ["준공 연도", "2021년"],
  ["전용 면적", "84㎡"],
  ["대지 면적", "312㎡"],
  ["주차", "2대 가능"],
];

const timelineRows: [string, string][] = [
  ["입주 가능일", "조율 가능"],
  ["계약 형태", "매매"],
  ["권리 관계", "이상 없음"],
];

const lifestyleRows: [string, string][] = [
  ["어린이집", "차로 4분"],
  ["초등학교", "도보 10분"],
  ["대형마트", "차로 8분"],
];

const schoolRows: [string, string][] = [
  ["유치원", "도보권"],
  ["초등학교", "근거리"],
  ["중학교", "차량 통학"],
];

const statItems = [
  { label: "주거비용 편의성", score: 82 },
  { label: "채광도", score: 76 },
  { label: "보장 접근도", score: 68 },
  { label: "가격 적정성", score: 79 },
];

const PropertyFiveDetail = ({ property }: PropertyFiveDetailProps) => {
  const [heroRef, heroInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [radarRef, radarInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [galleryRef, galleryInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [roomRef, roomInView] = useInView({ triggerOnce: true, threshold: 0.3 });
  const [housePlanRef, housePlanInView] = useInView({ triggerOnce: true, threshold: 0.3 });

  useEffect(() => {
    if (heroInView && property?.id) trackSectionView("hero", property.id);
  }, [heroInView, property?.id]);
  useEffect(() => {
    if (radarInView && property?.id) trackSectionView("radar_chart", property.id);
  }, [radarInView, property?.id]);
  useEffect(() => {
    if (galleryInView && property?.id) trackSectionView("gallery", property.id);
  }, [galleryInView, property?.id]);
  useEffect(() => {
    if (roomInView && property?.id) trackSectionView("room_details", property.id);
  }, [roomInView, property?.id]);
  useEffect(() => {
    if (housePlanInView && property?.id) trackSectionView("house_plan", property.id);
  }, [housePlanInView, property?.id]);

  return (
    <section className="bg-[#f4f1ed] pb-24">
      <div className="mx-auto w-full max-w-6xl px-6 pt-24">
        <div ref={heroRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pb-12">
          <div>
            <p className="text-sm text-foreground/70 mb-3">아이와 노년의</p>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold leading-tight">
              시간이 흐르는 집
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80 md:pt-5">
            코로나19 이후 재택이 확산된 요즘, 아이와 부모의 생활 동선이 자연스럽게
            이어지는 집을 목표로 구성했습니다. 오래 머물수록 편안한 일상에 초점을 맞춘
            제안입니다.
          </p>
        </div>

        <div className="overflow-hidden border border-border mb-12">
          <img src={property.image} alt={property.title} className="w-full h-[540px] object-cover" />
        </div>

        <div ref={radarRef} className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-10 mb-12">
          <div className="bg-[#efe7de] p-8 border border-[#e2d6c8]">
            <h2 className="text-sm tracking-wide text-[#b96243] mb-4">주거 레이더</h2>
            <div className="relative h-56">
              <svg viewBox="0 0 240 220" className="absolute inset-0 h-full w-full">
                <polygon points="120,20 205,75 180,180 60,180 35,75" fill="#e4c7b5" opacity="0.9" />
                <circle cx="120" cy="110" r="72" fill="none" stroke="#d6b7a4" strokeWidth="2" />
                <circle cx="120" cy="110" r="46" fill="none" stroke="#d6b7a4" strokeWidth="2" />
                <circle cx="120" cy="110" r="22" fill="none" stroke="#d6b7a4" strokeWidth="2" />
              </svg>
              <div className="absolute inset-0 text-xs text-[#b96243]">
                <span className="absolute left-1/2 -translate-x-1/2 top-0">보안</span>
                <span className="absolute right-0 top-1/3">채광</span>
                <span className="absolute right-8 bottom-2">접근성</span>
                <span className="absolute left-8 bottom-2">유지관리</span>
                <span className="absolute left-0 top-1/3">가족동선</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {[
              "남노아와 3분 거리",
              "주거 실내공간 진입",
              "토요일 라이프스타일 점검 4개",
              "고단열 시스템 적용",
              "취향 도서대를 사무 공간",
            ].map((item) => (
              <div key={item} className="bg-[#ebe6df] border border-[#e0dad2] px-5 py-3 text-sm">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div ref={galleryRef} className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {imageGallery.map((image) => (
            <img key={image} src={image} alt="매물 이미지" className="h-56 w-full object-cover border border-border" />
          ))}
        </div>

        <div className="text-center border-b border-border pb-10 mb-12">
          <h2 className="font-serif text-5xl font-semibold mb-4">6억 5천만 원 (매매)</h2>
          <p className="text-sm text-foreground/70">
            계약 기준: 2026년 3월 | 전용면적: 84.91㎡ | 대지권: 312.1㎡
          </p>
        </div>

        <div ref={roomRef} className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4 mb-10">
          <div className="relative border border-border overflow-hidden">
            <img src={roomGallery[0]} alt="실내 대표 이미지" className="h-[460px] w-full object-cover" />
            <button className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-rows-2 gap-4">
            <img src={roomGallery[1]} alt="실내 이미지 1" className="h-[222px] w-full object-cover border border-border" />
            <img src={roomGallery[2]} alt="실내 이미지 2" className="h-[222px] w-full object-cover border border-border" />
          </div>
        </div>

        <p className="text-sm text-foreground/75 mb-8">
          거실과 주방, 작업 공간이 자연스럽게 이어져 아이와 함께 머무르기 좋은 구조입니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          <Button variant="outline" className="justify-between border-[#b96243] text-[#b96243]" onClick={() => trackLeadGeneration("reservation", "new_visit", property.id)}>
            신규 방문 예약하기 <ChevronRight className="w-4 h-4" />
          </Button>
          <Button className="bg-[#b96243] hover:bg-[#a45338]" onClick={() => trackLeadGeneration("reservation", "specific_time", property.id)}>4월 5일 14시</Button>
          <Button className="bg-[#b96243] hover:bg-[#a45338] justify-between" onClick={() => trackLeadGeneration("reservation", "other_schedule", property.id)}>
            + 다른 일정 예약하기 <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div ref={housePlanRef} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          <InfoBox title="HOUSE PLAN" icon={<Home className="w-4 h-4" />} rows={housePlanRows} />
          <InfoBox title="이동 시간" icon={<Clock3 className="w-4 h-4" />} rows={timelineRows} />
          <InfoBox title="라이프스타일" icon={<MapPin className="w-4 h-4" />} rows={lifestyleRows} />
          <InfoBox title="초중생케어" icon={<GraduationCap className="w-4 h-4" />} rows={schoolRows} />
        </div>

        <div className="border-t border-black/70 pt-8 mb-14">
          <h3 className="font-serif text-2xl mb-8">하우스인어스 추천 지표</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {statItems.map((item) => (
              <div key={item.label} className="text-center">
                <SemiGauge value={item.score} />
                <p className="mt-3 font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10">
          <h3 className="font-serif text-2xl mb-6">이곳에서의 일상</h3>
          <div className="relative border border-border">
            <img src={neighborhoodGallery[0]} alt="동네 이미지" className="h-[380px] w-full object-cover" />
            <button className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button variant="outline" className="justify-between border-[#b96243] text-[#b96243]" onClick={() => trackLeadGeneration("inquiry", "inquiry_submit", property.id)}>
            문의 남기기 <ChevronRight className="w-4 h-4" />
          </Button>
          <Button className="bg-[#b96243] hover:bg-[#a45338]" onClick={() => trackLeadGeneration("reservation", "specific_time", property.id)}>4월 5일 10시</Button>
          <Button className="bg-[#b96243] hover:bg-[#a45338] justify-between" onClick={() => trackLeadGeneration("reservation", "other_schedule", property.id)}>
            + 다른 일정 예약하기 <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="border-t border-black/70 pt-8">
          <h4 className="font-medium mb-5">문의하기</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="border border-border p-4 bg-card text-center text-sm">
              가족 맞춤 상담
            </div>
            <Button className="bg-[#b96243] hover:bg-[#a45338]" onClick={() => trackCTAClick("detail_guide", "contact_box", property.id)}>매물 상세 안내 받기</Button>
            <Button variant="outline" className="border-[#b96243] text-[#b96243]" onClick={() => trackCTAClick("view_by_my_condition", "contact_box", property.id)}>
              내 조건으로 다시 보기
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

const InfoBox = ({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: ReactNode;
  rows: [string, string][];
}) => (
  <div className="border border-[#e0dad2] bg-[#f8f5f1] p-5">
    <div className="flex items-center gap-2 text-[#b96243] mb-4">
      {icon}
      <h4 className="font-medium">{title}</h4>
    </div>
    <div className="space-y-2 text-sm">
      {rows.map(([name, value]) => (
        <div key={name} className="flex items-center justify-between border-b border-[#e5dfd6] pb-2">
          <span className="text-foreground/70">{name}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  </div>
);

const SemiGauge = ({ value }: { value: number }) => (
  <div className="mx-auto w-[150px] h-[76px] overflow-hidden">
    <div
      className="h-[150px] w-[150px] rounded-full"
      style={{
        background: `conic-gradient(#d19f8c ${value * 1.8}deg, #ead8ce ${value * 1.8}deg)`,
      }}
    >
      <div className="mx-auto mt-[24px] h-[102px] w-[102px] rounded-full bg-[#f4f1ed]" />
    </div>
  </div>
);

export default PropertyFiveDetail;
