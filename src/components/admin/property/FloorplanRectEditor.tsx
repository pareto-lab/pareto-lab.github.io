import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type Rect = [number, number, number, number]; // [x%, y%, w%, h%]

interface Props {
  imageUrl: string;
  value: Rect | number[];
  onChange: (rect: Rect) => void;
  className?: string;
}

const clamp = (v: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, v));

/**
 * Drag a new rectangle on the floorplan to set [x%, y%, w%, h%].
 * - Click + drag on empty area to draw a fresh rect.
 * - Drag the existing rect to move it.
 * - Drag any of the 8 handles to resize.
 */
const FloorplanRectEditor = ({ imageUrl, value, onChange, className = "" }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rect: Rect = [
    Number(value[0]) || 0,
    Number(value[1]) || 0,
    Number(value[2]) || 0,
    Number(value[3]) || 0,
  ];
  const [imgArea, setImgArea] = useState<{
    ox: number;
    oy: number;
    w: number;
    h: number;
  } | null>(null);
  const [drag, setDrag] = useState<
    | null
    | {
        kind: "draw" | "move" | "resize";
        handle?: string;
        startX: number;
        startY: number;
        origRect: Rect;
      }
  >(null);

  const updateImgArea = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const ox = (cw - w) / 2;
    const oy = (ch - h) / 2;
    setImgArea({ ox, oy, w, h });
  }, []);

  useEffect(() => {
    updateImgArea();
    window.addEventListener("resize", updateImgArea);
    return () => window.removeEventListener("resize", updateImgArea);
  }, [updateImgArea]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => updateImgArea());
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateImgArea]);

  const isInsideImageArea = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container || !imgArea) return false;
      const bounds = container.getBoundingClientRect();
      const x = clientX - bounds.left;
      const y = clientY - bounds.top;
      return (
        x >= imgArea.ox &&
        x <= imgArea.ox + imgArea.w &&
        y >= imgArea.oy &&
        y <= imgArea.oy + imgArea.h
      );
    },
    [imgArea],
  );

  const toPct = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el || !imgArea) return [0, 0];
    const r = el.getBoundingClientRect();
    return [
      clamp(((clientX - r.left - imgArea.ox) / imgArea.w) * 100),
      clamp(((clientY - r.top - imgArea.oy) / imgArea.h) * 100),
    ];
  }, [imgArea]);

  const onPointerDownContainer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget && (e.target as HTMLElement).dataset.role !== "rect-bg") {
      // clicked on a handle or the rect itself — let those handlers fire.
      return;
    }
    if (!isInsideImageArea(e.clientX, e.clientY)) return;
    const [x, y] = toPct(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ kind: "draw", startX: x, startY: y, origRect: [x, y, 0, 0] });
    onChange([clamp(x), clamp(y), 0, 0]);
  };

  const onPointerDownRect = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const [x, y] = toPct(e.clientX, e.clientY);
    (e.currentTarget.parentElement as HTMLDivElement)?.setPointerCapture(e.pointerId);
    setDrag({ kind: "move", startX: x, startY: y, origRect: rect });
  };

  const onPointerDownHandle = (
    e: ReactPointerEvent<HTMLDivElement>,
    handle: string,
  ) => {
    e.stopPropagation();
    const [x, y] = toPct(e.clientX, e.clientY);
    (e.currentTarget.closest("[data-rect-root]") as HTMLDivElement | null)?.setPointerCapture(
      e.pointerId,
    );
    setDrag({ kind: "resize", handle, startX: x, startY: y, origRect: rect });
  };

  useEffect(() => {
    if (!drag) return;

    const onMove = (ev: PointerEvent) => {
      const [x, y] = toPct(ev.clientX, ev.clientY);
      const dx = x - drag.startX;
      const dy = y - drag.startY;

      if (drag.kind === "draw") {
        const nx = clamp(Math.min(drag.startX, x));
        const ny = clamp(Math.min(drag.startY, y));
        const nw = clamp(Math.abs(x - drag.startX), 0, 100 - nx);
        const nh = clamp(Math.abs(y - drag.startY), 0, 100 - ny);
        onChange([nx, ny, nw, nh]);
      } else if (drag.kind === "move") {
        const [ox, oy, ow, oh] = drag.origRect;
        const nx = clamp(ox + dx, 0, 100 - ow);
        const ny = clamp(oy + dy, 0, 100 - oh);
        onChange([nx, ny, ow, oh]);
      } else if (drag.kind === "resize") {
        let [nx, ny, nw, nh] = drag.origRect;
        const right = nx + nw;
        const bottom = ny + nh;
        if (drag.handle?.includes("e")) nw = clamp(right + dx - nx, 1, 100 - nx);
        if (drag.handle?.includes("s")) nh = clamp(bottom + dy - ny, 1, 100 - ny);
        if (drag.handle?.includes("w")) {
          const newX = clamp(nx + dx, 0, right - 1);
          nw = right - newX;
          nx = newX;
        }
        if (drag.handle?.includes("n")) {
          const newY = clamp(ny + dy, 0, bottom - 1);
          nh = bottom - newY;
          ny = newY;
        }
        onChange([nx, ny, nw, nh]);
      }
    };
    const onUp = () => setDrag(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, onChange, toPct]);

  const handles = [
    { key: "n", style: { left: "50%", top: "0%" }, cursor: "ns-resize" },
    { key: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
    { key: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
    { key: "w", style: { left: "0%", top: "50%" }, cursor: "ew-resize" },
    { key: "ne", style: { left: "100%", top: "0%" }, cursor: "nesw-resize" },
    { key: "nw", style: { left: "0%", top: "0%" }, cursor: "nwse-resize" },
    { key: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
    { key: "sw", style: { left: "0%", top: "100%" }, cursor: "nesw-resize" },
  ];

  return (
    <div className={`space-y-2 ${className}`}>
      <div
        ref={containerRef}
        className="relative bg-secondary border border-border select-none touch-none cursor-crosshair"
        style={{ aspectRatio: "1 / 1" }}
        onPointerDown={onPointerDownContainer}
        data-rect-root
      >
        <img
          ref={imgRef}
          src={imageUrl}
          alt="floorplan"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          data-role="rect-bg"
          onLoad={updateImgArea}
        />
        {imgArea && (rect[2] > 0 || rect[3] > 0) && (
          <div
            className="absolute border-2 border-primary bg-primary/20"
            style={{
              left: `${imgArea.ox + (rect[0] / 100) * imgArea.w}px`,
              top: `${imgArea.oy + (rect[1] / 100) * imgArea.h}px`,
              width: `${(rect[2] / 100) * imgArea.w}px`,
              height: `${(rect[3] / 100) * imgArea.h}px`,
            }}
            onPointerDown={onPointerDownRect}
          >
            {handles.map((h) => (
              <div
                key={h.key}
                className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-primary border border-background rounded-sm"
                style={{ ...h.style, cursor: h.cursor }}
                onPointerDown={(e) => onPointerDownHandle(e, h.key)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        x: {rect[0].toFixed(1)}%  y: {rect[1].toFixed(1)}%  w: {rect[2].toFixed(1)}%  h: {rect[3].toFixed(1)}%
      </div>
    </div>
  );
};

export default FloorplanRectEditor;
