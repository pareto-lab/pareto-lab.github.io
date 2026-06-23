import { useEffect, useMemo, useState } from "react";
import { useUpdateProperty } from "@/hooks/useAdminProperties";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import type { Property } from "@/types/property";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import StringListEditor from "@/components/admin/property/StringListEditor";
import SaveBar from "@/components/admin/property/SaveBar";

interface FormState {
  title: string;
  subtitle: string;
  location: string;
  price: number;
  slug: string;
  display_order: number;
  tags: string[];
  lifestyle_story: string;
  lifestyle_story_overlay: boolean;
  lifestyle_highlights: string[];
}

const fromProperty = (p: Property): FormState => ({
  title: p.title,
  subtitle: p.subtitle ?? "",
  location: p.location,
  price: p.price,
  slug: p.slug ?? "",
  display_order: p.display_order,
  tags: p.tags,
  lifestyle_story: p.lifestyle_story ?? "",
  lifestyle_story_overlay: p.lifestyle_story_overlay ?? false,
  lifestyle_highlights: p.lifestyle_highlights,
});

const BasicTab = ({ property }: { property: Property }) => {
  const [form, setForm] = useState<FormState>(() => fromProperty(property));
  const [saveError, setSaveError] = useState<string | null>(null);
  const update = useUpdateProperty(property.id);

  useEffect(() => {
    setForm(fromProperty(property));
  }, [property]);

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(fromProperty(property));
  }, [form, property]);

  useDirtyGuard(dirty);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onSave = async () => {
    setSaveError(null);
    try {
      await update.mutateAsync({
        title: form.title,
        subtitle: form.subtitle || null,
        location: form.location,
        price: form.price,
        slug: form.slug || null,
        display_order: form.display_order,
        tags: form.tags.filter((t) => t.trim()),
        lifestyle_story: form.lifestyle_story || null,
        lifestyle_story_overlay: form.lifestyle_story_overlay,
        lifestyle_highlights: form.lifestyle_highlights.filter((t) => t.trim()),
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">제목</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="subtitle">부제</Label>
          <Input
            id="subtitle"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="여유로운 아침과 창의적인 오후를 위한 공간"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">위치</Label>
          <Input
            id="location"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">가격 (원)</Label>
          <Input
            id="price"
            type="number"
            value={form.price}
            onChange={(e) => set("price", Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">슬러그 (선택)</Label>
          <Input
            id="slug"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="yongin-forest-house"
          />
          <p className="text-xs text-muted-foreground">
            지정 시 /properties/&lt;slug&gt; 로도 접근 가능. 비우면 UUID 만 사용.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="order">정렬 우선순위</Label>
          <Input
            id="order"
            type="number"
            value={form.display_order}
            onChange={(e) => set("display_order", Number(e.target.value) || 0)}
          />
          <p className="text-xs text-muted-foreground">
            숫자가 작을수록 먼저 노출.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>태그</Label>
        <StringListEditor
          value={form.tags}
          onChange={(v) => set("tags", v)}
          placeholder="예: 강남으로 출근"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="story">이 집의 이야기 (lifestyleStory)</Label>
        <Textarea
          id="story"
          rows={10}
          value={form.lifestyle_story}
          onChange={(e) => set("lifestyle_story", e.target.value)}
          placeholder="단락 사이에 빈 줄을 두면 사이트에서 단락이 분리되어 표시됩니다."
        />
        <p className="text-xs text-muted-foreground">
          빈 줄(엔터 두 번)로 단락 구분. 사이트의 &ldquo;이 집의 이야기&rdquo; 섹션에 그대로 들어갑니다.
        </p>
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id="story-overlay"
            checked={form.lifestyle_story_overlay}
            onCheckedChange={(v) => set("lifestyle_story_overlay", v)}
          />
          <Label htmlFor="story-overlay" className="text-xs font-normal cursor-pointer">
            이미지 위에 텍스트 겹치기 (PDF 2페이지: 이미지 전체 + 텍스트 overlay)
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>기다리는 순간들 (lifestyleHighlights)</Label>
        <StringListEditor
          value={form.lifestyle_highlights}
          onChange={(v) => set("lifestyle_highlights", v)}
          placeholder="예: 숲유치원 도보 통학"
        />
      </div>

      <SaveBar
        dirty={dirty}
        saving={update.isPending}
        onSave={onSave}
        error={saveError}
      />
    </div>
  );
};

export default BasicTab;
