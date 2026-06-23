import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import type { BlogPostListItem } from "@/types/blog";

interface BlogPostCardProps {
  post: BlogPostListItem;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const publishedDate = format(new Date(post.reference_date), "yyyy.MM.dd", { locale: ko });

  return (
    <Link to={`/blog/${post.slug}`} className="group block">
      <article className="flex flex-col h-full">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-muted mb-3">
          {post.cover_image_url ? (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-muted flex items-center justify-center">
              <span className="text-muted-foreground text-3xl">📝</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="text-xs text-primary font-medium bg-primary/8 px-2 py-0.5 rounded-full"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {post.excerpt}
          </p>
        )}

        {/* Date */}
        <div className="mt-auto pt-2 text-xs text-muted-foreground">
          {publishedDate}
        </div>
      </article>
    </Link>
  );
}
