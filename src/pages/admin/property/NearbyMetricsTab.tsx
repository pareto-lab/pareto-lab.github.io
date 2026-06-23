import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useUpdateProperty } from "@/hooks/useAdminProperties";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import type {
  EvaluationMetric,
  HousePlanSpecRow,
  HousePlanSpecs,
  NearbyCategory,
  Property,
  Specs,
} from "@/types/property";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SaveBar from "@/components/admin/property/SaveBar";

const ICON_OPTIONS = [
  "MapPin",
  "School",
  "Building2",
  "ShoppingCart",
  "Home",
  "Car",
];

interface FormState {
  specs: Specs;
  house_plan_specs: HousePlanSpecs;
  nearby_places: NearbyCategory[];
  evaluation_metrics: EvaluationMetric[];
}

const DEFAULT_HOUSE_PLAN_ROW_EXAMPLES: Array<{ label: string; example: string }> = [
  { label: "층별 면적(1층)", example: "33.38" },
  { label: "층별 면적(2층)", example: "32.95" },
  { label: "층별 면적(3층)", example: "18.6" },
  { label: "건폐율", example: "19.46%" },
  { label: "용적률", example: "36.14%" },
  { label: "주구조", example: "일반목구조" },
  { label: "주차", example: "옥외 / 2대 가능" },
  { label: "난방 타입", example: "LPG" },
  { label: "상수", example: "상수도" },
  { label: "하수", example: "하수도 직관 (정화조 없음)" },
  { label: "월 평균 전기료", example: "37,240원" },
  { label: "월 평균 가스비", example: "53,880원" },
  { label: "지붕", example: "경사지붕/징크마감" },
  { label: "외벽", example: "파벽돌+스타코" },
  { label: "마당", example: "(앞) 조경+석재, (뒤) 잔디" },
  { label: "펜스", example: "있음, 일부 미송" },
];

const DEFAULT_HOUSE_PLAN_ROWS: HousePlanSpecRow[] = DEFAULT_HOUSE_PLAN_ROW_EXAMPLES.map(
  ({ label }) => ({ label, value: "", info_text: null, hide_info: false }),
);

const DEFAULT_HOUSE_PLAN_LABELS = new Set(
  DEFAULT_HOUSE_PLAN_ROWS.map((row) => row.label),
);

const DEFAULT_HOUSE_PLAN_VALUE_PLACEHOLDERS = new Map(
  DEFAULT_HOUSE_PLAN_ROW_EXAMPLES.map(({ label, example }) => [label, example]),
);

const AREA_UNIT = "㎡";
const isAreaValueRowLabel = (label: string): boolean =>
  label.trim().startsWith("층별 면적(");
const stripAreaUnit = (value: string): string =>
  value.replace(/\s*㎡\s*$/u, "").trim();
const addAreaUnit = (value: string): string => {
  const stripped = stripAreaUnit(value);
  return stripped ? `${stripped}${AREA_UNIT}` : "";
};
const isSpecAreaKey = (key: keyof Specs): key is "land_area" | "indoor_area" =>
  key === "land_area" || key === "indoor_area";
const isChildcareCategoryLabel = (label: string): boolean =>
  label.trim().includes("어린이집");
const DEFAULT_CHILDCARE_INFO_TEXT =
  "반경 500m 내 어린이집과 반경 1km 내 유치원이 표시됩니다";
const CHILDCARE_SUBCATEGORY_OPTIONS = ["어린이집", "유치원"] as const;
type ChildcareSubcategory = (typeof CHILDCARE_SUBCATEGORY_OPTIONS)[number];
const DEFAULT_CHILDCARE_SUBCATEGORY: ChildcareSubcategory = "어린이집";
const toChildcareSubcategory = (value: string): ChildcareSubcategory =>
  value.trim().includes("유치원") ? "유치원" : "어린이집";
const combinePlaceName = (subcat: string, actualName: string): string => {
  const normalizedSubcat = subcat.trim();
  return normalizedSubcat ? `${normalizedSubcat} · ${actualName}` : actualName;
};

