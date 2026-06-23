import { useParams, Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useProperty } from "@/hooks/useProperties";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ArrowLeft, Printer, MapPin, Sparkles, Home, BarChart3, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFloorLabel } from "@/lib/floor";
import { parseCustomLayout } from "@/pages/admin/property/LayoutBuilder";
import type {
  EvaluationMetric,
  HousePlanSpecRow,
  InteriorPhoto,
  LifestyleScenario,
  NearbyCategory,
  Property,
} from "@/data/properties";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

const cleanPlaceName = (name: string): string => {
  const sep = name.indexOf(" · ");
  return sep !== -1 ? name.substring(sep + 3) : name;
};

const Footer = ({ url, page }: { url: string; page: string }) => (
  <div className="flex justify-between items-end mt-auto pt-4 shrink-0">
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-muted-foreground tracking-wider uppercase">
        하우스인어스
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] text-muted-foreground hover:underline"
      >
        https://paretolab.kr
      </a>
    </div>
    <span className="text-[10px] text-muted-foreground">{page}</span>
  </div>
);

// Shared photo label overlay
const PhotoLabel = ({ n, room, caption }: { n: number; room: string; caption: string }) => (
  <span className="absolute bottom-2 left-2 text-[10px] text-white/90 bg-black/40 px-2 py-0.5 rounded-sm">
    #{n} {room}{caption ? ` · ${caption}` : ""}
  </span>
);

