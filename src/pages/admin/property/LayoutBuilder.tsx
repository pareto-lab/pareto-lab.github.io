import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────

export type CaptionPos = "tl" | "tr" | "bl" | "br" | "none";

export interface LayoutSlot {
  id: number;
  /** Percentage of canvas area */
  x: number; y: number; w: number; h: number;
  photoIdx: number;
  caption: CaptionPos;
}

export interface CaptionArea {
  x: number; y: number; w: number; h: number;
}

export interface CustomLayout {
  type: "custom";
  slots: LayoutSlot[];
  captionArea?: CaptionArea;
  page2?: { slots: LayoutSlot[]; captionArea?: CaptionArea };
}

export const parseCustomLayout = (raw: string): CustomLayout | null => {
  try {
    const v = JSON.parse(raw);
    if (v?.type === "custom" && Array.isArray(v.slots)) return v as CustomLayout;
  } catch {}
  return null;
};

export const serializeCustomLayout = (v: CustomLayout) => JSON.stringify(v);

// ── Constants ─────────────────────────────────────────────────────────────

const CW = 264;
const CH = 373;
export const COLORS = [
  "#bfdbfe", "#bbf7d0", "#fef08a", "#fecaca",
  "#e9d5ff", "#fed7aa", "#99f6e4",
];

const CAPTION_LABELS: Record<CaptionPos, string> = {
  tl: "좌상", tr: "우상", bl: "좌하", br: "우하", none: "없음",
};

// ── Helpers ───────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const badgeStyle = (pos: CaptionPos): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: "absolute", padding: "2px 5px",
    background: "rgba(0,0,0,0.45)", color: "#fff",
    fontSize: 8, lineHeight: 1.3, borderRadius: 2,
  };
  if (pos === "tl") return { ...base, top: 4, left: 4 };
  if (pos === "tr") return { ...base, top: 4, right: 4 };
  if (pos === "bl") return { ...base, bottom: 4, left: 4 };
  if (pos === "br") return { ...base, bottom: 4, right: 4 };
  return {};
};

// ── PageCanvas sub-component ──────────────────────────────────────────────

interface PageValue {
  slots: LayoutSlot[];
  captionArea?: CaptionArea;
}

type DrawMode = "slot" | "caption";

interface PageCanvasProps {
  value: PageValue;
  onChange: (v: PageValue) => void;
  drawMode: DrawMode;
  maxPhotos: number;
  nextIdRef: React.MutableRefObject<number>;
  selectedId: number | null;
  captionSelected: boolean;
  onActivate: () => void;
  onSelectionChange: (selectedId: number | null, captionSelected: boolean) => void;
  isActive: boolean;
  label?: string;
}