const DEFAULT_NEARBY_CATEGORIES: NearbyCategory[] = [
  {
    icon: "School",
    label: "어린이집/유치원",
    info_text: DEFAULT_CHILDCARE_INFO_TEXT,
    hide_info: false,
    places: [],
  },
  { icon: "School", label: "학교", info_text: null, hide_info: false, places: [] },
  { icon: "Car", label: "교통 접근성", info_text: null, hide_info: false, places: [] },
  {
    icon: "ShoppingCart",
    label: "생활 편의시설",
    info_text: null,
    hide_info: false,
    places: [],
  },
  {
    icon: "Building2",
    label: "상급병원/대형마트",
    info_text: null,
    hide_info: false,
    places: [],
  },
];

const DEFAULT_NEARBY_CATEGORY_LABELS = new Set(
  DEFAULT_NEARBY_CATEGORIES.map((cat) => cat.label),
);


const normalizeHousePlanSpecs = (specs: HousePlanSpecs): HousePlanSpecs => {
  const allExisting = [...specs.main, ...specs.collapsed];

  // Fresh property: seed all default labels as empty templates.
  if (allExisting.length === 0) {
    return { main: DEFAULT_HOUSE_PLAN_ROWS.map((r) => ({ ...r })), collapsed: [] };
  }

  // Preserve the user's saved order — deduplicate only, no re-sorting.
  const seen = new Set<string>();
  const orderedRows: HousePlanSpecRow[] = [];
  for (const row of allExisting) {
    const key = row.label.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    orderedRows.push({ ...row });
  }

  return { main: orderedRows, collapsed: [] };
};

const normalizeNearbyPlaces = (cats: NearbyCategory[]): NearbyCategory[] => {
  const cloned = cats.map((cat) => ({
    ...cat,
    info_text: cat.info_text ?? null,
    hide_info: cat.hide_info ?? false,
    places: cat.places.map((pl) => ({ ...pl })),
  }));
  const existingByLabel = new Map<string, NearbyCategory>();

  for (const cat of cloned) {
    const key = cat.label.trim();
    if (!key || existingByLabel.has(key)) continue;
    existingByLabel.set(key, cat);
  }

  const mergedDefaults = DEFAULT_NEARBY_CATEGORIES.map((base) => {
    const existing = existingByLabel.get(base.label);
    const existingPlacesByName = new Map(
      (existing?.places ?? [])
        .filter((place) => place.name.trim().length > 0)
        .map((place) => [place.name.trim(), place]),
    );
    const basePlaceNames = new Set(base.places.map((place) => place.name.trim()));

    const mergedPlaces = base.places.map((place) => {
      const found = existingPlacesByName.get(place.name.trim());
      return found ? { ...place, ...found } : { ...place };
    });

    const extraExistingPlaces = (existing?.places ?? [])
      .filter((place) => !basePlaceNames.has(place.name.trim()))
      .map((place) => ({ ...place }));

    return {
      icon: existing?.icon || base.icon,
      label: base.label,
      info_text: existing?.info_text ?? base.info_text ?? null,
      hide_info: existing?.hide_info ?? base.hide_info ?? false,
      places: [...mergedPlaces, ...extraExistingPlaces],
    };
  });

  const extraCategories = cloned
    .filter((cat) => !DEFAULT_NEARBY_CATEGORY_LABELS.has(cat.label.trim()))
    .map((cat) => ({
      ...cat,
      info_text: cat.info_text ?? null,
      hide_info: cat.hide_info ?? false,
      places: cat.places.map((place) => ({ ...place })),
    }));

  return [...mergedDefaults, ...extraCategories];
};

