import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Camera } from "lucide-react";
import { trackCTAClick } from "@/utils/analytics";
import { formatFloorLabel } from "@/lib/floor";
import type {
  FloorplanEntry,
  InteriorPhoto,
  Property,
} from "@/data/properties";
import InteriorPhotoCard from "@/components/InteriorPhotoCard";

const ZOOM_SCALE = 3;

/** Desktop floorplan with highlighted rect (percentage-positioned). */
const DesktopFloorplan = ({
  src,
  label,
  rect,
}: {
  src: string;
  label: string;
  rect: [number, number, number, number];
}) => (
  <div className="relative inline-block">
    <img
      src={src}
      alt={label}
      className="max-w-full max-h-[9.5rem] object-contain opacity-90 pointer-events-none"
    />
    <div
      className="absolute border-2 border-primary bg-primary/20 rounded-sm pointer-events-none"
      style={{
        left: `${rect[0]}%`,
        top: `${rect[1]}%`,
        width: `${rect[2]}%`,
        height: `${rect[3]}%`,
      }}
    />
  </div>
);

interface Props {
  property: Property;
}

const InteriorGallery = ({ property }: Props) => {
  const photos: InteriorPhoto[] = property.interiorPhotos ?? [];
  const floorplans: Record<string, FloorplanEntry> = property.floorplans ?? {};

  const [current, setCurrent] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  // ### HINT STATE — temporarily disabled
  // const [showHint, setShowHint] = useState(() => {
  //   try { return !localStorage.getItem("floorplan_hint_dismissed"); } catch { return false; }
  // });
  // const [hintNeverShow, setHintNeverShow] = useState(false);
  const floorplanRef = useRef<HTMLDivElement>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const thumbnailButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const preloadImagesRef = useRef<HTMLImageElement[]>([]);

  // Reset selection if photo list changes (e.g. property switch).
  useEffect(() => {
    setCurrent(0);
  }, [photos.length]);

  if (photos.length === 0) return null;

  const safeIdx = Math.min(current, photos.length - 1);
  const photo = photos[safeIdx];
  const floorplan = floorplans[String(photo.floor)];

  const prev = () => setCurrent((c) => (c - 1 + photos.length) % photos.length);
  const next = () => setCurrent((c) => (c + 1) % photos.length);

  useEffect(() => {
    const container = thumbnailStripRef.current;
    const targetIndex = Math.min(safeIdx + 1, photos.length - 1);
    const targetThumbnail = thumbnailButtonRefs.current[targetIndex];
    if (!container || !targetThumbnail) return;

    const frame = window.requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const thumbnailRect = targetThumbnail.getBoundingClientRect();
      const containerPaddingLeft =
        Number.parseFloat(window.getComputedStyle(container).paddingLeft) || 0;
      container.scrollTo({
        left:
          container.scrollLeft + thumbnailRect.left - containerRect.left - containerPaddingLeft,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [safeIdx, photos.length]);

  useEffect(() => {
    preloadImagesRef.current = [1, 2].map((offset) => {
      const image = new Image();
      image.decoding = "async";
      const p = photos[(safeIdx + offset) % photos.length];
      image.src = p.swapped && p.beforeSrc ? p.beforeSrc : p.src;
      return image;
    });
  }, [safeIdx, photos]);

  const updateDesktopZoomPos = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  }, []);

  const handleFloorplanPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse") return;
      setIsZooming(true);
      updateDesktopZoomPos(e);
    },
    [updateDesktopZoomPos],
  );

  const handleFloorplanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsZooming(true);
      updateDesktopZoomPos(e);
    },
    [updateDesktopZoomPos],
  );

  const handleFloorplanPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" && !isZooming) return;
      updateDesktopZoomPos(e);
    },
    [isZooming, updateDesktopZoomPos],
  );

  const handleFloorplanPointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (e.pointerType !== "mouse") setIsZooming(false);
  }, []);

  const handleFloorplanPointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setIsZooming(false);
  }, []);

  const [mobileZoomIndex, setMobileZoomIndex] = useState<number | null>(null);
  const [mobileZoomPos, setMobileZoomPos] = useState({ x: 50, y: 50 });

  const getMobilePosFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
      className="py-8 md:py-12"
    >
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <div className="w-8 h-8 bg-primary/10 rounded-sm flex items-center justify-center">
          <Camera className="w-4 h-4 text-primary" />
        </div>
        <h2 className="editorial-subheading text-primary">공간 둘러보기</h2>
      </div>

      {/* ==================== DESKTOP ==================== */}
      <div className="hidden md:block rounded-sm overflow-hidden border border-border bg-card">
        <div className="border-b border-border grid grid-cols-[1fr_1fr] h-44">
          <div
            ref={floorplanRef}
            onPointerEnter={handleFloorplanPointerEnter}
            onPointerDown={handleFloorplanPointerDown}
            onPointerMove={handleFloorplanPointerMove}
            onPointerUp={handleFloorplanPointerEnd}
            onPointerCancel={handleFloorplanPointerEnd}
            onPointerLeave={handleFloorplanPointerLeave}
            style={{ touchAction: "none" }}
            className="border-r border-border relative bg-secondary/20 overflow-hidden flex items-center justify-center p-3 cursor-zoom-in"
          >
            {/* Floor label */}
            <span className="absolute top-2 left-2 z-10 text-[11px] font-semibold text-foreground bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-sm shadow-sm">
              {formatFloorLabel(photo.floor)}
            </span>

            <AnimatePresence mode="wait">
              <motion.div
                key={photo.floor}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative max-w-full max-h-full"
              >
                {floorplan && (
                  <DesktopFloorplan
                    src={floorplan.src}
                    label={floorplan.label}
                    rect={photo.floorplanRect}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* ### HINT OVERLAY — temporarily disabled
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[2px]"
                >
                  <div className="bg-card border border-border rounded-sm shadow-md px-4 py-3.5 max-w-[200px] text-center">
                    <p className="text-[11px] text-foreground leading-relaxed mb-3">
                      사진의 위치를 평면도 위에서 확인하세요
                    </p>
                    <label className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer mb-3 select-none">
                      <input
                        type="checkbox"
                        checked={hintNeverShow}
                        onChange={(e) => setHintNeverShow(e.target.checked)}
                        className="w-3 h-3 accent-primary"
                      />
                      다시 보지 않기
                    </label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hintNeverShow) localStorage.setItem("floorplan_hint_dismissed", "1");
                        setShowHint(false);
                      }}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      확인
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            ### */}
          </div>
          <div
            ref={thumbnailStripRef}
            className="p-3 flex gap-2 overflow-x-auto items-stretch scroll-smooth"
          >
            {photos.map((p, i) => (
              <button
                key={i}
                ref={(node) => {
                  thumbnailButtonRefs.current[i] = node;
                }}
                onClick={() => setCurrent(i)}
                className={`relative flex-shrink-0 aspect-[4/3] rounded-sm overflow-hidden transition-all ${i === safeIdx ? "ring-2 ring-primary opacity-100" : "opacity-60 hover:opacity-90"
                  }`}
              >
                <img src={p.swapped && p.beforeSrc ? p.beforeSrc : p.src} alt={p.room} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-3.5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-muted-foreground tracking-wide">
              {formatFloorLabel(photo.floor)}
            </span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={safeIdx}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.2 }}
                className="font-serif text-base font-medium text-foreground"
              >
                {photo.room}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums tracking-wide">
            {safeIdx + 1} / {photos.length}
          </span>
        </div>

        <div className="relative overflow-hidden aspect-[4/3] bg-foreground/5">
          {isZooming && floorplan && (
            <div
              className="w-full h-full absolute inset-0 z-10"
              style={{
                backgroundImage: `url(${floorplan.src})`,
                backgroundSize: `${ZOOM_SCALE * 100}%`,
                backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                backgroundRepeat: "no-repeat",
              }}
            />
          )}
          <AnimatePresence mode="wait">
            <motion.img
              key={safeIdx}
              src={photo.swapped && photo.beforeSrc ? photo.beforeSrc : photo.src}
              alt={photo.caption}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full absolute inset-0 object-contain"
            />
          </AnimatePresence>

          {photo.beforeSrc && photo.beforePosition && (() => {
            const insetSrc = photo.swapped ? photo.src : photo.beforeSrc;
            const insetLabel = photo.swapped ? "활용 제안" : "실제 공간";
            return (
              <div className={`absolute w-1/3 h-1/3 z-10 shadow-lg border-2 border-white/60 overflow-hidden bg-foreground/5 ${photo.beforePosition === "top-left" ? "top-2 left-2" :
                  photo.beforePosition === "top-right" ? "top-2 right-2" :
                    photo.beforePosition === "bottom-left" ? "bottom-2 left-2" :
                      "bottom-2 right-2"
                }`}>
                <img
                  src={insetSrc}
                  alt={`${photo.caption} (${insetLabel})`}
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-1.5 left-1.5 text-[9px] text-muted-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
                  {insetLabel}
                </span>
              </div>
            );
          })()}

          {!isZooming && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground/80 hover:bg-background/90 transition-colors"
                aria-label="이전"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-background/60 backdrop-blur-sm rounded-full flex items-center justify-center text-foreground/80 hover:bg-background/90 transition-colors"
                aria-label="다음"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {isZooming && (
            <div className="absolute top-3 left-3 bg-primary/80 backdrop-blur-sm text-primary-foreground text-xs font-medium px-2.5 py-1 rounded-full">
              🔍 평면도 확대 중
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-card">
          <AnimatePresence mode="wait">
            <motion.p
              key={isZooming ? "zoom-caption" : safeIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground tracking-wide leading-relaxed"
            >
              {isZooming
                ? "평면도 위에 마우스를 올려 확대된 부분을 확인하세요"
                : photo.caption}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* ==================== MOBILE ==================== */}
      <div className="md:hidden space-y-0">
        {photos.map((p, i) => {
          const fp = floorplans[String(p.floor)];
          return (
            <InteriorPhotoCard
              key={i}
              photo={p}
              floorplan={fp}
              zoomActive={mobileZoomIndex === i}
              zoomPos={mobileZoomPos}
              onFloorplanPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setMobileZoomIndex(i);
                setMobileZoomPos(getMobilePosFromPointer(e));
                trackCTAClick(
                  "zoom_mobile_floorplan",
                  "interior_gallery",
                  window.location.pathname.split("/").pop(),
                );
              }}
              onFloorplanPointerMove={(e) => {
                if (mobileZoomIndex !== i) return;
                setMobileZoomPos(getMobilePosFromPointer(e));
              }}
              onFloorplanPointerUp={() => setMobileZoomIndex(null)}
            />
          );
        })}
      </div>
    </motion.section>
  );
};

export default InteriorGallery;
