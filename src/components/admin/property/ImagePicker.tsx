import { useMemo, useState } from "react";
import { Check, ImageIcon, Pencil } from "lucide-react";
import type { PropertyImage } from "@/types/property";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  images: PropertyImage[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
  /** When true, includes a "no selection" option in the dialog. */
  allowNone?: boolean;
  /** Trigger label when no image is selected. */
  emptyLabel?: string;
  /** Trigger label when an image IS selected (placed next to the thumbnail). */
  changeLabel?: string;
}

/**
 * Compact image selector. Shows the current selection as a small preview
 * button; opens a dialog with the full grid on click. Same external API
 * (`images`, `selectedId`, `onSelect`) as before.
 */
const ImagePicker = ({
  images,
  selectedId,
  onSelect,
  className = "",
  allowNone = true,
  emptyLabel = "이미지 선택",
  changeLabel = "이미지 교체",
}: Props) => {
  const [open, setOpen] = useState(false);
  const selected = images.find((i) => i.id === selectedId);
  const sortedImages = useMemo(
    () =>
      [...images].sort(
        (a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
      ),
    [images],
  );

  const pick = (id: string | null) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {selected ? (
          <button
            type="button"
            className={`group flex items-center gap-3 w-full text-left p-2 border border-border rounded-sm hover:border-primary/40 transition-colors ${className}`}
          >
            <div className="w-16 h-16 flex-shrink-0 bg-secondary rounded-sm overflow-hidden">
              <img
                src={selected.url}
                alt={selected.alt ?? selected.original_filename}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">
                {selected.original_filename}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {Math.round(selected.byte_size / 1024).toLocaleString()} KB
              </p>
            </div>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1 px-2 py-1 rounded-sm group-hover:text-primary">
              <Pencil className="w-3 h-3" />
              {changeLabel}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className={`flex items-center justify-center gap-2 w-full p-3 border border-dashed border-border rounded-sm text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors ${className}`}
          >
            <ImageIcon className="w-4 h-4" />
            {emptyLabel}
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>이미지 선택</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {images.length === 0 && !allowNone ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              업로드된 이미지가 없습니다. 먼저 사진 업로드 영역에서 추가해주세요.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {allowNone && (
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className={`relative aspect-square border rounded-sm flex flex-col items-center justify-center text-xs text-muted-foreground transition-colors ${
                    selectedId === null
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <ImageIcon className="w-5 h-5 mb-1" />
                  <span>(없음)</span>
                  {selectedId === null && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              )}
              {sortedImages.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => pick(img.id)}
                  className={`relative aspect-square border rounded-sm overflow-hidden transition-all ${
                    selectedId === img.id
                      ? "border-primary ring-2 ring-primary"
                      : "border-border hover:border-primary/40"
                  }`}
                  title={img.original_filename}
                >
                  <img
                    src={img.url}
                    alt={img.alt ?? img.original_filename}
                    className="w-full h-full object-cover"
                  />
                  {selectedId === img.id && (
                    <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
          {images.length}장의 이미지 중 하나를 선택하세요.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ImagePicker;
