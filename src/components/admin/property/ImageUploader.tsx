import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { uploadPropertyImage } from "@/hooks/useAdminProperties";
import type { PropertyImage } from "@/types/property";
import { Button } from "@/components/ui/button";

interface Props {
  propertyId: string;
  multiple?: boolean;
  accept?: string;
  /** Called once per successfully uploaded image. */
  onUploaded: (image: PropertyImage) => void;
  className?: string;
  label?: string;
}

const ImageUploader = ({
  propertyId,
  multiple = true,
  accept = "image/jpeg,image/png,image/webp",
  onUploaded,
  className = "",
  label = "이미지 업로드",
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0); // count of in-flight uploads
  const [errors, setErrors] = useState<string[]>([]);
  const [hover, setHover] = useState(false);

  const upload = async (files: FileList | File[]) => {
    setErrors([]);
    const list = Array.from(files);
    setBusy((c) => c + list.length);
    for (const file of list) {
      try {
        const img = await uploadPropertyImage(propertyId, file);
        onUploaded(img);
      } catch (err) {
        setErrors((e) => [
          ...e,
          `${file.name}: ${err instanceof Error ? err.message : String(err)}`,
        ]);
      } finally {
        setBusy((c) => c - 1);
      }
    }
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void upload(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHover(false);
    if (e.dataTransfer.files) void upload(e.dataTransfer.files);
  };

  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-sm p-6 text-center transition-colors ${
          hover
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={onChange}
        />
        <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          파일을 끌어다 놓거나 버튼으로 선택
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy > 0}
        >
          {busy > 0 ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {busy > 0 ? `업로드 중 (${busy})` : label}
        </Button>
      </div>

      {errors.length > 0 && (
        <div className="mt-2 space-y-1">
          {errors.map((err, i) => (
            <div
              key={i}
              className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-2 py-1 flex items-start justify-between gap-2"
            >
              <span className="break-all">{err}</span>
              <button
                onClick={() => setErrors((e) => e.filter((_, j) => j !== i))}
                className="flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
