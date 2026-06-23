import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useUpdateProperty } from "@/hooks/useAdminProperties";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import type { LifestyleScenario, Property } from "@/types/property";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ImageUploader from "@/components/admin/property/ImageUploader";
import ImagePicker from "@/components/admin/property/ImagePicker";
import SaveBar from "@/components/admin/property/SaveBar";
import LayoutBuilder, {
  type CustomLayout,
  COLORS,
  parseCustomLayout,
  serializeCustomLayout,
} from "@/pages/admin/property/LayoutBuilder";

// ── Preset layout picker ──────────────────────────────────────────────────

type LayoutId = "1-full" | "2-stack" | "2-side" | "3-hero" | "3-col" | "4-grid" | "4-hero";

const LAYOUTS: { id: LayoutId; label: string; photos: number }[] = [
  { id: "1-full",  label: "1장 전체",   photos: 1 },
  { id: "2-stack", label: "2장 위아래", photos: 2 },
  { id: "2-side",  label: "2장 나란히", photos: 2 },
  { id: "3-hero",  label: "3장 메인+2", photos: 3 },
  { id: "3-col",   label: "3장 나란히", photos: 3 },
  { id: "4-grid",  label: "4장 격자",   photos: 4 },
  { id: "4-hero",  label: "4장 메인+3", photos: 4 },
];

// Portrait A4 thumbnail proportions (~1:1.41)
const W = 50, H = 70, G = 2;