function PageCanvas({
  value, onChange, drawMode, maxPhotos, nextIdRef,
  selectedId, captionSelected, onActivate, onSelectionChange, isActive, label,
}: PageCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ sx: number; sy: number } | null>(null);
  const drawModeRef = useRef<DrawMode>("slot");
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  const pct = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: clamp(((clientX - r.left) / CW) * 100, 0, 100),
      y: clamp(((clientY - r.top)  / CH) * 100, 0, 100),
    };
  };

  const round1 = (n: number) => Math.round(n * 10) / 10;

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const { x, y } = pct(e.clientX, e.clientY);
      const start = dragStartRef.current!;
      setPreview({
        x: round1(Math.min(start.sx, x)),
        y: round1(Math.min(start.sy, y)),
        w: round1(Math.abs(x - start.sx)),
        h: round1(Math.abs(y - start.sy)),
      });
    };

    const onUp = (e: MouseEvent) => {
      setDragging(false);
      const { x, y } = pct(e.clientX, e.clientY);
      const start = dragStartRef.current!;
      dragStartRef.current = null;

      const rx = round1(Math.min(start.sx, x));
      const ry = round1(Math.min(start.sy, y));
      const rw = round1(Math.abs(x - start.sx));
      const rh = round1(Math.abs(y - start.sy));

      setPreview(null);
      if (rw < 4 || rh < 4) return;

      if (drawModeRef.current === "caption") {
        onChange({ ...value, captionArea: { x: rx, y: ry, w: rw, h: rh } });
        onSelectionChange(null, true);
        return;
      }

      const usedIndices = new Set(value.slots.map((s) => s.photoIdx));
      const nextIdx = Array.from({ length: maxPhotos }, (_, i) => i).find((i) => !usedIndices.has(i)) ?? 0;

      const newId = nextIdRef.current++;
      const slot: LayoutSlot = {
        id: newId, x: rx, y: ry, w: rw, h: rh,
        photoIdx: nextIdx, caption: "bl",
      };
      onSelectionChange(slot.id, false);
      onChange({ ...value, slots: [...value.slots, slot] });
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, value, maxPhotos]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.currentTarget !== e.target) return;
    e.preventDefault();
    onActivate();
    onSelectionChange(null, false);
    const { x, y } = pct(e.clientX, e.clientY);
    dragStartRef.current = { sx: x, sy: y };
    setDragging(true);
    setPreview({ x, y, w: 0, h: 0 });
  };

  const previewColor = drawMode === "caption"
    ? "border-amber-500 bg-amber-500/10"
    : "border-primary bg-primary/10";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <p className={`text-[11px] font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </p>
      )}
      <div
        ref={canvasRef}
        className={`relative rounded-sm bg-muted/40 select-none flex-shrink-0 border ${
          isActive ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
        }`}
        style={{ width: CW, height: CH, cursor: "crosshair" }}
        onMouseDown={onMouseDown}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(to right,hsl(var(--foreground)) 1px,transparent 1px)," +
              "linear-gradient(to bottom,hsl(var(--foreground)) 1px,transparent 1px)",
            backgroundSize: `${CW / 12}px ${CH / 16}px`,
          }}
        />

        {/* Slots */}
        {value.slots.map((slot, i) => (
          <div
            key={slot.id}
            className={`absolute rounded-sm border-2 flex items-center justify-center cursor-pointer overflow-hidden transition-shadow ${
              isActive && selectedId === slot.id
                ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
                : "border-foreground/25 hover:border-foreground/50"
            }`}
            style={{
              left: `${slot.x}%`, top: `${slot.y}%`,
              width: `${slot.w}%`, height: `${slot.h}%`,
              background: COLORS[i % COLORS.length],
            }}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
              onSelectionChange(isActive && slot.id === selectedId ? null : slot.id, false);
            }}
          >
            <span className="font-serif text-sm font-medium text-foreground/30 pointer-events-none">
              {slot.photoIdx + 1}
            </span>
            {slot.caption !== "none" && (
              <div style={badgeStyle(slot.caption)} className="pointer-events-none font-serif font-bold">
                {slot.photoIdx + 1}
              </div>
            )}
          </div>
        ))}

        {/* Caption area box */}
        {value.captionArea && (
          <div
            className={`absolute rounded-sm border-2 flex items-center justify-center cursor-pointer transition-shadow ${
              isActive && captionSelected
                ? "border-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.3)]"
                : "border-amber-400/60 hover:border-amber-500/80"
            }`}
            style={{
              left: `${value.captionArea.x}%`, top: `${value.captionArea.y}%`,
              width: `${value.captionArea.w}%`, height: `${value.captionArea.h}%`,
              background: isActive && captionSelected ? "rgba(251,191,36,0.18)" : "rgba(251,191,36,0.08)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
              onSelectionChange(null, !(isActive && captionSelected));
            }}
          >
            <span className="text-[9px] font-medium text-amber-600 pointer-events-none">캡션</span>
          </div>
        )}

        {/* Drawing preview */}
        {preview && preview.w > 1 && preview.h > 1 && (
          <div
            className={`absolute border-2 border-dashed pointer-events-none rounded-sm ${previewColor}`}
            style={{
              left: `${preview.x}%`, top: `${preview.y}%`,
              width: `${preview.w}%`, height: `${preview.h}%`,
            }}
          />
        )}

        {/* Empty state */}
        {value.slots.length === 0 && !value.captionArea && !dragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
              여기에 드래그해서<br />영역을 그리세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LayoutBuilder ─────────────────────────────────────────────────────────

interface Props {
  value: CustomLayout;
  onChange: (v: CustomLayout) => void;
  maxPhotos: number;
  onSavePreset?: (name: string) => void;
}

export default function LayoutBuilder({ value, onChange, maxPhotos, onSavePreset }: Props) {
  const nextIdRef = useRef<number>(
    (() => {
      const all = [...value.slots, ...(value.page2?.slots ?? [])];
      return all.length > 0 ? Math.max(...all.map((s) => s.id)) + 1 : 1;
    })(),
  );

  const [activePage, setActivePage] = useState<1 | 2>(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [captionSelected, setCaptionSelected] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>("slot");
  const [saveMode, setSaveMode] = useState(false);
  const [saveName, setSaveName] = useState("");

  const page2Enabled = value.page2 !== undefined;

  const p1Value: PageValue = { slots: value.slots, captionArea: value.captionArea };
  const p2Value: PageValue = value.page2 ?? { slots: [] };

  const onP1Change = (pv: PageValue) =>
    onChange({ ...value, slots: pv.slots, captionArea: pv.captionArea });
  const onP2Change = (pv: PageValue) =>
    onChange({ ...value, page2: pv });

  const activePv = activePage === 1 ? p1Value : p2Value;
  const setActivePv = activePage === 1 ? onP1Change : onP2Change;

  const selected = activePv.slots.find((s) => s.id === selectedId) ?? null;

  const updateSlot = (id: number, patch: Partial<LayoutSlot>) =>
    setActivePv({ ...activePv, slots: activePv.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const deleteSlot = (id: number) => {
    setActivePv({ ...activePv, slots: activePv.slots.filter((s) => s.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const handleActivate = (page: 1 | 2) => () => {
    setActivePage(page);
  };

  const handleSelectionChange = (page: 1 | 2) => (newId: number | null, newCaption: boolean) => {
    setActivePage(page);
    setSelectedId(newId);
    setCaptionSelected(newCaption);
  };

  const togglePage2 = () => {
    if (page2Enabled) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { page2: _, ...rest } = value;
      onChange(rest as CustomLayout);
      if (activePage === 2) { setActivePage(1); setSelectedId(null); setCaptionSelected(false); }
    } else {
      onChange({ ...value, page2: { slots: [] } });
    }
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 min-h-[28px]">
        {saveMode ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="text"
              className="flex-1 text-xs border border-border rounded-sm px-2 h-7 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="레이아웃 이름 입력"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && saveName.trim()) {
                  onSavePreset?.(saveName.trim());
                  setSaveMode(false); setSaveName("");
                } else if (e.key === "Escape") {
                  setSaveMode(false); setSaveName("");
                }
              }}
              autoFocus
            />
            <Button
              type="button" size="sm" className="h-7 text-xs px-2.5"
              onClick={() => {
                if (saveName.trim()) { onSavePreset?.(saveName.trim()); setSaveMode(false); setSaveName(""); }
              }}
            >저장</Button>
            <Button
              type="button" variant="ghost" size="sm" className="h-7 text-xs px-2"
              onClick={() => { setSaveMode(false); setSaveName(""); }}
            >취소</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              드래그해서 영역을 그리세요. 슬롯을 클릭하면 설정할 수 있어요.
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {value.slots.length > 0 && onSavePreset && (
                <Button type="button" variant="outline" size="sm" onClick={() => setSaveMode(true)}>
                  프리셋으로 저장
                </Button>
              )}
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => {
                  onChange({ type: "custom", slots: [], page2: page2Enabled ? { slots: [] } : undefined });
                  setSelectedId(null); setCaptionSelected(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> 전체 지우기
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Draw mode + page 2 toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex rounded-sm border border-border overflow-hidden text-xs w-fit">
          {(["slot", "caption"] as DrawMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setDrawMode(m); setSelectedId(null); setCaptionSelected(false); }}
              className={`px-3 py-1.5 font-medium transition-colors ${
                drawMode === m
                  ? m === "caption" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "slot" ? "사진 슬롯" : "캡션 영역"}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={page2Enabled}
            onChange={togglePage2}
            className="w-3.5 h-3.5 rounded-sm accent-primary cursor-pointer"
          />
          <span className="text-xs text-muted-foreground">2페이지 사용</span>
        </label>
      </div>

      <div className="flex gap-5 flex-wrap items-start">
        {/* ── Canvases ───────────────────────────────────────────── */}
        <div className="flex gap-4 flex-wrap items-start">
          <PageCanvas
            value={p1Value}
            onChange={onP1Change}
            drawMode={drawMode}
            maxPhotos={maxPhotos}
            nextIdRef={nextIdRef}
            selectedId={activePage === 1 ? selectedId : null}
            captionSelected={activePage === 1 && captionSelected}
            onActivate={handleActivate(1)}
            onSelectionChange={handleSelectionChange(1)}
            isActive={activePage === 1}
            label={page2Enabled ? "1페이지" : undefined}
          />
          {page2Enabled && (
            <PageCanvas
              value={p2Value}
              onChange={onP2Change}
              drawMode={drawMode}
              maxPhotos={maxPhotos}
              nextIdRef={nextIdRef}
              selectedId={activePage === 2 ? selectedId : null}
              captionSelected={activePage === 2 && captionSelected}
              onActivate={handleActivate(2)}
              onSelectionChange={handleSelectionChange(2)}
              isActive={activePage === 2}
              label="2페이지"
            />
          )}
        </div>

        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="space-y-4 min-w-[160px]">
          {captionSelected && activePv.captionArea ? (
            <>
              <p className="text-xs font-medium text-foreground">
                캡션 영역{page2Enabled ? ` (${activePage}페이지)` : ""}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                사진 번호와 키워드가<br />이 영역 안에 표시됩니다.
              </p>
              <Button
                type="button" variant="ghost" size="sm"
                className="text-destructive hover:text-destructive w-full"
                onClick={() => { setActivePv({ ...activePv, captionArea: undefined }); setCaptionSelected(false); }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> 캡션 영역 삭제
              </Button>
            </>
          ) : selected ? (
            <>
              <p className="text-xs font-medium text-foreground">
                슬롯 설정{page2Enabled ? ` (${activePage}페이지)` : ""}
              </p>

              {/* Photo index */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">사진 번호</label>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: maxPhotos }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => updateSlot(selected.id, { photoIdx: i })}
                      className={`w-7 h-7 text-xs font-medium rounded-sm border transition-colors ${
                        selected.photoIdx === i
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-foreground/50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number badge position */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1.5">번호 위치</label>
                <div className="grid grid-cols-2 gap-1 w-[88px]">
                  {(["tl", "tr", "bl", "br"] as CaptionPos[]).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateSlot(selected.id, { caption: pos })}
                      className={`h-8 text-[11px] font-medium rounded-sm border transition-colors ${
                        selected.caption === pos
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                      }`}
                    >
                      {CAPTION_LABELS[pos]}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => updateSlot(selected.id, { caption: "none" })}
                  className={`mt-1 w-[88px] h-7 text-[11px] font-medium rounded-sm border transition-colors ${
                    selected.caption === "none"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground"
                  }`}
                >
                  없음
                </button>
              </div>

              <Button
                type="button" variant="ghost" size="sm"
                className="text-destructive hover:text-destructive w-full"
                onClick={() => deleteSlot(selected.id)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> 슬롯 삭제
              </Button>
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              슬롯을 클릭하면<br />설정할 수 있어요
            </p>
          )}

          {/* Legend for active page */}
          {(activePv.slots.length > 0 || activePv.captionArea) && (
            <div className="pt-2 border-t border-border space-y-1">
              {activePv.slots.map((slot, i) => (
                <div key={slot.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span>사진 {slot.photoIdx + 1}</span>
                  {slot.caption !== "none" && (
                    <span className="text-muted-foreground/60">· 번호 {CAPTION_LABELS[slot.caption]}</span>
                  )}
                </div>
              ))}
              {activePv.captionArea && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-amber-400" style={{ background: "rgba(251,191,36,0.3)" }} />
                  <span>캡션 영역</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
