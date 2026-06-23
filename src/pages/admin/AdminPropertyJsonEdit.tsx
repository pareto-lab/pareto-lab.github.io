import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Code2,
  ExternalLink,
  FileText,
  Loader2,
  Save,
} from "lucide-react";
import { useAdminProperty, useUpdateProperty } from "@/hooks/useAdminProperties";
import { adaptProperty } from "@/lib/propertyAdapter";
import PropertyDetailBody from "@/components/PropertyDetailBody";
import ImageUploader from "@/components/admin/property/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Property } from "@/types/property";
import promptText from "@/assets/prompts/property-draft.md?raw";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Fields editable via the JSON tab. Image-id refs are kept too so users can
// paste the IDs they got from the uploader, but `images`/`hero_image`/etc.
// are excluded — those are owned by the upload pipeline.
const EDITABLE_KEYS = [
  "title",
  "subtitle",
  "location",
  "price",
  "slug",
  "display_order",
  "tags",
  "lifestyle_story",
  "lifestyle_highlights",
  "specs",
  "loan_info",
  "house_plan_specs",
  "nearby_places",
  "evaluation_metrics",
  "interior_photos",
  "floorplans",
  "lifestyle_scenarios",
] as const;

type EditableKey = (typeof EDITABLE_KEYS)[number];

const pickEditable = (p: Property): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_KEYS) out[key] = p[key as EditableKey];
  return out;
};

