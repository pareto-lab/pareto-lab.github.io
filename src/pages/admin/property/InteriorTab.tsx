import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { useUpdateProperty } from "@/hooks/useAdminProperties";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import { formatFloorLabel } from "@/lib/floor";
import type { BeforePosition, InteriorPhoto, Property } from "@/types/property";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUploader from "@/components/admin/property/ImageUploader";
import ImagePicker from "@/components/admin/property/ImagePicker";
import FloorplanRectEditor, {
  type Rect,
} from "@/components/admin/property/FloorplanRectEditor";
import SaveBar from "@/components/admin/property/SaveBar";

const blankPhoto = (): InteriorPhoto => ({
  image_id: "",
  caption: "",
  room: "",
  portrait: false,
  floor: 1,
  floorplan_rect: [0, 0, 0, 0],
});

const BEFORE_POSITIONS: { value: BeforePosition; label: string }[] = [
  { value: "top-left", label: "좌측 상단" },
  { value: "top-right", label: "우측 상단" },
  { value: "bottom-left", label: "좌측 하단" },
  { value: "bottom-right", label: "우측 하단" },
];

const InteriorTab = ({ property }: { property: Property }) => {
  const qc = useQueryClient();
  const update = useUpdateProperty(property.id);
  const [photos, setPhotos] = useState<InteriorPhoto[]>(
    () => property.interior_photos.map((p) => ({ ...p })),
  );
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    setPhotos(property.interior_photos.map((p) => ({ ...p })));
  }, [property]);

  const dirty = useMemo(
    () =>
      JSON.stringify(photos) !== JSON.stringify(property.interior_photos),
    [photos, property.interior_photos],
  );
  useDirtyGuard(dirty);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["admin-property", property.id] });

  const update_ = (idx: number, patch: Partial<InteriorPhoto>) =>
    setPhotos((curr) =>
      curr.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );

  const move = (idx: number, dir: -1 | 1) => {
    setPhotos((curr) => {
      const next = [...curr];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return curr;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setOpenIdx((curr) => (curr === idx ? idx + dir : curr));
  };

  const removeAt = (idx: number) =>
    setPhotos((curr) => curr.filter((_, i) => i !== idx));

  const onSave = async () => {
    setSaveErr(null);
    try {
      await update.mutateAsync({
        interior_photos: photos.filter((p) => p.image_id).map((p) => ({
          ...p,
          before_image_id: p.before_image_id || undefined,
          before_position: p.before_image_id ? p.before_position : undefined,
          swapped: p.before_image_id ? p.swapped : undefined,
        })),
      });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  };

  const floors = useMemo(() => {
    const values = new Set<number>();
    for (const floor of Object.keys(property.floorplans)) {
      const parsed = Number(floor);
      if (Number.isFinite(parsed)) values.add(parsed);
    }
    for (const photo of photos) {
      values.add(photo.floor);
    }
    if (values.size === 0) values.add(1);
    return Array.from(values).sort((a, b) => a - b);
  }, [property.floorplans, photos]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">인테리어 사진</h2>
        <p className="text-xs text-muted-foreground">
          각 사진마다 방 이름, 층, 그리고 평면도 위 사각형 영역을 지정합니다.
          평면도가 등록되지 않은 층은 사각형을 그릴 수 없으니{" "}
          <strong>먼저 "평면도" 탭에서 등록</strong>해주세요.
        </p>

        {photos.map((photo, idx) => {
          const open = openIdx === idx;
          const fp = property.floorplans[String(photo.floor)];
          const fpImage = fp
            ? property.images.find((i) => i.id === fp.image_id)
            : null;
          const photoImage = property.images.find((i) => i.id === photo.image_id);
          return (
            <div
              key={idx}
              className="bg-card border border-border rounded-sm overflow-hidden"
            >
              <div className="flex items-center gap-1 pr-2">
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="flex items-center gap-3 min-w-0 flex-1 p-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 bg-secondary rounded-sm overflow-hidden flex-shrink-0">
                      {photoImage && (
                        <img
                          src={photoImage.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        #{idx + 1} {photo.room || "(방 미지정)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatFloorLabel(photo.floor)} · {photo.caption || "(캡션 없음)"}
                      </p>
                    </div>
                  </div>
                  {open ? (
                    <ChevronUp className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  )}
                </button>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === photos.length - 1}
                    className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {open && (
                <div className="p-3 border-t border-border space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">방 이름</Label>
                      <Input
                        value={photo.room}
                        onChange={(e) =>
                          update_(idx, { room: e.target.value })
                        }
                        placeholder="예: 거실"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">층</Label>
                      <Select
                        value={String(photo.floor)}
                        onValueChange={(v) =>
                          update_(idx, {
                            floor: Number(v),
                            floorplan_rect: [0, 0, 0, 0],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {floors.map((f) => (
                            <SelectItem key={f} value={String(f)}>
                              {formatFloorLabel(f)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">캡션</Label>
                    <Input
                      value={photo.caption}
                      onChange={(e) =>
                        update_(idx, { caption: e.target.value })
                      }
                      placeholder="이 사진에 대한 한 줄 설명"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id={`portrait-${idx}`}
                      checked={photo.portrait}
                      onCheckedChange={(v) => update_(idx, { portrait: v })}
                    />
                    <Label htmlFor={`portrait-${idx}`} className="text-xs">
                      세로형 사진 (사이트에서 contain 모드로 표시)
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">사진 선택</Label>
                    <ImagePicker
                      images={property.images}
                      selectedId={photo.image_id || null}
                      onSelect={(id) =>
                        update_(idx, { image_id: id ?? "" })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">평면도 영역</Label>
                    {fpImage ? (
                      <FloorplanRectEditor
                        imageUrl={fpImage.url}
                        value={photo.floorplan_rect}
                        onChange={(r: Rect) =>
                          update_(idx, { floorplan_rect: r })
                        }
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-sm p-3">
                        {formatFloorLabel(photo.floor)} 평면도가 아직 등록되지 않았습니다. "평면도" 탭에서 먼저 등록하세요.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`before-${idx}`}
                        checked={!!photo.before_image_id}
                        onCheckedChange={(v) =>
                          update_(idx, v
                            ? { before_image_id: "", before_position: "bottom-right" }
                            : { before_image_id: undefined, before_position: undefined }
                          )
                        }
                      />
                      <Label htmlFor={`before-${idx}`} className="text-xs">
                        Before/After 비교 사진 사용
                      </Label>
                    </div>

                    {photo.before_image_id !== undefined && (
                      <div className="space-y-3 pl-1">
                        <div className="space-y-2">
                          <Label className="text-xs">Before 사진 (작게 표시될 사진)</Label>
                          <ImagePicker
                            images={property.images}
                            selectedId={photo.before_image_id || null}
                            onSelect={(id) => update_(idx, { before_image_id: id ?? "" })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`swapped-${idx}`}
                            checked={photo.swapped ?? false}
                            onCheckedChange={(v) => update_(idx, { swapped: v })}
                          />
                          <Label htmlFor={`swapped-${idx}`} className="text-xs">
                            자리바꾸기 (현재 사진이 메인, AI 제안이 작게)
                          </Label>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">
                            {photo.swapped ? "AI 제안 사진 위치" : "Before 사진 위치"}
                          </Label>
                          <div className="grid grid-cols-2 gap-2 w-fit">
                            {BEFORE_POSITIONS.map(({ value, label }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => update_(idx, { before_position: value })}
                                className={`text-xs px-3 py-1.5 rounded-sm border transition-colors ${
                                  photo.before_position === value
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAt(idx)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      삭제
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setPhotos((curr) => [...curr, blankPhoto()]);
            setOpenIdx(photos.length);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> 사진 추가
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">사진 업로드</h3>
        <ImageUploader
          propertyId={property.id}
          onUploaded={() => refresh()}
          label="인테리어 사진 업로드"
        />
      </div>

      <SaveBar
        dirty={dirty}
        saving={update.isPending}
        onSave={onSave}
        error={saveErr}
      />
    </div>
  );
};

export default InteriorTab;
