import { useState, useEffect, useRef } from "react";
import Footer from "@/components/Footer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// ── Data ──────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: "agent",  num: "01", title: "공인중개사에게 이렇게 요청하세요" },
  { id: "direct", num: "02", title: "직거래 플랫폼에 직접 등록하기" },
  { id: "sns",    num: "03", title: "카카오톡·SNS·카페·블로그로 공유하기" },
] as const;

type SectionId = typeof TOC_ITEMS[number]["id"];

// ── Toc ───────────────────────────────────────────────────────────────────────

const Toc = ({ activeId }: { activeId: SectionId | "" }) => {
  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  return (
    <nav>
      <p className="editorial-subheading text-muted-foreground mb-5">목차</p>
      <ol className="flex flex-col gap-1">
        {TOC_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => go(e, item.id)}
              className={`flex items-baseline gap-3 py-1.5 text-[13px] no-underline transition-colors leading-snug ${
                activeId === item.id
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-serif text-[11px] text-muted-foreground/60 flex-shrink-0">
                {item.num}
              </span>
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────

const Section = ({
  id, num, label, title, children,
}: {
  id: string; num: string; label: string; title: string; children: React.ReactNode;
}) => (
  <section id={id} className="py-14 border-b border-border scroll-mt-10">
    <span className="editorial-subheading text-primary mb-5 block">
      {num} — {label}
    </span>
    <h2 className="font-serif text-2xl md:text-3xl font-medium text-foreground leading-tight mb-4">
      {title}
    </h2>
    <div className="w-10 h-0.5 bg-primary mb-8" />
    {children}
  </section>
);

// ── Platform card ─────────────────────────────────────────────────────────────

const PlatformCard = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="flex items-center gap-4 px-5 py-4 bg-secondary/40 border border-border rounded-sm">
    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-base">
      {icon}
    </div>
    <div>
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>
    </div>
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const GuideDelivery = () => {
  useDocumentTitle("집소개서 활용 가이드 | 하우스인어스");
  const [activeId, setActiveId] = useState<SectionId | "">("");
  const [tocFixed, setTocFixed] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id as SectionId);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTocFixed(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  const sections = (
    <>
      <Section id="agent" num="01" label="공인중개사" title="공인중개사에게 이렇게 요청하세요">
        <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
          집소개서를 공인중개사에게 전달하고, 아래와 같이 구체적으로 요청해보세요.
        </p>
        <ul className="flex flex-col gap-3 mb-8">
          {[
            "네이버부동산 등 주요 부동산 플랫폼의 매물 정보에 사진과 설명 문구 활용",
            "중개사무소 내 비치 또는 방문 손님에게 파일 링크 공유",
            "문의 고객에게 자료 전달",
            "방문 전 안내 자료로 활용",
            "중개사 단체 대화방 및 매물 공유 커뮤니티에 첨부",
            "공동중개 시 자료 포함",
            "중개사 개인 블로그 또는 홍보 채널에 활용",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-[15px] text-muted-foreground leading-relaxed">
              <span className="mt-[9px] w-1 h-1 rounded-full bg-primary/50 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <div className="space-y-4 text-[15px] text-muted-foreground leading-relaxed">
          <p>
            최대한 많은 플랫폼에 등록해달라고 요청하시고, 집소개서에 담긴 고객님 집의 매력 포인트가 잘 전달되는지도 함께 확인해보세요.
          </p>
          <p>
            중개사의 네트워크, 개인 블로그, 지역 커뮤니티 등 기존 홍보 인프라를 최대한 활용하도록 요청하시는 것도 좋습니다.
          </p>
        </div>
      </Section>

      <Section id="direct" num="02" label="직접 등록하기" title="직거래 플랫폼에 직접 등록하기">
        <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
          중개사를 통하지 않더라도, 집주인이 직접 매물을 등록할 수 있습니다. 아래 플랫폼별 가이드를 참고하세요.
        </p>
        <div className="flex flex-col gap-2.5">
          <PlatformCard icon="🐙" title="피터팬 방 구하기에 매물 등록하기" desc="직거래 전문 플랫폼" />
          <PlatformCard icon="🏠" title="네이버부동산으로 매물 노출 확대하기" desc="국내 최대 부동산 플랫폼" />
          <PlatformCard icon="🥕" title="당근 부동산에서 동네 기반 노출 강화하기" desc="동네 이웃 중심 직거래" />
        </div>
      </Section>

      <Section id="sns" num="03" label="SNS · 지인 공유" title="카카오톡·SNS·카페·블로그로 공유하기">
        <div className="space-y-4 text-[15px] text-muted-foreground leading-relaxed mb-10">
          <p>
            집소개서는 링크나 이미지 형태로 공유하기 좋습니다.
            카카오톡, SNS, 카페, 블로그 등 다양한 채널에 활용하면 매물의 분위기와 장점을 더 쉽게 전달할 수 있습니다.
          </p>
          <p>
            카카오톡으로는 집소개서 링크를 간단히 공유해보세요.
            관심을 보이는 분에게 긴 설명을 반복하지 않아도, 집의 특징을 한 번에 전달할 수 있습니다.
          </p>
          <p>
            SNS, 카페, 블로그에 올릴 때는 집소개서 이미지와 함께 해시태그를 덧붙여보세요.
            집의 위치, 분위기, 주요 장점, 추천 대상이 함께 드러나도록 작성하면 더 좋습니다.
          </p>
        </div>
        <p className="editorial-subheading text-muted-foreground mb-4">예시 해시태그</p>
        <div className="flex flex-wrap gap-2.5">
          {["#단독주택매매", "#숲세권", "#자연친화주택", "#테라스하우스", "#마당있는집"].map((tag) => (
            <span
              key={tag}
              className="px-4 py-2 border border-border rounded-full text-[13px] text-muted-foreground bg-background"
            >
              {tag}
            </span>
          ))}
        </div>
      </Section>

      {/* 핵심 정리 — card, centered */}
      <div className="py-14">
        <div className="rounded-sm px-8 py-10 bg-foreground text-primary-foreground">
          <span className="editorial-subheading text-primary-foreground/50 mb-5 block">핵심 정리</span>
          <h2 className="font-serif text-2xl md:text-3xl font-medium leading-tight mb-4">
            이 자료는 설명을 대신하는 도구입니다.
          </h2>
          <div className="w-10 h-0.5 bg-primary mb-8" />
          <div className="text-[15px] text-primary-foreground/70 leading-relaxed space-y-4 max-w-[520px] mb-8">
            <p>
              가격만으로는 설명되지 않는 햇빛이 머무는 시간, 마당의 쓰임, 창밖의 초록, 가족이 함께 머무는 장면까지.
            </p>
            <p>
              고객님의 집을 단순한 매물이 아니라, 누군가의 취향과 생활이 담길 공간으로 소개해야 하는 모든 상황에서 자유롭게 사용해보세요.
            </p>
          </div>
          <div className="border-t border-primary-foreground/10 pt-6">
            <p className="text-[14px] text-primary-foreground/50 mb-1">
              사용하시다가 불편하신 점이나 더 필요하신 부분이 있으면 언제든지 알려주세요.
            </p>
            <a
              href="mailto:contact@paretolab.kr"
              className="text-[14px] text-primary hover:text-primary/80 transition-colors"
            >
              contact@paretolab.kr
            </a>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section ref={heroRef} className="py-20 md:py-28 border-b border-border">
        <div className="container mx-auto px-6 max-w-[960px]">
          <span className="editorial-subheading text-primary mb-5 block">활용 가이드</span>
          <h1 className="font-serif text-4xl md:text-5xl font-medium text-foreground leading-tight mb-6 break-keep">
            집소개서 활용 가이드
          </h1>
          <div className="w-12 h-0.5 bg-primary mb-8" />
          <div className="text-[15px] text-muted-foreground leading-relaxed space-y-4 max-w-[600px]">
            <p>정성껏 제작된 집소개서는 단순한 안내 자료가 아닙니다.</p>
            <p>
              공인중개사에게는 매물의 장점을 설득력 있게 전달하는 영업 자료가 되고,
              예비 매수자에게는 이 집에서의 생활을 구체적으로 그려보게 하는 소개 콘텐츠가 됩니다.
            </p>
            <p className="text-foreground">
              우리 집의 가치를 더 잘 전달하기 위한 단계별 활용법을 확인해보세요.
            </p>
          </div>
          <p className="editorial-subheading text-muted-foreground mt-8">읽는 데 약 5분</p>
        </div>
      </section>

      {/* Body */}
      <div className="container mx-auto px-6 max-w-[960px]">

        {/* PC: sidebar + content */}
        <div className="hidden md:grid md:grid-cols-[200px_1fr] md:gap-16">
          {/* Left column: shows TOC in-flow when hero visible, empty spacer when fixed */}
          <div className="pt-14">
            {!tocFixed && <Toc activeId={activeId} />}
          </div>
          <main className="pb-16">{sections}</main>
        </div>

        {/* Mobile: TOC inline (scrolls away), then content */}
        <div className="md:hidden">
          <div className="py-10 border-b border-border">
            <Toc activeId={activeId} />
          </div>
          <main className="pb-16">{sections}</main>
        </div>

      </div>

      {/* PC fixed TOC — only when hero is out of view */}
      {tocFixed && (
        <div
          className="hidden md:block fixed top-10 z-20 w-[200px]"
          style={{ left: "max(24px, calc(50vw - 480px + 24px))" }}
        >
          <Toc activeId={activeId} />
        </div>
      )}

      <Footer />
    </div>
  );
};

export default GuideDelivery;
