import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useUpdateProperty } from "@/hooks/useAdminProperties";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import {
  compareFloorKeys,
  defaultFloorplanLabel,
  FLOOR_PICK_OPTIONS,
  formatFloorLabel,
} from "@/lib/floor";
import type { FloorplanEntry, Property } from "@/types/property";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUploader from "@/components/admin/property/ImageUploader";
import ImagePicker from "@/components/admin/property/ImagePicker";
import SaveBar from "@/components/admin/property/SaveBar";

const FloorplansTab = ({ property }: { property: Property }) => {
  const qc = useQueryClient();
  const update = useUpdateProperty(property.id);
  const [floorplans, setFloorplans] = useState<Record<string, FloorplanEntry>>(
    () => ({ ...property.floorplans }),
  );
  const [floorToAdd, setFloorToAdd] = useState<string>("1");
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    setFloorplans({ ...property.floorplans });
  }, [property]);

  const dirty = useMemo(
    () => JSON.stringify(floorplans) !== JSON.stringify(property.floorplans),
    [floorplans, property.floorplans],
  );
  useDirtyGuard(dirty);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["admin-property", property.id] });

  const sortedFloors = Object.keys(floorplans).sort(compareFloorKeys);
  const addableFloorOptions = FLOOR_PICK_OPTIONS.filter(
    (opt) => !Object.prototype.hasOwnProperty.call(floorplans, String(opt.value)),
  );

  useEffect(() => {
    if (addableFloorOptions.length === 0) {
      if (floorToAdd !== "") setFloorToAdd("");
      return;
    }
    if (!addableFloorOptions.some((opt) => String(opt.value) === floorToAdd)) {
      setFloorToAdd(String(addableFloorOptions[0].value));
    }
  }, [addableFloorOptions, floorToAdd]);

  const setEntry = (floor: string, entry: FloorplanEntry | null) => {
    setFloorplans((curr) => {
      const next = { ...curr };
      if (entry) next[floor] = entry;
      else delete next[floor];
      return next;
    });
  };

  const addFloor = () => {
    if (!floorToAdd) return;
    const next = Number(floorToAdd);
    if (!Number.isFinite(next)) return;
    if (Object.prototype.hasOwnProperty.call(floorplans, String(next))) return;

    setFloorplans((curr) => ({
      ...curr,
      [String(next)]: { image_id: "", label: defaultFloorplanLabel(next) },
    }));
  };

  const onSave = async () => {
    setSaveErr(null);
    try {
      // Drop empty entries (no image selected).
      const cleaned: Record<string, FloorplanEntry> = {};
      for (const [k, v] of Object.entries(floorplans)) {
        if (v.image_id) cleaned[k] = v;
      }
      await update.mutateAsync({ floorplans: cleaned });
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">평면도 (층별)</h2>
        <p className="text-xs text-muted-foreground">
          각 층마다 평면도 이미지를 1장씩 등록하세요. 인테리어 사진의 사각형 좌표는 이 평면도 위에 그려집니다.
        </p>

        {sortedFloors.length === 0 && (
          <div className="text-xs text-muted-foreground italic">
            등록된 평면도가 없습니다. 아래에서 층을 선택해 시작하세요.
          </div>
        )}

        {sortedFloors.map((floor) => {
          const entry = floorplans[floor];
          return (
            <div
              key={floor}
              className="bg-card border border-border rounded-sm p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-medium">{formatFloorLabel(floor)}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEntry(floor, null)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> 이 층 삭제
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">라벨</Label>
                <Input
                  value={entry.label}
                  onChange={(e) =>
                    setEntry(floor, { ...entry, label: e.target.value })
                  }
                  placeholder={defaultFloorplanLabel(floor)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">이미지 선택</Label>
                <ImagePicker
                  images={property.images}
                  selectedId={entry.image_id || null}
                  onSelect={(id) =>
                    setEntry(floor, { ...entry, image_id: id ?? "" })
                  }
                />
              </div>
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={floorToAdd}
            onValueChange={setFloorToAdd}
            disabled={addableFloorOptions.length === 0}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="층 선택" />
            </SelectTrigger>
            <SelectContent>
              {addableFloorOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addFloor}
            disabled={!floorToAdd || addableFloorOptions.length === 0}
          >
            <Plus className="w-4 h-4 mr-1" /> 층 추가
          </Button>
        </div>
        {addableFloorOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            기본 층 옵션을 모두 추가했습니다.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">평면도 이미지 업로드</h3>
        <ImageUploader
          propertyId={property.id}
          onUploaded={() => refresh()}
          label="평면도 이미지 업로드"
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

export default FloorplansTab;
