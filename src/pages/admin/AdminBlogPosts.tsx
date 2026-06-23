import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, Pencil, Trash2, RotateCcw, Eye, EyeOff, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pager } from "@/components/blog/Pager";
import {
  useAdminBlogPosts,
  useAdminPublishPost,
  useAdminUnpublishPost,
  useAdminDeletePost,
  useAdminRestorePost,
} from "@/hooks/useAdminBlog";
import { useToast } from "@/hooks/use-toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { BlogPostListItem } from "@/types/blog";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  published: { label: "게시됨", variant: "default" },
  draft: { label: "초안", variant: "secondary" },
};

export default function AdminBlogPosts() {
  useDocumentTitle("블로그 글 관리 | 관리자 | 하우스인어스");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  useEffect(() => setPage(0), [statusFilter, includeDeleted]);

  const { data, isLoading } = useAdminBlogPosts({
    status: statusFilter,
    include_deleted: includeDeleted,
    skip: page * PAGE_SIZE,
    limit: PAGE_SIZE,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const publish = useAdminPublishPost();
  const unpublish = useAdminUnpublishPost();
  const deletePost = useAdminDeletePost();
  const restorePost = useAdminRestorePost();

  const handlePublish = async (id: string) => {
    try {
      await publish.mutateAsync(id);
      toast({ title: "게시되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await unpublish.mutateAsync(id);
      toast({ title: "게시 취소되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" 글을 삭제할까요? 나중에 복구할 수 있습니다.`)) return;
    try {
      await deletePost.mutateAsync(id);
      toast({ title: "삭제되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restorePost.mutateAsync(id);
      toast({ title: "복구되었습니다." });
    } catch {
      toast({ title: "오류가 발생했습니다.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">블로그 글 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            블로그 글 목록을 확인하고 새 글을 추가합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-sm text-muted-foreground">
              전체 {data.total.toLocaleString()}개
            </span>
          )}
          <Button asChild>
            <Link to="/admin/blog/posts/new">
              <Plus className="w-4 h-4 mr-2" />
              새 글 작성
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {[undefined, "published", "draft"].map((s) => (
          <button
            key={String(s)}
            type="button"
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
            onClick={() => setStatusFilter(s)}
          >
            {s === undefined ? "전체" : s === "published" ? "게시됨" : "초안"}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground ml-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            className="rounded"
          />
          삭제된 글 포함
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          글이 없습니다. 새 글을 작성해보세요.
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg divide-y divide-border">
            {data.items.map((post) => (
              <PostRow
                key={post.id}
                post={post as BlogPostListItem & { deleted_at?: string | null }}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
                onDelete={handleDelete}
                onRestore={handleRestore}
              />
            ))}
          </div>
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function PostRow({
  post,
  onPublish,
  onUnpublish,
  onDelete,
  onRestore,
}: {
  post: BlogPostListItem & { deleted_at?: string | null };
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onRestore: (id: string) => void;
}) {
  const isDeleted = !!(post as any).deleted_at;
  const statusInfo = STATUS_LABELS[post.status] ?? { label: post.status, variant: "outline" as const };

  return (
    <div className={`flex items-start gap-3 p-4 ${isDeleted ? "opacity-60" : ""}`}>
      {/* Thumbnail */}
      <div className="w-16 h-12 rounded overflow-hidden bg-muted shrink-0">
        {post.cover_image_url ? (
          <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">📝</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <Link
            to={`/admin/blog/posts/${post.id}/edit`}
            className="font-medium text-sm line-clamp-1 hover:underline"
          >
            {post.title}
          </Link>
          <Badge variant={statusInfo.variant} className="text-xs shrink-0">
            {statusInfo.label}
          </Badge>
          {isDeleted && <Badge variant="destructive" className="text-xs">삭제됨</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
          {post.tags.map((t) => (
            <span key={t.id} className="bg-secondary rounded-full px-2 py-0.5">
              {t.name}
            </span>
          ))}
          <span>
            {format(new Date(post.reference_date), "yyyy.MM.dd", { locale: ko })}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!isDeleted && (
          <>
            {post.status === "published" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  title="블로그에서 보기"
                >
                  <Link to={`/blog/${post.slug}`} target="_blank">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  title="게시 취소"
                  onClick={() => onUnpublish(post.id)}
                >
                  <EyeOff className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                title="게시하기"
                onClick={() => onPublish(post.id)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild title="수정">
              <Link to={`/admin/blog/posts/${post.id}/edit`}>
                <Pencil className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="삭제"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(post.id, post.title)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
        {isDeleted && (
          <Button
            variant="ghost"
            size="sm"
            title="복구"
            onClick={() => onRestore(post.id)}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