const LayoutSVG = ({ id }: { id: LayoutId }) => {
  const fill = "currentColor";
  switch (id) {
    case "1-full":
      return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60"><rect x={0} y={0} width={W} height={H} rx={1} fill={fill} /></svg>;
    case "2-stack": { const th = Math.round(H * 0.58), bh = H - th - G; return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60"><rect x={0} y={0} width={W} height={th} rx={1} fill={fill} /><rect x={0} y={th + G} width={W} height={bh} rx={1} fill={fill} /></svg>; }
    case "2-side": { const w = Math.floor((W - G) / 2); return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60"><rect x={0} y={0} width={w} height={H} rx={1} fill={fill} /><rect x={w + G} y={0} width={W - w - G} height={H} rx={1} fill={fill} /></svg>; }
    case "3-hero": { const th = Math.round(H * 0.55), bh = H - th - G, bw = Math.floor((W - G) / 2); return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60"><rect x={0} y={0} width={W} height={th} rx={1} fill={fill} /><rect x={0} y={th + G} width={bw} height={bh} rx={1} fill={fill} /><rect x={bw + G} y={th + G} width={W - bw - G} height={bh} rx={1} fill={fill} /></svg>; }
    case "3-col": { const w = Math.floor((W - G * 2) / 3); return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60">{[0,1,2].map((i) => <rect key={i} x={i*(w+G)} y={0} width={i===2?W-i*(w+G):w} height={H} rx={1} fill={fill} />)}</svg>; }
    case "4-grid": { const hw = Math.floor((W-G)/2), hh = Math.floor((H-G)/2); return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60"><rect x={0} y={0} width={hw} height={hh} rx={1} fill={fill} /><rect x={hw+G} y={0} width={W-hw-G} height={hh} rx={1} fill={fill} /><rect x={0} y={hh+G} width={hw} height={H-hh-G} rx={1} fill={fill} /><rect x={hw+G} y={hh+G} width={W-hw-G} height={H-hh-G} rx={1} fill={fill} /></svg>; }
    case "4-hero": { const th = Math.round(H*0.5), bh = H-th-G, bw = Math.floor((W-G*2)/3); return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60"><rect x={0} y={0} width={W} height={th} rx={1} fill={fill} />{[0,1,2].map((i) => <rect key={i} x={i*(bw+G)} y={th+G} width={i===2?W-i*(bw+G):bw} height={bh} rx={1} fill={fill} />)}</svg>; }
  }
};

// ── Saved presets (localStorage) ─────────────────────────────────────────

interface SavedPreset {
  id: string;
  name: string;
  layout: CustomLayout;
  createdAt: number;
}

const LS_KEY = "houseinus_layout_presets";
const loadSavedPresets = (): SavedPreset[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); }
  catch { return []; }
};
const persistSavedPresets = (p: SavedPreset[]) =>
  localStorage.setItem(LS_KEY, JSON.stringify(p));

// ── Saved preset thumbnail ────────────────────────────────────────────────

const SavedPresetThumb = ({ layout }: { layout: CustomLayout }) => (
  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80">
    <rect x={0} y={0} width={W} height={H} rx={1} fill="hsl(var(--muted))" />
    {layout.slots.map((slot, i) => (
      <rect
        key={slot.id}
        x={Math.round((slot.x / 100) * W)}
        y={Math.round((slot.y / 100) * H)}
        width={Math.max(1, Math.round((slot.w / 100) * W))}
        height={Math.max(1, Math.round((slot.h / 100) * H))}
        rx={1}
        fill={COLORS[i % COLORS.length]}
      />
    ))}
    {layout.captionArea && (
      <rect
        x={Math.round((layout.captionArea.x / 100) * W)}
        y={Math.round((layout.captionArea.y / 100) * H)}
        width={Math.max(1, Math.round((layout.captionArea.w / 100) * W))}
        height={Math.max(1, Math.round((layout.captionArea.h / 100) * H))}
        rx={1}
        fill="rgba(245,158,11,0.5)"
      />
    )}
  </svg>
);

// ── Helper ────────────────────────────────────────────────────────────────

const EMPTY_CUSTOM: CustomLayout = { type: "custom", slots: [] };

const isCustomRaw = (raw: string | null | undefined) =>
  typeof raw === "string" && raw.startsWith("{");

// ── Component ─────────────────────────────────────────────────────────────

const ScenariosTab = ({ property }: { property: Property }) => {
  const qc = useQueryClient();
  const update = useUpdateProperty(property.id);

  const [scenarios, setScenarios] = useState<LifestyleScenario[]>(
    () => property.lifestyle_scenarios.map((s) => ({ ...s })),
  );

  // "preset" or "custom"
  const [mode, setMode] = useState<"preset" | "custom">(() =>
    isCustomRaw(property.lifestyle_layout) ? "custom" : "preset",
  );
  const [presetId, setPresetId] = useState<LayoutId>(
    () => (isCustomRaw(property.lifestyle_layout) ? "1-full" : ((property.lifestyle_layout as LayoutId) ?? "1-full")),
  );
  const [customLayout, setCustomLayout] = useState<CustomLayout>(
    () => parseCustomLayout(property.lifestyle_layout ?? "") ?? EMPTY_CUSTOM,
  );
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadSavedPresets);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    setScenarios(property.lifestyle_scenarios.map((s) => ({ ...s })));
    setMode(isCustomRaw(property.lifestyle_layout) ? "custom" : "preset");
    setPresetId(isCustomRaw(property.lifestyle_layout) ? "1-full" : ((property.lifestyle_layout as LayoutId) ?? "1-full"));
    setCustomLayout(parseCustomLayout(property.lifestyle_layout ?? "") ?? EMPTY_CUSTOM);
    setSelectedSavedId(null);
  }, [property]);

  const effectiveLayout = (() => {
    if (mode === "custom") return serializeCustomLayout(customLayout);
    if (selectedSavedId) {
      const sp = savedPresets.find((p) => p.id === selectedSavedId);
      if (sp) return serializeCustomLayout(sp.layout);
    }
    return presetId;
  })();

  const dirty = useMemo(
    () =>
      JSON.stringify(scenarios) !== JSON.stringify(property.lifestyle_scenarios) ||
      effectiveLayout !== (property.lifestyle_layout ?? "1-full"),
    [scenarios, property.lifestyle_scenarios, effectiveLayout, property.lifestyle_layout],
  );
  useDirtyGuard(dirty);

  const handleSavePreset = (name: string) => {
    const newPreset: SavedPreset = {
      id: `${Date.now()}`,
      name,
      layout: customLayout,
      createdAt: Date.now(),
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    persistSavedPresets(updated);
  };

  const handleDeleteSavedPreset = (id: string) => {
    const updated = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(updated);
    persistSavedPresets(updated);
    if (selectedSavedId === id) setSelectedSavedId(null);
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-property", property.id] });

  const update_ = (idx: number, patch: Partial<LifestyleScenario>) =>
    setScenarios((curr) => curr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  const move = (idx: number, dir: -1 | 1) => {
    setScenarios((curr) => {
      const next = [...curr]; const t = idx + dir;
      if (t < 0 || t >= next.length) return curr;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  };
  const removeAt = (idx: number) => setScenarios((curr) => curr.filter((_, i) => i !== idx));
  const add = () => setScenarios((curr) => [...curr, { image_id: "", description: "" }]);

  const onSave = async () => {
    setSaveErr(null);
    try {
      await update.mutateAsync({
        lifestyle_scenarios: scenarios.filter((s) => s.image_id),
        lifestyle_layout: effectiveLayout,
      });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  };

  const selectedPresetInfo = selectedSavedId
    ? (() => {
        const sp = savedPresets.find((p) => p.id === selectedSavedId);
        return sp ? { photos: sp.layout.slots.length } : null;
      })()
    : LAYOUTS.find((l) => l.id === presetId);

  return (
    <div className="space-y-6">
      {/* ── Layout section ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">프린트 레이아웃</h2>
          {/* Mode toggle */}
          <div className="flex rounded-sm border border-border overflow-hidden text-xs">
            {(["preset", "custom"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "preset" ? "프리셋" : "직접 그리기"}
              </button>
            ))}
          </div>
        </div>

        {mode === "preset" && (
          <>
            {selectedPresetInfo && (
              <p className="text-xs text-muted-foreground">
                사진 {selectedPresetInfo.photos}장 사용
              </p>
            )}

            {/* Built-in presets */}
            <div className="flex flex-wrap gap-2">
              {LAYOUTS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { setPresetId(l.id); setSelectedSavedId(null); }}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-sm border transition-colors ${
                    !selectedSavedId && presetId === l.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  <LayoutSVG id={l.id} />
                  <span className="text-[11px] font-medium whitespace-nowrap">{l.label}</span>
                </button>
              ))}
            </div>

            {/* Saved custom presets */}
            {savedPresets.length > 0 && (
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground">저장된 레이아웃</p>
                <div className="flex flex-wrap gap-2">
                  {savedPresets.map((sp) => (
                    <div key={sp.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => setSelectedSavedId(sp.id === selectedSavedId ? null : sp.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-sm border transition-colors ${
                          selectedSavedId === sp.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        }`}
                      >
                        <SavedPresetThumb layout={sp.layout} />
                        <span className="text-[11px] font-medium max-w-[60px] truncate">{sp.name}</span>
                      </button>
                      <button
                        type="button"
                        title="삭제"
                        onClick={() => handleDeleteSavedPreset(sp.id)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white text-[9px] hidden group-hover:flex items-center justify-center leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {mode === "custom" && (
          <LayoutBuilder
            value={customLayout}
            onChange={setCustomLayout}
            maxPhotos={Math.max(scenarios.filter((s) => s.image_id).length, 1)}
            onSavePreset={handleSavePreset}
          />
        )}
      </div>

      {/* ── Scenarios ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">라이프스타일 시나리오</h2>
        <p className="text-xs text-muted-foreground">
          사이트의 "이런 일상" 슬라이드에 사용되는 사진 + 설명들.
        </p>

        {scenarios.map((s, idx) => {
          const img = property.images.find((i) => i.id === s.image_id);
          return (
            <div key={idx} className="bg-card border border-border rounded-sm p-3 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="w-20 h-20 bg-secondary rounded-sm overflow-hidden flex-shrink-0">
                  {img && <img src={img.url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-[14rem]">
                  <Textarea
                    rows={3}
                    value={s.description}
                    onChange={(e) => update_(idx, { description: e.target.value })}
                    placeholder="설명을 입력하세요"
                  />
                </div>
              </div>
              <div>
                <ImagePicker
                  images={property.images}
                  selectedId={s.image_id || null}
                  onSelect={(id) => update_(idx, { image_id: id ?? "" })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => move(idx, 1)} disabled={idx === scenarios.length - 1}>↓</Button>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAt(idx)}>
                  <Trash2 className="w-4 h-4 mr-1" /> 삭제
                </Button>
              </div>
            </div>
          );
        })}

        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> 시나리오 추가
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">사진 업로드</h3>
        <ImageUploader propertyId={property.id} onUploaded={() => refresh()} label="시나리오 사진 업로드" />
      </div>

      <SaveBar dirty={dirty} saving={update.isPending} onSave={onSave} error={saveErr} />
    </div>
  );
};

export default ScenariosTab;
