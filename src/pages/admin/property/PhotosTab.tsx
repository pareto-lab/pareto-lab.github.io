import { Trash2 } from "lucide-react";
import {
  useDeleteImage,
  useUpdateProperty,
} from "@/hooks/useAdminProperties";
import { useQueryClient } from "@tanstack/react-query";
import type { Property } from "@/types/property";
import ImageUploader from "@/components/admin/property/ImageUploader";
import ImagePicker from "@/components/admin/property/ImagePicker";

const PhotosTab = ({ property }: { property: Property }) => {
  const qc = useQueryClient();
  const update = useUpdateProperty(property.id);
  const deleteImg = useDeleteImage(property.id);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["admin-property", property.id] });

  // Images "available" for hero/portfolio thumb selection — exclude those
  // already wired to interior_photos / scenarios / floorplans to reduce noise.
  const usedIds = new Set<string>();
  for (const ip of property.interior_photos) usedIds.add(ip.image_id);
  for (const s of property.lifestyle_scenarios) usedIds.add(s.image_id);
  for (const fp of Object.values(property.floorplans)) usedIds.add(fp.image_id);
  const standalone = property.images.filter((img) => !usedIds.has(img.id));

  const setHero = async (id: string | null) => {
    await update.mutateAsync({ hero_image_id: id });
  };
  const setThumb = async (id: string | null) => {
    await update.mutateAsync({ portfolio_thumb_id: id });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">대표 이미지 (Hero)</h2>
        <p className="text-xs text-muted-foreground">
          매물 상세 상단에 풀 너비로 깔리는 이미지. 가로형 권장.
        </p>
        <ImagePicker
          images={standalone.concat(
            // Always include the currently selected ones even if used elsewhere
            property.hero_image && !standalone.find((i) => i.id === property.hero_image!.id)
              ? [property.hero_image]
              : [],
          )}
          selectedId={property.hero_image?.id ?? null}
          onSelect={setHero}
        />
        <ImageUploader
          propertyId={property.id}
          onUploaded={() => refresh()}
          label="대표 이미지 후보 업로드"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">포트폴리오 썸네일</h2>
        <p className="text-xs text-muted-foreground">
          소개서 인쇄 뷰의 라이프스타일 섹션에 표시되는 썸네일 이미지.
        </p>
        <ImagePicker
          images={standalone.concat(
            property.portfolio_thumb &&
              !standalone.find((i) => i.id === property.portfolio_thumb!.id)
              ? [property.portfolio_thumb]
              : [],
          )}
          selectedId={property.portfolio_thumb?.id ?? null}
          onSelect={setThumb}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">기타 업로드된 이미지</h2>
        <p className="text-xs text-muted-foreground">
          인테리어/시나리오/평면도 어디에도 연결되지 않은 이미지들. 정리하거나 다른 탭에서 사용하세요.
        </p>
        {standalone.length === 0 ? (
          <div className="text-xs text-muted-foreground">없음</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {standalone.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square border border-border rounded-sm overflow-hidden group"
              >
                <img
                  src={img.url}
                  alt={img.alt ?? img.original_filename}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => deleteImg.mutate(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PhotosTab;