const normalizeEvaluationMetrics = (
  metrics: EvaluationMetric[],
): EvaluationMetric[] => {
  const seen = new Set<string>();
  return metrics
    .filter((metric) => {
      const key = metric.title.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((metric) => ({ ...metric }));
};

const isDefaultHousePlanRow = (row: HousePlanSpecRow): boolean =>
  DEFAULT_HOUSE_PLAN_LABELS.has(row.label.trim());

const fromProperty = (p: Property): FormState => ({
  specs: { ...p.specs },
  house_plan_specs: normalizeHousePlanSpecs(p.house_plan_specs),
  nearby_places: normalizeNearbyPlaces(p.nearby_places),
  evaluation_metrics: normalizeEvaluationMetrics(p.evaluation_metrics),
});

const NearbyMetricsTab = ({ property }: { property: Property }) => {
  const update = useUpdateProperty(property.id);
  const [form, setForm] = useState<FormState>(() => fromProperty(property));
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => setForm(fromProperty(property)), [property]);
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(fromProperty(property)),
    [form, property],
  );
  useDirtyGuard(dirty);

  const onSave = async () => {
    setSaveErr(null);
    try {
      await update.mutateAsync({
        specs: form.specs,
        house_plan_specs: form.house_plan_specs,
        nearby_places: form.nearby_places,
        evaluation_metrics: form.evaluation_metrics,
      });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  };

  // ---- specs ----
  const setSpec = <K extends keyof Specs>(k: K, v: Specs[K]) =>
    setForm((f) => ({ ...f, specs: { ...f.specs, [k]: v } }));

  // ---- house plan specs ----
  const updateRow = (
    section: "main" | "collapsed",
    idx: number,
    patch: Partial<HousePlanSpecRow>,
  ) =>
    setForm((f) => ({
      ...f,
      house_plan_specs: {
        ...f.house_plan_specs,
        [section]: f.house_plan_specs[section].map((r, i) =>
          i === idx ? { ...r, ...patch } : r,
        ),
      },
    }));
  const addRow = (section: "main" | "collapsed") =>
    setForm((f) => ({
      ...f,
      house_plan_specs: {
        ...f.house_plan_specs,
        [section]: [
          ...f.house_plan_specs[section],
          { label: "", value: "", info_text: null, hide_info: false },
        ],
      },
    }));
  const removeRow = (section: "main" | "collapsed", idx: number) =>
    setForm((f) => ({
      ...f,
      house_plan_specs: {
        ...f.house_plan_specs,
        [section]: f.house_plan_specs[section].filter((_, i) => i !== idx),
      },
    }));
  const moveRow = (section: "main" | "collapsed", idx: number, dir: -1 | 1) =>
    setForm((f) => {
      const rows = [...f.house_plan_specs[section]];
      const target = idx + dir;
      if (target < 0 || target >= rows.length) return f;
      [rows[idx], rows[target]] = [rows[target], rows[idx]];
      return { ...f, house_plan_specs: { ...f.house_plan_specs, [section]: rows } };
    });

  // ---- nearby ----
  const addCategory = () =>
    setForm((f) => ({
      ...f,
      nearby_places: [
        ...f.nearby_places,
        { icon: "MapPin", label: "", info_text: null, hide_info: false, places: [] },
      ],
    }));
  const updateCategory = (idx: number, patch: Partial<NearbyCategory>) =>
    setForm((f) => ({
      ...f,
      nearby_places: f.nearby_places.map((c, i) =>
        i === idx ? { ...c, ...patch } : c,
      ),
    }));
  const removeCategory = (idx: number) =>
    setForm((f) => ({
      ...f,
      nearby_places: f.nearby_places.filter((_, i) => i !== idx),
    }));
  const addPlace = (catIdx: number) =>
    setForm((f) => ({
      ...f,
      nearby_places: f.nearby_places.map((c, i) =>
        i === catIdx
          ? {
            ...c,
            places: [
              ...c.places,
              {
                name: isChildcareCategoryLabel(c.label)
                  ? `${DEFAULT_CHILDCARE_SUBCATEGORY} · `
                  : "",
              },
            ],
          }
          : c,
      ),
    }));
  const updatePlace = (
    catIdx: number,
    placeIdx: number,
    patch: Partial<{ name: string; distance: string | null }>,
  ) =>
    setForm((f) => ({
      ...f,
      nearby_places: f.nearby_places.map((c, i) =>
        i !== catIdx
          ? c
          : {
            ...c,
            places: c.places.map((p, j) =>
              j === placeIdx ? { ...p, ...patch } : p,
            ),
          },
      ),
    }));
  const removePlace = (catIdx: number, placeIdx: number) =>
    setForm((f) => ({
      ...f,
      nearby_places: f.nearby_places.map((c, i) =>
        i !== catIdx
          ? c
          : { ...c, places: c.places.filter((_, j) => j !== placeIdx) },
      ),
    }));

  // ---- metrics ----
  const updateMetric = (idx: number, patch: Partial<EvaluationMetric>) =>
    setForm((f) => ({
      ...f,
      evaluation_metrics: f.evaluation_metrics.map((m, i) =>
        i === idx ? { ...m, ...patch } : m,
      ),
    }));
  const addMetric = () =>
    setForm((f) => ({
      ...f,
      evaluation_metrics: [
        ...f.evaluation_metrics,
        { score: 0, title: "", description: "" },
      ],
    }));
  const removeMetric = (idx: number) =>
    setForm((f) => ({
      ...f,
      evaluation_metrics: f.evaluation_metrics.filter((_, i) => i !== idx),
    }));

  return (
    <div className="space-y-8">
      {/* Specs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">매물 기본 specs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(
            [
              ["beds", "방 개수", "number"],
              ["baths", "화장실 개수", "number"],
              ["land_area", "대지 면적", "text"],
              ["built_year", "사용승인", "text"],
              ["indoor_area", "실내 면적", "text"],
              ["scale", "설계구조", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              {isSpecAreaKey(key) ? (
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className={form.specs[key] ? "pr-10" : ""}
                    placeholder="-"
                    value={
                      typeof form.specs[key] === "string"
                        ? stripAreaUnit(form.specs[key] ?? "")
                        : ""
                    }
                    onChange={(e) => {
                      const withUnit = addAreaUnit(e.target.value);
                      setSpec(key, (withUnit || null) as Specs[typeof key]);
                    }}
                  />
                  {form.specs[key] && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {AREA_UNIT}
                    </span>
                  )}
                </div>
              ) : (
                <Input
                  type={type}
                  value={(form.specs[key] ?? "") as string | number}
                  onChange={(e) =>
                    setSpec(
                      key,
                      type === "number"
                        ? (Number(e.target.value) || null)
                        : (e.target.value || null),
                    )
                  }
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* House plan specs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">건물 정보 (HousePlan)</h2>
        {(["main", "collapsed"] as const).map((section) => (
          <div key={section} className="space-y-2">
            <h3 className="text-xs text-muted-foreground">
              {section === "main" ? "기본 표시" : "더보기"}
            </h3>
            {form.house_plan_specs[section].map((row, idx) => {
              // Keep baseline house-plan labels fixed.
              // Values are still editable, and custom rows can be added/removed.
              const locked = section === "main" && isDefaultHousePlanRow(row);
              const valuePlaceholder =
                DEFAULT_HOUSE_PLAN_VALUE_PLACEHOLDERS.get(row.label.trim()) ?? "값";
              const areaUnitRow = isAreaValueRowLabel(row.label);
              const displayedValue = areaUnitRow ? stripAreaUnit(row.value) : row.value;
              const hideInfoId = `house-plan-hide-info-${section}-${idx}`;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <Input
                      className="w-1/3"
                      placeholder="라벨"
                      value={row.label}
                      readOnly={locked}
                      onChange={(e) =>
                        updateRow(section, idx, { label: e.target.value })
                      }
                    />
                    <div className="relative flex-1">
                      <Input
                        className={areaUnitRow ? "pr-10" : ""}
                        placeholder={valuePlaceholder}
                        value={displayedValue}
                        onChange={(e) =>
                          updateRow(section, idx, {
                            value: areaUnitRow
                              ? addAreaUnit(e.target.value)
                              : e.target.value,
                          })
                        }
                      />
                      {areaUnitRow && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {AREA_UNIT}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => moveRow(section, idx, -1)}
                      disabled={idx === 0}
                      className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(section, idx, 1)}
                      disabled={idx === form.house_plan_specs[section].length - 1}
                      className="h-8 w-8 flex items-center justify-center rounded-sm hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(section, idx)}
                      disabled={locked}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="flex-1 min-w-[16rem]"
                      placeholder="info 안내 문구 (선택)"
                      value={row.info_text ?? ""}
                      onChange={(e) =>
                        updateRow(section, idx, {
                          info_text: e.target.value || null,
                        })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={hideInfoId}
                        checked={row.hide_info ?? false}
                        onCheckedChange={(checked) =>
                          updateRow(section, idx, { hide_info: checked === true })
                        }
                      />
                      <Label htmlFor={hideInfoId} className="text-xs text-muted-foreground">
                        info 표시하지 않기
                      </Label>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addRow(section)}
            >
              <Plus className="w-4 h-4 mr-1" /> 행 추가
            </Button>
          </div>
        ))}
      </section>

      {/* Nearby */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">주변 시설</h2>
        {form.nearby_places.map((cat, idx) => (
          <div
            key={idx}
            className="bg-card border border-border rounded-sm p-3 space-y-3"
          >
            <div className="flex gap-2 items-center">
              <select
                className="border border-border rounded-sm px-2 py-1.5 text-sm bg-background"
                value={cat.icon}
                onChange={(e) =>
                  updateCategory(idx, { icon: e.target.value })
                }
              >
                {ICON_OPTIONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <Input
                placeholder="카테고리명 (예: 어린이집/유치원)"
                value={cat.label}
                onChange={(e) =>
                  updateCategory(idx, { label: e.target.value })
                }
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCategory(idx)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="flex-1 min-w-[16rem]"
                placeholder="info 안내 문구 (선택)"
                value={cat.info_text ?? ""}
                onChange={(e) =>
                  updateCategory(idx, { info_text: e.target.value || null })
                }
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`nearby-hide-info-${idx}`}
                  checked={cat.hide_info ?? false}
                  onCheckedChange={(checked) =>
                    updateCategory(idx, { hide_info: checked === true })
                  }
                />
                <Label
                  htmlFor={`nearby-hide-info-${idx}`}
                  className="text-xs text-muted-foreground"
                >
                  info 표시하지 않기
                </Label>
              </div>
            </div>
            <div className="space-y-1.5 pl-2">
              {cat.places.map((place, pIdx) => {
                const sep = place.name.indexOf(' · ');
                const subcat = sep !== -1 ? place.name.substring(0, sep) : '';
                const actualName = sep !== -1 ? place.name.substring(sep + 3) : place.name;
                const childcareCategory = isChildcareCategoryLabel(cat.label);
                const childcareSubcat = toChildcareSubcategory(subcat || place.name);
                const namePlaceholder = childcareCategory
                  ? "어린이집 이름 (예: 사과나무어린이집)"
                  : "장소명 (예: CU 보라빌리지점)";
                return (
                  <div key={pIdx} className="flex gap-1.5 items-center">
                    {childcareCategory ? (
                      <select
                        className="w-28 shrink-0 text-xs border border-border rounded-sm px-2 py-2 bg-background"
                        value={childcareSubcat}
                        onChange={(e) =>
                          updatePlace(idx, pIdx, {
                            name: combinePlaceName(e.target.value, actualName),
                          })
                        }
                      >
                        {CHILDCARE_SUBCATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        className="w-28 shrink-0 text-xs"
                        placeholder="구분 (예: 편의점)"
                        value={subcat}
                        onChange={(e) =>
                          updatePlace(idx, pIdx, {
                            name: combinePlaceName(e.target.value, actualName),
                          })
                        }
                      />
                    )}
                    <span className="text-muted-foreground text-sm shrink-0">·</span>
                    <Input
                      className="flex-1"
                      placeholder={namePlaceholder}
                      value={actualName}
                      onChange={(e) => {
                        const subcategory = childcareCategory ? childcareSubcat : subcat;
                        const combined = combinePlaceName(subcategory, e.target.value);
                        updatePlace(idx, pIdx, { name: combined });
                      }}
                    />
                    <Input
                      className="w-32"
                      placeholder="거리 (선택)"
                      value={place.distance ?? ""}
                      onChange={(e) =>
                        updatePlace(idx, pIdx, {
                          distance: e.target.value || null,
                        })
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlace(idx, pIdx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addPlace(idx)}
              >
                <Plus className="w-4 h-4 mr-1" /> 장소 추가
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCategory}
        >
          <Plus className="w-4 h-4 mr-1" /> 카테고리 추가
        </Button>
      </section>

      {/* Metrics */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">평가 지표</h2>
        {form.evaluation_metrics.map((m, idx) => (
          <div
            key={idx}
            className="bg-card border border-border rounded-sm p-3 space-y-2"
          >
            <div className="flex gap-2 items-center">
              <Input
                className="w-20"
                type="number"
                min={0}
                max={100}
                value={m.score}
                onChange={(e) =>
                  updateMetric(idx, { score: Number(e.target.value) || 0 })
                }
              />
              <Input
                className="flex-1"
                placeholder="제목"
                value={m.title}
                onChange={(e) => updateMetric(idx, { title: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeMetric(idx)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Textarea
              rows={2}
              placeholder="설명"
              value={m.description}
              onChange={(e) =>
                updateMetric(idx, { description: e.target.value })
              }
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addMetric}>
          <Plus className="w-4 h-4 mr-1" /> 지표 추가
        </Button>
      </section>

      <SaveBar
        dirty={dirty}
        saving={update.isPending}
        onSave={onSave}
        error={saveErr}
      />
    </div>
  );
};

export default NearbyMetricsTab;
