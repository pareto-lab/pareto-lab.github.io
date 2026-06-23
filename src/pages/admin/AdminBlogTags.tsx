import { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAdminBlogTags,
  useAdminCreateTag,
  useAdminUpdateTag,
  useAdminDeleteTag,
} from "@/hooks/useAdminBlog";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { BlogTag } from "@/types/blog";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminBlogTags() {
  useDocumentTitle("블로그 태그 관리 | 관리자 | 하우스인어스");
  const { data: tags, isLoading } = useAdminBlogTags();
  const createTag = useAdminCreateTag();
  const updateTag = useAdminUpdateTag();
  const deleteTag = useAdminDeleteTag();
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) {
      toast({ title: "이름과 슬러그를 입력해주세요.", variant: "destructive" });
      return;
    }
    try {
      await createTag.mutateAsync({ name: newName.trim(), slug: newSlug.trim() });
      setNewName("");
      setNewSlug("");
      toast({ title: "태그가 생성되었습니다." });
    } catch (err: any) {
      toast({ title: err?.message ?? "생성 실패", variant: "destructive" });
    }
  };

  const handleEditSave = async () => {
    if (!editingId || !editName.trim() || !editSlug.trim()) return;
    try {
      await updateTag.mutateAsync({ id: editingId, payload: { name: editName.trim(), slug: editSlug.trim() } });
      setEditingId(null);
      toast({ title: "수정되었습니다." });
    } catch (err: any) {
      toast({ title: err?.message ?? "수정 실패", variant: "destructive" });
    }
  };

  const handleDelete = async (tag: BlogTag) => {
    if (!confirm(`"${tag.name}" 태그를 삭제할까요?`)) return;
    try {
      await deleteTag.mutateAsync(tag.id);
      toast({ title: "삭제되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const startEdit = (tag: BlogTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditSlug(tag.slug);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">블로그 태그 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            태그를 만들고 블로그 글에 분류를 추가하세요.
          </p>
        </div>
        {tags && (
          <span className="text-sm text-muted-foreground">
            전체 {tags.length.toLocaleString()}개
          </span>
        )}
      </div>

      {/* Create new tag */}
      <div className="border border-border rounded-lg p-4 space-y-3 max-w-2xl">
        <h2 className="text-sm font-medium">새 태그 추가</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">이름</label>
            <Input
              placeholder="태그 이름"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (!newSlug) setNewSlug(slugify(e.target.value));
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">슬러그 (URL용)</label>
            <Input
              placeholder="tag-slug"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className="font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={createTag.isPending}
        >
          {createTag.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
          추가
        </Button>
      </div>

      {/* Tag list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !tags || tags.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          태그가 없습니다.
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border max-w-2xl">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-3 p-3">
              {editingId === tag.id ? (
                <>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                    />
                    <Input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="h-8 text-sm font-mono"
                      onKeyDown={(e) => e.key === "Enter" && handleEditSave()}
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleEditSave} disabled={updateTag.isPending}>
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{tag.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{tag.slug}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(tag.created_at), "yyyy.MM.dd", { locale: ko })}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(tag)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(tag)}
                    disabled={deleteTag.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
