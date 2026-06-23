import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Download, ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProperty } from "@/hooks/useProperties";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import InteriorPhotoCard from "@/components/InteriorPhotoCard";
import { buildCardCanvas } from "@/lib/buildCardCanvas";
import type { UploadMode } from "@/lib/buildCardCanvas";
import type { InteriorPhoto } from "@/data/properties";

const CSS_W = 390;

const PropertyUploadImages = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { property, isLoading } = useProperty(id);
  useDocumentTitle(property ? `${property.title} 이미지 업로드 | 하우스인어스` : undefined);
  const [mode, setMode] = useState<UploadMode>(
    searchParams.get("mode") === "daangn" ? "daangn" : "peterpan",
  );
  const [downloading, setDownloading] = useState<number | "all" | null>(null);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
  if (!property) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">매물을 찾을 수 없습니다</p>
    </div>
  );

  const photos: InteriorPhoto[] = property.interiorPhotos ?? [];

  const downloadOne = async (i: number) => {
    const photo = photos[i];
    const fp = property.floorplans?.[String(photo.floor)];
    setDownloading(i);
    try {
      const canvas = await buildCardCanvas(photo, fp, mode);
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/jpeg", 0.95);
      a.download = `${mode}_${String(i + 1).padStart(2, "0")}_${photo.room}.jpg`;
      a.click();
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    setDownloading("all");
    try {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const fp = property.floorplans?.[String(photo.floor)];
        const canvas = await buildCardCanvas(photo, fp, mode);
        const a = document.createElement("a");
        a.href = canvas.toDataURL("image/jpeg", 0.95);
        a.download = `${mode}_${String(i + 1).padStart(2, "0")}_${photo.room}.jpg`;
        a.click();
        await new Promise(r => setTimeout(r, 300));
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      <div className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex rounded-sm border border-border overflow-hidden text-xs shrink-0">
          {(["peterpan", "daangn"] as UploadMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 transition-colors ${
                mode === m
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              {m === "peterpan" ? "피터팬" : "당근"}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="gap-2 min-w-0 flex-1"
          onClick={downloadAll}
          disabled={photos.length === 0 || downloading !== null}
        >
          {downloading === "all"
            ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            : <ImageDown className="w-4 h-4 shrink-0" />}
          <span className="truncate">전체 다운로드 ({photos.length}장)</span>
        </Button>
      </div>

      <div className="py-8 flex flex-col gap-8 items-center">
        {photos.length === 0 ? (
          <p className="text-muted-foreground py-20">등록된 인테리어 사진이 없습니다.</p>
        ) : photos.map((photo, i) => {
          const fp = property.floorplans?.[String(photo.floor)];
          return (
            <div key={i} className="flex flex-col gap-2">
              <div
                style={{ width: CSS_W }}
                className="mx-auto overflow-hidden rounded border border-border bg-card"
              >
                <InteriorPhotoCard photo={photo} floorplan={fp} fixedCaption squarePhoto={mode === "daangn"} />
              </div>
              <div
                className="flex items-center justify-between px-1"
                style={{ width: CSS_W, margin: "0 auto" }}
              >
                <span className="text-xs text-muted-foreground">
                  #{i + 1} {photo.room}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={downloading !== null}
                  onClick={() => downloadOne(i)}
                >
                  {downloading === i
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  저장
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PropertyUploadImages;
