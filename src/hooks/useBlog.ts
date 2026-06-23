import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  BlogMenuItem,
  BlogPostDetail,
  BlogPostListResponse,
  BlogTag,
} from "@/types/blog";

export function useBlogMenu() {
  return useQuery<BlogMenuItem[]>({
    queryKey: ["blog", "menu"],
    queryFn: () => api<BlogMenuItem[]>("/api/v1/blog/menu"),
    staleTime: 60_000,
  });
}

export function useBlogTags() {
  return useQuery<BlogTag[]>({
    queryKey: ["blog", "tags"],
    queryFn: () => api<BlogTag[]>("/api/v1/blog/tags"),
    staleTime: 60_000,
  });
}

export function useBlogPosts(params: { tag?: string; skip?: number; limit?: number } = {}) {
  const { tag, skip = 0, limit = 12 } = params;
  return useQuery<BlogPostListResponse>({
    queryKey: ["blog", "posts", { tag, skip, limit }],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (tag) qs.set("tag", tag);
      qs.set("skip", String(skip));
      qs.set("limit", String(limit));
      return api<BlogPostListResponse>(`/api/v1/blog/posts?${qs}`);
    },
  });
}

export function useBlogPost(slug: string) {
  return useQuery<BlogPostDetail>({
    queryKey: ["blog", "posts", slug],
    queryFn: () => api<BlogPostDetail>(`/api/v1/blog/posts/${slug}`),
    enabled: !!slug,
  });
}