const AdminPropertyJsonEdit = () => {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: property, isLoading, error } = useAdminProperty(id);
  useDocumentTitle(
    property
      ? `${property.title} JSON 편집 | 관리자 | 하우스인어스`
      : "JSON 편집 | 관리자 | 하우스인어스",
  );
  const update = useUpdateProperty(id ?? "");

  const [text, setText] = useState<string>("");
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null);

  // Initialize editor text once the property loads.
  useEffect(() => {
    if (!property) return;
    setText((current) => current || JSON.stringify(pickEditable(property), null, 2));
  }, [property]);

  // Re-parse whenever text changes.
  useEffect(() => {
    if (!text.trim()) {
      setParseErr(null);
      setParsed(null);
      return;
    }
    try {
      const value = JSON.parse(text);
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("최상위는 객체여야 합니다.");
      }
      setParsed(value as Record<string, unknown>);
      setParseErr(null);
    } catch (err) {
      setParseErr(err instanceof Error ? err.message : String(err));
    }
  }, [text]);

  // Build the property used for live preview by overlaying parsed JSON onto
  // the loaded API property, then running through the adapter.
  const previewProperty = useMemo(() => {
    if (!property) return null;
    const merged: Property = { ...property };
    if (parsed) {
      for (const key of EDITABLE_KEYS) {
        if (key in parsed) {
          // Trust the user — pydantic enforces shape on save anyway.
          (merged as unknown as Record<string, unknown>)[key] = parsed[key];
        }
      }
    }
    try {
      return adaptProperty(merged);
    } catch {
      return null;
    }
  }, [property, parsed]);

  const onSave = async () => {
    if (!parsed) {
      toast.error("JSON이 비어있거나 파싱에 실패했습니다.");
      return;
    }
    try {
      await update.mutateAsync(parsed);
      toast.success("저장되었습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "저장에 실패했습니다.");
    }
  };

  if (!id) return <Navigate to="/admin/properties" replace />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error || !property) {
    return (
      <div className="p-12 text-center">
        <h2 className="font-serif text-2xl mb-2">매물을 불러오지 못했습니다</h2>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "알 수 없는 오류"}
        </p>
      </div>
    );
  }

  return (
    <div className="-m-4 md:-m-8 flex flex-col min-h-[calc(100vh-4rem)]">
      <Tabs defaultValue="json" className="flex-1 flex flex-col min-h-0">
        <div className="sticky top-16 md:top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
          <Toolbar
            propertyId={id}
            onSave={onSave}
            saving={update.isPending}
            canSave={!!parsed && !parseErr}
          />
          <div className="px-4 md:px-6 pb-2">
            <TabsList>
              <TabsTrigger value="json">
                <Code2 className="h-3.5 w-3.5 mr-1.5" />
                JSON 편집
              </TabsTrigger>
              <TabsTrigger value="preview">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                미리보기
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent
          value="json"
          className="flex-1 mt-0 bg-card flex flex-col min-h-0"
        >
          <div className="px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" />
              JSON 본문 — `PropertyUpdate` 스키마에 맞게
            </span>
            {parseErr ? (
              <span className="text-destructive">{parseErr}</span>
            ) : parsed ? (
              <span className="text-emerald-600 dark:text-emerald-500 flex items-center gap-1">
                <Check className="h-3 w-3" /> valid
              </span>
            ) : null}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-[60vh] font-mono text-[13px] leading-5 px-4 py-3 bg-card outline-none resize-none whitespace-pre overflow-auto"
          />
        </TabsContent>

        <TabsContent value="preview" className="flex-1 mt-0 bg-background">
          {previewProperty ? (
            <PropertyDetailBody
              property={previewProperty}
              trackViews={false}
              backLink={null}
            />
          ) : (
            <div className="p-12 text-center text-sm text-muted-foreground">
              JSON 파싱이 완료되면 여기에 미리보기가 표시됩니다.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ImageBox
        property={property}
        onUploaded={() =>
          qc.invalidateQueries({ queryKey: ["admin-property", property.id] })
        }
      />
    </div>
  );
};

const Toolbar = ({
  propertyId,
  onSave,
  saving,
  canSave,
}: {
  propertyId: string;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}) => {
  return (
    <div className="px-4 md:px-6 py-3 flex items-center gap-2 flex-wrap">
      <Button variant="ghost" size="sm" asChild>
        <Link to={`/admin/properties/${propertyId}`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          편집으로
        </Link>
      </Button>
      <div className="text-sm font-medium flex items-center gap-1.5">
        <Code2 className="h-4 w-4 text-primary" />
        JSON 수정
      </div>
      <div className="flex-1" />
      <PromptDialog />
      <Button variant="outline" size="sm" asChild>
        <Link to={`/admin/properties/${propertyId}/preview`}>
          <ExternalLink className="h-4 w-4 mr-1" />
          미리보기 페이지
        </Link>
      </Button>
      <Button size="sm" onClick={onSave} disabled={!canSave || saving}>
        {saving ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-1" />
        )}
        저장
      </Button>
    </div>
  );
};

const PromptDialog = () => {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <FileText className="h-3.5 w-3.5 mr-1" />
          생성용 프롬프트 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>매물 JSON 생성용 프롬프트</DialogTitle>
          <DialogDescription>
            ChatGPT 같은 LLM에 그대로 붙여넣으면 매물 JSON 초안이 나옵니다.
            매물 정보 칸의 (예: ...) 부분을 실제 데이터로 채워서 사용하세요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onCopy} variant={copied ? "default" : "outline"}>
            {copied ? (
              <Check className="h-3.5 w-3.5 mr-1" />
            ) : (
              <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
            )}
            {copied ? "복사됨" : "프롬프트 복사"}
          </Button>
        </div>
        <pre className="text-xs bg-muted/40 border border-border rounded-sm p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono leading-5">
          {promptText}
        </pre>
      </DialogContent>
    </Dialog>
  );
};

const ImageBox = ({
  property,
  onUploaded,
}: {
  property: Property;
  onUploaded: () => void;
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      toast.error("복사 실패");
    }
  };

  return (
    <div className="border-t border-border bg-card px-4 md:px-6 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold">이미지 업로드</div>
          <div className="text-xs text-muted-foreground">
            올린 이미지의 ID를 복사해서 JSON의 `interior_photos` /{" "}
            `floorplans` / `lifestyle_scenarios` 등에 붙여넣으세요.
          </div>
        </div>
      </div>

      <ImageUploader
        propertyId={property.id}
        onUploaded={onUploaded}
        label="이미지 추가"
      />

      {property.images.length === 0 ? (
        <div className="text-xs text-muted-foreground">
          아직 업로드된 이미지가 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {property.images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => copy(img.id)}
              className="group relative aspect-square border border-border rounded-sm overflow-hidden text-left"
              title={`클릭해서 ID 복사: ${img.id}`}
            >
              <img
                src={img.url}
                alt={img.alt ?? img.original_filename}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-background/85 backdrop-blur-sm px-1.5 py-1 text-[10px] font-mono truncate flex items-center gap-1">
                {copiedId === img.id ? (
                  <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : (
                  <ClipboardCopy className="h-3 w-3 shrink-0 opacity-60" />
                )}
                {img.id.slice(0, 8)}…
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPropertyJsonEdit;
