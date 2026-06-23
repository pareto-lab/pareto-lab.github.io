import { useState, useEffect } from "react";
import { formatFloorLabel } from "@/lib/floor";
import type { FloorplanEntry, InteriorPhoto } from "@/data/properties";

// Uses background-image instead of <img>+object-fit so html2canvas renders correctly.

export const MiniFloorplan = ({
  src,
  rect,
  label,
}: {
  src: string;
  rect: [number, number, number, number];
  label: string;
}) => {
  const H = 60; // fixed height — width is proportional to the image aspect ratio
  const [containerW, setContainerW] = useState(H);
  const [highlight, setHighlight] = useState<{
    left: number; top: number; width: number; height: number;
  } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const scale = H / img.naturalHeight; // height-based scaling
      const w = img.naturalWidth * scale;
      setContainerW(Math.round(w));
      // Image fills the container exactly (ox=0, oy=0)
      setHighlight({
        left: (rect[0] / 100) * w,
        top:  (rect[1] / 100) * H,
        width:  (rect[2] / 100) * w,
        height: (rect[3] / 100) * H,
      });
    };
    img.src = src;
  }, [src, rect]);

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: containerW,
        height: H,
        backgroundImage: `url(${src})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        opacity: 0.7,
      }}
      aria-label={label}
    >
      {highlight && (
        <div
          className="absolute border-2 border-primary bg-primary/20 rounded-sm"
          style={{
            left: highlight.left,
            top: highlight.top,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}
    </div>
  );
};

export interface InteriorPhotoCardProps {
  photo: InteriorPhoto;
  floorplan?: FloorplanEntry;
  zoomActive?: boolean;
  zoomPos?: { x: number; y: number };
  onFloorplanPointerDown?: (e: React.PointerEvent) => void;
  onFloorplanPointerMove?: (e: React.PointerEvent) => void;
  onFloorplanPointerUp?: () => void;
  fixedCaption?: boolean;
  squarePhoto?: boolean;
}

const ZOOM_SCALE = 3;

const positionClass = (pos: string) =>
  pos === "top-left" ? "top-2 left-2" :
  pos === "top-right" ? "top-2 right-2" :
  pos === "bottom-left" ? "bottom-2 left-2" :
  "bottom-2 right-2";

const InteriorPhotoCard = ({
  photo,
  floorplan,
  zoomActive,
  zoomPos,
  onFloorplanPointerDown,
  onFloorplanPointerMove,
  onFloorplanPointerUp,
  fixedCaption,
  squarePhoto,
}: InteriorPhotoCardProps) => {
  const interactive = !!onFloorplanPointerDown;

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-card">
        <div>
          <h3 className="font-serif text-lg font-medium text-foreground">{photo.room}</h3>
          <span className="text-xs text-muted-foreground">
            {formatFloorLabel(photo.floor)}
          </span>
        </div>
        {floorplan && (
          <div
            onPointerDown={onFloorplanPointerDown}
            onPointerMove={onFloorplanPointerMove}
            onPointerUp={onFloorplanPointerUp}
            onPointerCancel={onFloorplanPointerUp}
            style={interactive ? { touchAction: "none" } : undefined}
            className={interactive ? "cursor-zoom-in select-none relative z-20" : undefined}
          >
            <MiniFloorplan src={floorplan.src} label={floorplan.label} rect={photo.floorplanRect} />
          </div>
        )}
      </div>

      {/* Photo — background-image so html2canvas respects the container size */}
      <div
        className="relative w-full bg-foreground/5 overflow-hidden"
        style={{ aspectRatio: squarePhoto ? "1/1" : photo.portrait ? "3/4" : "4/3" }}
      >
        {/* Inner photo layer */}
        {(() => {
          const mainSrc   = photo.swapped ? photo.beforeSrc : photo.src;
          const insetSrc  = photo.swapped ? photo.src       : photo.beforeSrc;
          const insetLabel = photo.swapped ? "활용 제안"    : "실제 공간";
          return (
            <div
              className="absolute"
              style={{
                inset: 0,
                backgroundImage: `url(${mainSrc})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {insetSrc && photo.beforePosition && (
                <div
                  className={`absolute z-10 shadow-lg border-2 border-white/60 overflow-hidden bg-foreground/5 pointer-events-none ${positionClass(photo.beforePosition)}`}
                  style={{
                    width: "33.333%",
                    height: "33.333%",
                    backgroundImage: `url(${insetSrc})`,
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  {/* No backdrop-blur — not supported by html2canvas */}
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-sm">
                    {insetLabel}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Zoom overlay (interactive mode only) */}
        {interactive && zoomActive && floorplan && (
          <div
            className="w-full h-full absolute inset-0 z-20 bg-background"
            style={{
              backgroundImage: `url(${floorplan.src})`,
              backgroundSize: `${ZOOM_SCALE * 100}%`,
              backgroundPosition: `${zoomPos && !Number.isNaN(zoomPos.x) ? zoomPos.x : 50}% ${zoomPos && !Number.isNaN(zoomPos.y) ? zoomPos.y : 50}%`,
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium px-2.5 py-1 rounded-full shadow-sm z-30">
              🔍 평면도 확대 중
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      {fixedCaption ? (
        <div className="px-4 pt-5 pb-2.5 bg-card h-[112px] overflow-hidden flex flex-col justify-between">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
            {photo.caption}
          </p>
          <p className="text-[9px] text-muted-foreground/50 text-right leading-none">
            made with 하우스인어스
          </p>
        </div>
      ) : (
        <p className="px-4 py-2.5 text-xs text-muted-foreground leading-relaxed bg-card">
          {photo.caption}
        </p>
      )}
    </div>
  );
};

export default InteriorPhotoCard;