// Photos area: hero + optional grid below (1 or 3 photos passed from caller)
const FloorPhotos = ({ photos, startIndex }: { photos: InteriorPhoto[]; startIndex: number }) => {
  const [hero, ...rest] = photos;
  const equal = photos.length === 2;
  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {hero && (
        <div className={`relative overflow-hidden rounded-sm min-h-0 ${equal ? "flex-1" : "flex-[1.2]"}`}>
          <img src={hero.swapped && hero.beforeSrc ? hero.beforeSrc : hero.src} alt={hero.caption} className="w-full h-full object-cover" />
          <PhotoLabel n={startIndex + 1} room={hero.room} caption={hero.caption} />
        </div>
      )}
      {rest.length > 0 && (
        <div
          className={`grid gap-3 min-h-0 ${equal ? "flex-1" : "flex-[0.8]"}`}
          style={{ gridTemplateColumns: `repeat(${rest.length}, minmax(0, 1fr))` }}
        >
          {rest.map((p, i) => (
            <div key={i} className="relative overflow-hidden rounded-sm min-h-0">
              <img src={p.swapped && p.beforeSrc ? p.beforeSrc : p.src} alt={p.caption} className="w-full h-full object-cover" />
              <PhotoLabel n={startIndex + i + 2} room={p.room} caption={p.caption} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Page with floorplan (1 or 3 photos — determined by caller)
const FloorPage = ({
  floor, photos, allFloorPhotos, startIndex, floorplanSrc, pageNum, utmUrl,
}: {
  floor: number; photos: InteriorPhoto[]; allFloorPhotos: InteriorPhoto[]; startIndex: number;
  floorplanSrc: string; pageNum: string; utmUrl: string;
}) => (
  <div className="print-page px-10 py-10 flex flex-col">
    <div className="flex items-baseline gap-3 mb-1">
      <h2 className="font-serif text-2xl font-medium text-foreground">공간 둘러보기</h2>
      <span className="text-xs tracking-[0.15em] uppercase text-primary font-medium">
        {formatFloorLabel(floor)}
      </span>
    </div>
    <div className="w-12 h-0.5 bg-primary mb-5" />

    <div className="bg-secondary/30 rounded-sm p-4 mb-4 shrink-0 flex justify-center">
      <div className="relative inline-block">
        <img
          src={floorplanSrc}
          alt={`${formatFloorLabel(floor)} 평면도`}
          className="block max-h-[calc(30vh-2rem)] max-w-full"
        />
        {allFloorPhotos.map((p, i) => {
          const [rx, ry, rw, rh] = p.floorplanRect;
          if (!rw || !rh) return null;
          const cx = rx + rw / 2;
          const cy = ry + rh / 2;
          return (
            <div
              key={i}
              className="absolute pointer-events-none flex items-center"
              style={{
                left: `${cx}%`,
                top: `${cy}%`,
                transform: "translateY(-50%)",
              }}
            >
              <span className="text-[8px] font-medium leading-tight text-white bg-primary/80 px-1 py-0.5 rounded-sm whitespace-nowrap">
                #{startIndex + i + 1} {p.room}
              </span>
            </div>
          );
        })}
      </div>
    </div>

    <FloorPhotos photos={photos} startIndex={startIndex} />
    <Footer url={utmUrl} page={pageNum} />
  </div>
);

// Continuation page: remaining photos for the same floor, no floorplan
const FloorContinuationPage = ({
  floor, photos, startIndex, pageNum, utmUrl,
}: {
  floor: number; photos: InteriorPhoto[]; startIndex: number;
  pageNum: string; utmUrl: string;
}) => (
  <div className="print-page px-10 py-10 flex flex-col">
    <span className="text-xs tracking-[0.15em] uppercase text-primary font-medium mb-4 shrink-0">
      {formatFloorLabel(floor)}
    </span>
    <div className="w-8 h-0.5 bg-primary mb-5 shrink-0" />
    <FloorPhotos photos={photos} startIndex={startIndex} />
    <Footer url={utmUrl} page={pageNum} />
  </div>
);

export const PropertyPrintBody = ({ property }: { property: Property }) => {
  const utmUrl = `https://paretolab.kr/properties/${property.id}?utm_source=portfolio_pdf&utm_medium=pdf&utm_campaign=property`;

  // Group interior photos by floor (sorted by floor number).
  const photos = property.interiorPhotos ?? [];
  const photoIndexMap = new Map<InteriorPhoto, number>(photos.map((p, i) => [p, i]));
  const photosByFloor = new Map<number, InteriorPhoto[]>();
  for (const p of photos) {
    const arr = photosByFloor.get(p.floor) ?? [];
    arr.push(p);
    photosByFloor.set(p.floor, arr);
  }
  const sortedFloors = Array.from(photosByFloor.keys()).sort((a, b) => a - b);

  // Pre-compute floor structure: how many photos on floorplan page vs continuation pages
  const floorStructure = sortedFloors.flatMap((floor) => {
    const fp = property.floorplans?.[String(floor)];
    if (!fp) return [];
    const allPhotos = photosByFloor.get(floor) ?? [];
    if (allPhotos.length === 0) return [];
    // Floorplan page: ≤4 total → 1 photo, >4 → 3 photos
    const photosOnFloorPage = allPhotos.length <= 4 ? 1 : 3;
    const floorPhotos = allPhotos.slice(0, photosOnFloorPage);
    // Continuation pages: groups of 3; if remainder is 1 and n≥4, split last 4 into [2,2]
    const remaining = allPhotos.slice(photosOnFloorPage);
    const continuationBatches: InteriorPhoto[][] = [];
    const rn = remaining.length;
    if (rn > 0) {
      const r = rn % 3;
      if (r === 0) {
        for (let i = 0; i < rn; i += 3) continuationBatches.push(remaining.slice(i, i + 3));
      } else if (r === 2) {
        for (let i = 0; i < rn - 2; i += 3) continuationBatches.push(remaining.slice(i, i + 3));
        continuationBatches.push(remaining.slice(rn - 2));
      } else {
        // r === 1: lone photo at end — if only 1 total accept it, else split last 4 into [2,2]
        if (rn === 1) {
          continuationBatches.push(remaining.slice(0, 1));
        } else {
          const threes = (rn - 4) / 3;
          for (let i = 0; i < threes; i++) continuationBatches.push(remaining.slice(i * 3, i * 3 + 3));
          const off = threes * 3;
          continuationBatches.push(remaining.slice(off, off + 2));
          continuationBatches.push(remaining.slice(off + 2, off + 4));
        }
      }
    }
    const globalStart = photoIndexMap.get(allPhotos[0]) ?? 0;
    return [{ floor, fp, allPhotos, floorPhotos, continuationBatches, globalStart }];
  });

  const totalFloorPages = floorStructure.reduce(
    (sum, d) => sum + 1 + d.continuationBatches.length, 0,
  );

  const housePlanRows: HousePlanSpecRow[] = property.housePlanSpecs
    ? [...property.housePlanSpecs.main, ...property.housePlanSpecs.collapsed]
    : [];
  const metrics: EvaluationMetric[] = property.evaluationMetrics ?? [];
  const nearbyCats: NearbyCategory[] = property.nearbyPlaces ?? [];
  const scenarios: LifestyleScenario[] = property.lifestyleScenarios ?? [];

  // ── Nearby pagination ─────────────────────────────────────────────────────
  // Split nearby categories into explicit pages so screen preview == print output.
  // Heights are CSS px (1mm ≈ 3.78px). 297mm page with py-10(40px×2) = 1042px usable.
  const PG = 1042;
  const METRICS_H = 232;   // header(48) + gauge-grid(160) + mb-6(24)
  const SEP_H = 25;        // border-t(1) + mb-6(24)
  const COL_HDR_H = 60;    // section icon+title with mb-5
  const CAT_LBL_H = 32;    // category label row
  const PLACE_ROW_H = 32;  // each place row (py-2 + leading-5)
  const CAT_GAP_H = 12;    // space-y-3 between categories

  const catH = (cat: NearbyCategory) =>
    CAT_LBL_H + cat.places.length * PLACE_ROW_H + CAT_GAP_H;

  // How much vertical space is left for the nearby right-column on the first page
  // (after metrics + separator, with HousePlan on the left column)
  const firstPageNearbyBudget =
    PG - (metrics.length > 0 ? METRICS_H + SEP_H : 0) - COL_HDR_H;

  // Greedy split: pack as many categories as fit per page
  const nearbySplit: NearbyCategory[][] = [];
  if (nearbyCats.length > 0) {
    let page: NearbyCategory[] = [];
    let used = 0;
    let budget = firstPageNearbyBudget;
    for (const cat of nearbyCats) {
      const h = catH(cat);
      if (used + h > budget && page.length > 0) {
        nearbySplit.push(page);
        page = [cat];
        used = h;
        budget = PG - COL_HDR_H; // continuation pages have full height
      } else {
        page.push(cat);
        used += h;
      }
    }
    if (page.length > 0) nearbySplit.push(page);
  }

  // Base page number for the HousePlan/Nearby section
  const hpBasePageNum = 3 + totalFloorPages;
  // Number of pages consumed by HousePlan+Nearby section
  const hpPageCount = housePlanRows.length > 0 || nearbyCats.length > 0
    ? Math.max(1, nearbySplit.length)
    : 0;
  const lifestylePageNum = hpBasePageNum + hpPageCount;

  // Compute lifestyle overflow for second page (preset layouts only)
  const lifestyleLayoutRaw = property.lifestyleLayout ?? "2-side";
  const lifestyleCustom = parseCustomLayout(lifestyleLayoutRaw);
  const lifestylePhotoCount = !lifestyleCustom
    ? (lifestyleLayoutRaw.startsWith("1") ? 1 : lifestyleLayoutRaw.startsWith("2") ? 2 : lifestyleLayoutRaw.startsWith("3") ? 3 : 4)
    : null;
  const lifestyleOverflow = lifestylePhotoCount !== null && scenarios.length > lifestylePhotoCount
    ? scenarios.slice(lifestylePhotoCount)
    : [];
  const lifestylePage2Num = lifestylePageNum + 1;

  return (
    <>
      {/* PAGE 1: Cover */}
      <div className="print-page">
        <div className="h-[55%] relative overflow-hidden">
          <img src={property.image} alt={property.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        </div>
        <div className="px-10 pt-8 pb-6 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs tracking-[0.2em] uppercase text-primary font-medium">
                {property.location}
              </span>
            </div>
            <h1 className="font-serif text-4xl font-medium text-foreground leading-tight mb-2">
              {property.title}
            </h1>
            {property.subtitle && (
              <p className="text-base text-muted-foreground italic mb-6">{property.subtitle}</p>
            )}
            <h2 className="font-serif text-2xl font-medium text-foreground mb-4">
              {formatPrice(property.price)}{" "}
              <span className="text-base text-muted-foreground font-normal">(매매)</span>
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground min-w-[4.5rem]">위치</span>
                <span className="text-foreground/80">{property.location}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground min-w-[4.5rem]">대지 면적</span>
                <span className="text-foreground/80">{property.specs?.landArea ?? "-"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground min-w-[4.5rem]">사용승인</span>
                <span className="text-foreground/80">{property.specs?.builtYear ?? "-"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground min-w-[4.5rem]">실내 면적</span>
                <span className="text-foreground/80">{property.specs?.indoorArea ?? "-"}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground min-w-[4.5rem]">방/화장실</span>
                <span className="text-foreground/80">
                  방 {property.specs?.beds ?? "-"}개 / 화장실 {property.specs?.baths ?? "-"}개
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground min-w-[4.5rem]">설계구조</span>
                <span className="text-foreground/80">{property.specs?.scale ?? "-"}</span>
              </div>
            </div>
          </div>

          {property.lifestyleHighlights.length > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-6 pt-6 border-t border-border">
              {property.lifestyleHighlights.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                  <Sparkles className="w-3 h-3 text-primary flex-shrink-0" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}

          <Footer url={utmUrl} page="01" />
        </div>
      </div>

      {/* PAGE 2: Story */}
      {property.lifestyleStory && (
        property.lifestyleStoryOverlay && property.portfolioThumb ? (
          /* Overlay mode: full-page image with text on top */
          <div className="print-page relative overflow-hidden">
            <img
              src={property.portfolioThumb}
              alt={property.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-white/50" />
            <div className="absolute inset-0 px-10 pt-10 pb-16">
              <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
                이 집의 이야기
              </h2>
              <div className="w-12 h-0.5 bg-primary mb-6" />
              <div className="columns-3 gap-6 text-[12px] text-foreground/80 leading-relaxed">
                {property.lifestyleStory.split("\n\n").map((p, i) => (
                  <p key={i} className="mb-3 break-inside-avoid">
                    {p}
                  </p>
                ))}
              </div>
            </div>
            <div className="absolute bottom-3 left-10 right-10 flex justify-between items-end">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/70 tracking-wider uppercase">
                  하우스인어스
                </span>
                <a
                  href={utmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/70 hover:underline"
                >
                  https://paretolab.kr
                </a>
              </div>
              <span className="text-[10px] text-white/70">02</span>
            </div>
          </div>
        ) : (
          /* Default mode: text above, image below */
          <div className="print-page flex flex-col">
            <div className="px-10 pt-10 pb-6">
              <h2 className="font-serif text-2xl font-medium text-foreground mb-1">
                이 집의 이야기
              </h2>
              <div className="w-12 h-0.5 bg-primary mb-6" />
              <div className="columns-3 gap-6 text-[12px] text-foreground/80 leading-relaxed">
                {property.lifestyleStory.split("\n\n").map((p, i) => (
                  <p key={i} className="mb-3 break-inside-avoid">
                    {p}
                  </p>
                ))}
              </div>
            </div>

            {property.portfolioThumb && (
              <div className="flex-1 relative overflow-hidden mt-auto">
                <img
                  src={property.portfolioThumb}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="absolute bottom-3 left-10 right-10 flex justify-between items-end">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/70 tracking-wider uppercase">
                  하우스인어스
                </span>
                <a
                  href={utmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-white/70 hover:underline"
                >
                  https://paretolab.kr
                </a>
              </div>
              <span className="text-[10px] text-white/70">02</span>
            </div>
          </div>
        )
      )}

      {/* Floor pages: floorplan page + continuation pages per floor */}
      {(() => {
        let pn = 3;
        return floorStructure.flatMap((d) => {
          const pages: React.ReactNode[] = [];
          pages.push(
            <FloorPage
              key={`fp-${d.floor}`}
              floor={d.floor}
              photos={d.floorPhotos}
              allFloorPhotos={d.allPhotos}
              startIndex={d.globalStart}
              floorplanSrc={d.fp.src}
              pageNum={String(pn++).padStart(2, "0")}
              utmUrl={utmUrl}
            />,
          );
          let offset = d.floorPhotos.length;
          for (const batch of d.continuationBatches) {
            pages.push(
              <FloorContinuationPage
                key={`cont-${d.floor}-${offset}`}
                floor={d.floor}
                photos={batch}
                startIndex={d.globalStart + offset}
                pageNum={String(pn++).padStart(2, "0")}
                utmUrl={utmUrl}
              />,
            );
            offset += batch.length;
          }
          return pages;
        });
      })()}

      {/* Page N: Metrics + HousePlan + Nearby[0] — all on one explicit A4 page */}
      {(metrics.length > 0 || housePlanRows.length > 0 || nearbyCats.length > 0) && (
        <div className="print-page px-10 py-10 flex flex-col">
          {metrics.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-6 h-6 bg-primary/10 rounded-sm flex items-center justify-center">
                  <BarChart3 className="w-3 h-3 text-primary" />
                </div>
                <h2 className="text-xs tracking-[0.15em] uppercase text-primary font-medium">
                  하우스인어스 산정 지표
                </h2>
              </div>
              <div
                className="grid gap-6 mb-6"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(metrics.length, 4)}, minmax(0, 1fr))`,
                }}
              >
                {metrics.map((m, i) => (
                  <div key={i} className="flex flex-col items-center text-center">
                    <div className="relative w-[72px] h-[72px]">
                      <svg viewBox="0 0 80 80" className="w-full h-full">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--border))" strokeWidth="10" opacity={0.3} />
                        <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(m.score / 100) * 201} 201`} transform="rotate(-90 40 40)" opacity={0.6} />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-serif text-xl font-medium text-primary">
                        {m.score}
                      </span>
                    </div>
                    <h3 className="font-serif text-[13px] font-medium text-foreground mt-3 mb-2">{m.title}</h3>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{m.description}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {(housePlanRows.length > 0 || nearbySplit[0]) && (
            <>
              {metrics.length > 0 && <div className="border-t border-border mb-6" />}
              <div className="grid grid-cols-2 gap-10">
                {housePlanRows.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-6 h-6 bg-primary/10 rounded-sm flex items-center justify-center">
                        <Home className="w-3 h-3 text-primary" />
                      </div>
                      <h2 className="text-xs tracking-[0.15em] uppercase text-primary font-medium">House Plan</h2>
                    </div>
                    <div className="border-l-2 border-border pl-5">
                      {housePlanRows.map((s, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 py-2 leading-5 border-b border-border/40 last:border-0">
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                          <span className="text-xs text-foreground">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {nearbySplit[0] && (
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-6 h-6 bg-primary/10 rounded-sm flex items-center justify-center">
                        <MapPin className="w-3 h-3 text-primary" />
                      </div>
                      <h2 className="text-xs tracking-[0.15em] uppercase text-primary font-medium">주변 인프라</h2>
                    </div>
                    <div className="space-y-3">
                      {nearbySplit[0].map((cat, i) => (
                        <div key={i}>
                          <span className="text-[13px] font-medium text-foreground block mb-1">{cat.label}</span>
                          <div className="border-l-2 border-border pl-5">
                            {cat.places.map((p, pi) => (
                              <div key={pi} className="flex items-baseline justify-between gap-3 py-2 leading-5 border-b border-border/40 last:border-0">
                                <span className="text-xs text-foreground">{cleanPlaceName(p.name)}</span>
                                {p.distance && <span className="text-xs text-muted-foreground whitespace-nowrap">{p.distance}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Footer url={utmUrl} page={String(hpBasePageNum).padStart(2, "0")} />
        </div>
      )}

      {/* Pages N+1, N+2 …: Nearby overflow pages, right column only */}
      {nearbySplit.slice(1).map((catPage, idx) => (
        <div key={idx} className="print-page px-10 py-10 flex flex-col">
          <div className="grid grid-cols-2 gap-10">
            <div />
            <div className="space-y-3">
              {catPage.map((cat, i) => (
                <div key={i}>
                  <span className="text-[13px] font-medium text-foreground block mb-1">{cat.label}</span>
                  <div className="border-l-2 border-border pl-5">
                    {cat.places.map((p, pi) => (
                      <div key={pi} className="flex items-baseline justify-between gap-3 py-2 leading-5 border-b border-border/40 last:border-0">
                        <span className="text-xs text-foreground">{cleanPlaceName(p.name)}</span>
                        {p.distance && <span className="text-xs text-muted-foreground whitespace-nowrap">{p.distance}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Footer url={utmUrl} page={String(hpBasePageNum + 1 + idx).padStart(2, "0")} />
        </div>
      ))}

      {/* Lifestyle scenarios — layout selected by admin */}
      {scenarios.length >= 1 && (() => {
        const layoutRaw = property.lifestyleLayout ?? "2-side";
        const customLayout = parseCustomLayout(layoutRaw);

        // ── Custom (drawn) layout ──────────────────────────────
        if (customLayout) {
          const badgePos = (pos: string): React.CSSProperties =>
            pos === "tl" ? { top: 6, left: 6 } :
            pos === "tr" ? { top: 6, right: 6 } :
            pos === "br" ? { bottom: 6, right: 6 } :
            { bottom: 6, left: 6 };

          const renderCustomPage = (
            pageSlots: typeof customLayout.slots,
            captionArea: typeof customLayout.captionArea,
            pageNum: string,
          ) => {
            const activeSlots = pageSlots.filter((slot) => scenarios[slot.photoIdx]);
            return (
              <div className="print-page px-12 py-10 flex flex-col">
                <h2 className="font-serif text-2xl font-medium text-foreground mb-2">이곳에서의 일상</h2>
                <div className="w-12 h-0.5 bg-primary mb-6" />
                <div className="flex-1 min-h-0 relative">
                  {activeSlots.map((slot) => {
                    const s = scenarios[slot.photoIdx];
                    const showBadge = slot.caption !== "none";
                    return (
                      <div
                        key={slot.id}
                        className="absolute overflow-hidden rounded-sm"
                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
                      >
                        <img src={s.src} alt={s.description} className="w-full h-full object-cover" />
                        {showBadge && (
                          <span
                            className="absolute font-serif text-[10px] font-semibold text-white bg-black/40 px-1 py-0.5 rounded-sm leading-none"
                            style={badgePos(slot.caption)}
                          >
                            {slot.photoIdx + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {captionArea && activeSlots.length > 0 && (
                    <div
                      className="absolute overflow-hidden flex flex-wrap items-start content-start gap-x-3 gap-y-0.5 p-1.5"
                      style={{
                        left: `${captionArea.x}%`,
                        top: `${captionArea.y}%`,
                        width: `${captionArea.w}%`,
                        height: `${captionArea.h}%`,
                      }}
                    >
                      {activeSlots.map((slot) => {
                        const s = scenarios[slot.photoIdx];
                        return (
                          <div key={slot.id} className="flex items-baseline gap-1 min-w-0">
                            <span className="font-serif text-[10px] font-semibold text-foreground shrink-0">{slot.photoIdx + 1}</span>
                            <span className="text-[9px] text-muted-foreground leading-snug">{s.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {!captionArea && activeSlots.length > 0 && (
                  <div className="shrink-0 pt-5 flex flex-wrap gap-x-5 gap-y-1">
                    {activeSlots.map((slot) => {
                      const s = scenarios[slot.photoIdx];
                      return (
                        <div key={slot.id} className="flex items-baseline gap-1 min-w-0">
                          <span className="font-serif text-[11px] font-semibold text-foreground shrink-0">{slot.photoIdx + 1}</span>
                          <span className="text-[10px] text-muted-foreground leading-snug">{s.description}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Footer url={utmUrl} page={pageNum} />
              </div>
            );
          };

          return (
            <>
              {renderCustomPage(customLayout.slots, customLayout.captionArea, String(lifestylePageNum).padStart(2, "0"))}
              {customLayout.page2 && customLayout.page2.slots.length > 0 &&
                renderCustomPage(customLayout.page2.slots, customLayout.page2.captionArea, String(lifestylePage2Num).padStart(2, "0"))
              }
            </>
          );
        }

        // ── Preset layout ──────────────────────────────────────
        const layout = layoutRaw;
        const photoCount =
          layout.startsWith("1") ? 1 :
          layout.startsWith("2") ? 2 :
          layout.startsWith("3") ? 3 : 4;
        const ss = scenarios.slice(0, photoCount);

        const Photo = ({ s, n }: { s: LifestyleScenario; n: number }) => (
          <div className="relative overflow-hidden rounded-sm min-h-0 w-full h-full">
            <img src={s.src} alt={s.description} className="w-full h-full object-cover" />
            <span className="absolute bottom-2 left-2 font-serif text-[11px] font-medium text-white/90 bg-black/35 px-1.5 py-0.5 rounded-sm">
              {n}
            </span>
          </div>
        );

        const CaptionRow = ({ cols }: { cols: number }) => (
          <div
            className="shrink-0 pt-5 grid gap-x-6"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
          >
            {ss.map((s, i) => (
              <div key={i} className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-serif text-[11px] font-semibold text-foreground shrink-0">{i + 1}</span>
                <span className="text-[10px] text-muted-foreground leading-snug">{s.description}</span>
              </div>
            ))}
          </div>
        );

        // Photo area is fixed at 62% of page height — remaining space becomes white margin before footer
        const photoAreaStyle = { height: "62%" };

        return (
          <div className="print-page px-12 py-10 flex flex-col">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">이곳에서의 일상</h2>
            <div className="w-12 h-0.5 bg-primary mb-6" />

            {/* 1-full: single photo */}
            {layout === "1-full" && ss.length >= 1 && (
              <>
                <div className="shrink-0" style={photoAreaStyle}><Photo s={ss[0]} n={1} /></div>
                <CaptionRow cols={1} />
              </>
            )}

            {/* 2-stack: large top (58%) + smaller bottom (42%) */}
            {layout === "2-stack" && ss.length >= 2 && (
              <>
                <div className="shrink-0 flex flex-col gap-4" style={photoAreaStyle}>
                  <div className="flex-[1.4] min-h-0"><Photo s={ss[0]} n={1} /></div>
                  <div className="flex-1 min-h-0"><Photo s={ss[1]} n={2} /></div>
                </div>
                <CaptionRow cols={2} />
              </>
            )}

            {/* 2-side: two equal columns */}
            {layout === "2-side" && ss.length >= 2 && (
              <>
                <div className="shrink-0 grid grid-cols-2 gap-4" style={photoAreaStyle}>
                  {ss.map((s, i) => <Photo key={i} s={s} n={i + 1} />)}
                </div>
                <CaptionRow cols={2} />
              </>
            )}

            {/* 3-hero: large top (55%) + two equal columns below */}
            {(layout === "3-hero" || layout === "3-row") && ss.length >= 3 && (
              <>
                <div className="shrink-0 flex flex-col gap-4" style={photoAreaStyle}>
                  <div className="flex-[1.2] min-h-0"><Photo s={ss[0]} n={1} /></div>
                  <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
                    <Photo s={ss[1]} n={2} />
                    <Photo s={ss[2]} n={3} />
                  </div>
                </div>
                <CaptionRow cols={3} />
              </>
            )}

            {/* 3-col: three equal columns */}
            {layout === "3-col" && ss.length >= 3 && (
              <>
                <div className="shrink-0 grid grid-cols-3 gap-4" style={photoAreaStyle}>
                  {ss.map((s, i) => <Photo key={i} s={s} n={i + 1} />)}
                </div>
                <CaptionRow cols={3} />
              </>
            )}

            {/* 4-grid: 2×2 */}
            {layout === "4-grid" && ss.length >= 4 && (
              <>
                <div className="shrink-0 grid grid-cols-2 grid-rows-2 gap-4" style={photoAreaStyle}>
                  {ss.map((s, i) => <Photo key={i} s={s} n={i + 1} />)}
                </div>
                <CaptionRow cols={4} />
              </>
            )}

            {/* 4-hero: large top (50%) + three equal columns below */}
            {(layout === "4-hero" || layout === "2-hero") && ss.length >= Math.min(photoCount, 4) && (
              <>
                <div className="shrink-0 flex flex-col gap-4" style={photoAreaStyle}>
                  <div className="flex-1 min-h-0"><Photo s={ss[0]} n={1} /></div>
                  <div className="flex-1 min-h-0 grid grid-cols-3 gap-4">
                    {ss.slice(1, 4).map((s, i) => <Photo key={i} s={s} n={i + 2} />)}
                  </div>
                </div>
                <CaptionRow cols={ss.length} />
              </>
            )}

            <Footer url={utmUrl} page={String(lifestylePageNum).padStart(2, "0")} />
          </div>
        );
      })()}

      {/* Lifestyle overflow — second page for preset layouts when scenarios exceed page 1 */}
      {lifestyleOverflow.length > 0 && (() => {
        const ov = lifestyleOverflow;
        const n = ov.length;

        const Photo = ({ s, globalN }: { s: LifestyleScenario; globalN: number }) => (
          <div className="relative overflow-hidden rounded-sm min-h-0 w-full h-full">
            <img src={s.src} alt={s.description} className="w-full h-full object-cover" />
            <span className="absolute bottom-2 left-2 font-serif text-[11px] font-medium text-white/90 bg-black/35 px-1.5 py-0.5 rounded-sm">
              {globalN}
            </span>
          </div>
        );

        const startN = lifestylePhotoCount! + 1;
        const photoAreaStyle = { height: "62%" };

        return (
          <div className="print-page px-12 py-10 flex flex-col">
            <h2 className="font-serif text-2xl font-medium text-foreground mb-2">이곳에서의 일상</h2>
            <div className="w-12 h-0.5 bg-primary mb-6" />

            {n === 1 && (
              <div className="shrink-0" style={photoAreaStyle}>
                <Photo s={ov[0]} globalN={startN} />
              </div>
            )}
            {n === 2 && (
              <div className="shrink-0 grid grid-cols-2 gap-4" style={photoAreaStyle}>
                {ov.map((s, i) => <Photo key={i} s={s} globalN={startN + i} />)}
              </div>
            )}
            {n === 3 && (
              <div className="shrink-0 grid grid-cols-3 gap-4" style={photoAreaStyle}>
                {ov.map((s, i) => <Photo key={i} s={s} globalN={startN + i} />)}
              </div>
            )}
            {n >= 4 && (
              <div className="shrink-0 grid grid-cols-2 grid-rows-2 gap-4" style={photoAreaStyle}>
                {ov.slice(0, 4).map((s, i) => <Photo key={i} s={s} globalN={startN + i} />)}
              </div>
            )}

            <div className="shrink-0 pt-5 flex flex-wrap gap-x-5 gap-y-1">
              {ov.slice(0, 4).map((s, i) => (
                <div key={i} className="flex items-baseline gap-1 min-w-0">
                  <span className="font-serif text-[11px] font-semibold text-foreground shrink-0">{startN + i}</span>
                  <span className="text-[10px] text-muted-foreground leading-snug">{s.description}</span>
                </div>
              ))}
            </div>

            <Footer url={utmUrl} page={String(lifestylePage2Num).padStart(2, "0")} />
          </div>
        );
      })()}
    </>
  );
};

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const PropertyPrint = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const birthdate = token && id
    ? (searchParams.get("birthdate") ?? localStorage.getItem(`houseinus__delivery__${id}`) ?? undefined)
    : undefined;
  const { property, isLoading } = useProperty(id, { token, birthdate });
  useDocumentTitle(property ? `${property.title} 인쇄용 | 하우스인어스` : undefined);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (!isLoading && property && searchParams.get("autoprint") === "1") {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [isLoading, property, searchParams]);

  if (isLoading)
    return (
      <div className="print-page flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  if (!property)
    return (
      <div className="print-page flex items-center justify-center">
        <p>매물을 찾을 수 없습니다</p>
      </div>
    );

  return (
    <div className="bg-muted min-h-screen print:bg-white" data-print-ready="true">
      <div className="no-print sticky top-0 z-50 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        {searchParams.get("from") === "preview" ? (
          <Link
            to={`/admin/properties/${id}/preview`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            미리보기로 돌아가기
          </Link>
        ) : (
          <Link
            to={`/properties/${id}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            상세 페이지로 돌아가기
          </Link>
        )}
        {isMobile() ? (
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "복사됨" : "Chrome으로 열기"}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              {copied ? "Chrome 주소창에 붙여넣어 주세요." : "링크를 복사합니다. Chrome에 붙여넣어 주세요."}
            </p>
          </div>
        ) : (
          <Button size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            프린트하기
          </Button>
        )}
      </div>
      <PropertyPrintBody property={property} />
    </div>
  );
};

export default PropertyPrint;
