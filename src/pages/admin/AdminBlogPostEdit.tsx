import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, EyeOff, Save, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TiptapEditor } from "@/components/admin/blog/TiptapEditor";
import {
  useAdminBlogPost,
  useAdminCreatePost,
  useAdminUpdatePost,
  useAdminPublishPost,
  useAdminUnpublishPost,
  useAdminDeletePost,
  useAdminRestorePost,
  useAdminBlogTags,
  useAdminUploadBlogImage,
} from "@/hooks/useAdminBlog";
import { useToast } from "@/hooks/use-toast";
import { useDirtyGuard } from "@/hooks/useDirtyGuard";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { BlogPostCreate, BlogPostUpdate } from "@/types/blog";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

function generateSlugSuggestion(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "post-";
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default function AdminBlogPostEdit() {
  const { postId } = useParams<{ postId?: string }>();
  const isNew = !postId;
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: post, isLoading: postLoading } = useAdminBlogPost(isNew ? undefined : postId);
  const { data: allTags } = useAdminBlogTags();

  useDocumentTitle(
    isNew
      ? "새 글 작성 | 블로그 관리 | 관리자 | 하우스인어스"
      : post
        ? `${post.title} 편집 | 블로그 관리 | 관리자 | 하우스인어스`
        : "글 편집 | 블로그 관리 | 관리자 | 하우스인어스",
  );

  const createPost = useAdminCreatePost();
  const updatePost = useAdminUpdatePost();
  const publishPost = useAdminPublishPost();
  const unpublishPost = useAdminUnpublishPost();
  const deletePost = useAdminDeletePost();
  const restorePost = useAdminRestorePost();
  const uploadImage = useAdminUploadBlogImage();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState(isNew ? generateSlugSuggestion() : "");
  const [excerpt, setExcerpt] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [content, setContent] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useDirtyGuard(isDirty);

  const draftKey = isNew ? "blog-draft-new" : `blog-draft-${postId}`;

  // Populate form when editing existing post
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setSlug(post.slug);
      setExcerpt(post.excerpt ?? "");
      setCoverImageUrl(post.cover_image_url ?? "");
      setSelectedTagIds(post.tags.map((t) => t.id));
      setContent(post.content ?? {});
      setReferenceDate(toDatetimeLocal(post.reference_date));
      setIsDirty(false);
    }
  }, [post]);

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadImage.mutateAsync(file);
      setCoverImageUrl(url);
      setIsDirty(true);
    } catch {
      toast({ title: "이미지 업로드 실패", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "제목을 입력해주세요.", variant: "destructive" });
      return;
    }
    if (!slug.trim()) {
      toast({ title: "슬러그를 입력해주세요.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const payload: BlogPostCreate = {
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim() || null,
          cover_image_url: coverImageUrl.trim() || null,
          content,
          tag_ids: selectedTagIds,
          reference_date: referenceDate ? new Date(referenceDate).toISOString() : null,
        };
        const created = await createPost.mutateAsync(payload);
        // Clear draft from localStorage
        try { localStorage.removeItem(draftKey); } catch {}
        setIsDirty(false);
        toast({ title: "글이 저장되었습니다." });
        navigate(`/admin/blog/posts/${created.id}/edit`, { replace: true });
      } else if (postId) {
        const payload: BlogPostUpdate = {
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim() || null,
          cover_image_url: coverImageUrl.trim() || null,
          content,
          tag_ids: selectedTagIds,
          reference_date: referenceDate ? new Date(referenceDate).toISOString() : null,
        };
        await updatePost.mutateAsync({ id: postId, payload });
        try { localStorage.removeItem(draftKey); } catch {}
        setIsDirty(false);
        toast({ title: "저장되었습니다." });
      }
    } catch (err: any) {
      toast({ title: err?.message ?? "저장 실패", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isDirty) {
      toast({ title: "저장 후 게시할 수 있습니다.", variant: "destructive" });
      return;
    }
    if (!postId || isNew) return;
    try {
      await publishPost.mutateAsync(postId);
      toast({ title: "게시되었습니다." });
    } catch (err: any) {
      toast({ title: err?.message ?? "게시 실패", variant: "destructive" });
    }
  };

  const handleUnpublish = async () => {
    if (!postId || isNew) return;
    try {
      await unpublishPost.mutateAsync(postId);
      toast({ title: "게시 취소되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!postId || isNew) return;
    if (!confirm("이 글을 삭제할까요? 나중에 복구할 수 있습니다.")) return;
    try {
      await deletePost.mutateAsync(postId);
      toast({ title: "삭제되었습니다." });
      navigate("/admin/blog/posts");
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleRestore = async () => {
    if (!postId || isNew) return;
    try {
      await restorePost.mutateAsync(postId);
      toast({ title: "복구되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
    setIsDirty(true);
  };

  if (!isNew && postLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPublished = post?.status === "published";
  const isDeleted = !!(post as any)?.deleted_at;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/blog/posts">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold flex-1">
          {isNew ? "새 글 작성" : "글 수정"}
        </h1>
        {isDirty && (
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
            미저장
          </span>
        )}
        <div className="flex items-center gap-2">
          {!isNew && isPublished && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/blog/${post?.slug}`} target="_blank">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                보기
              </Link>
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <Input
              placeholder="글 제목"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
              className="text-3xl md:text-3xl font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>

          {/* Editor */}
          <TiptapEditor
            content={content}
            onChange={(c) => { setContent(c); setIsDirty(true); }}
            draftKey={draftKey}
            onDirtyChange={setIsDirty}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Publish actions */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-semibold">게시 설정</h2>

            {isDeleted ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive">이 글은 삭제되었습니다.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleRestore}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  복구
                </Button>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  상태:{" "}
                  <span className={isPublished ? "text-primary font-medium" : "text-foreground"}>
                    {isPublished ? "게시됨" : "초안"}
                  </span>
                </div>
                {!isNew && (
                  <>
                    {!isPublished ? (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={handlePublish}
                        disabled={isDirty}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        게시하기
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleUnpublish}
                      >
                        <EyeOff className="w-3.5 h-3.5 mr-1" />
                        게시 취소
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      삭제
                    </Button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Slug */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-sm font-semibold">URL 슬러그</Label>
            <Input
              placeholder="my-post-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setIsDirty(true); }}
              className="text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              영문 소문자, 숫자, 하이픈(-)만 사용
            </p>
          </div>

          {/* Excerpt */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-sm font-semibold">요약</Label>
            <Textarea
              placeholder="글 목록에 표시될 짧은 요약 (선택)"
              value={excerpt}
              onChange={(e) => { setExcerpt(e.target.value); setIsDirty(true); }}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Cover image */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-sm font-semibold">커버 이미지</Label>
            {coverImageUrl && (
              <div className="relative aspect-video rounded overflow-hidden mb-2">
                <img src={coverImageUrl} alt="커버" className="w-full h-full object-cover" />
                <button
                  type="button"
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  onClick={() => { setCoverImageUrl(""); setIsDirty(true); }}
                >
                  ✕
                </button>
              </div>
            )}
            <label className="block">
              <span className="sr-only">이미지 업로드</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleCoverImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  (e.currentTarget.previousElementSibling as HTMLElement | null)?.click();
                }}
                disabled={uploadImage.isPending}
              >
                {uploadImage.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : null}
                이미지 업로드
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">또는 URL 직접 입력</p>
            <Input
              placeholder="https://..."
              value={coverImageUrl}
              onChange={(e) => { setCoverImageUrl(e.target.value); setIsDirty(true); }}
              className="text-sm"
            />
          </div>

          {/* Reference date */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-sm font-semibold">기준일시</Label>
            <input
              type="datetime-local"
              value={referenceDate}
              onChange={(e) => { setReferenceDate(e.target.value); setIsDirty(true); }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              글 목록 정렬 및 표시 날짜 기준. 비워두면 저장 시 현재 시각으로 설정됩니다.
            </p>
          </div>

          {/* Tags */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <Label className="text-sm font-semibold">태그</Label>
            {allTags && allTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                        selected
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                태그가 없습니다.{" "}
                <Link to="/admin/blog/tags" className="text-primary hover:underline">
                  태그 관리
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
