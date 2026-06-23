import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  BlogMenuItem,
  BlogMenuItemCreate,
  BlogMenuItemUpdate,
  BlogPostAdminDetail,
  BlogPostCreate,
  BlogPostListResponse,
  BlogPostUpdate,
  BlogTag,
  BlogTagCreate,
} from "@/types/blog";

// ─── Tags ────────────────────────────────────────────────────────────────────

export function useAdminBlogTags() {
  return useQuery<BlogTag[]>({
    queryKey: ["admin", "blog", "tags"],
    queryFn: () => api<BlogTag[]>("/api/v1/admin/blog/tags"),
  });
}

export function useAdminCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BlogTagCreate) =>
      api<BlogTag>("/api/v1/admin/blog/tags", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "tags"] });
      qc.invalidateQueries({ queryKey: ["blog", "tags"] });
    },
  });
}

export function useAdminUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BlogTagCreate> }) =>
      api<BlogTag>(`/api/v1/admin/blog/tags/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "tags"] });
      qc.invalidateQueries({ queryKey: ["blog", "tags"] });
    },
  });
}

export function useAdminDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/blog/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "tags"] });
      qc.invalidateQueries({ queryKey: ["blog", "tags"] });
    },
  });
}

// ─── Posts ───────────────────────────────────────────────────────────────────

export function useAdminBlogPosts(params: {
  status?: string;
  include_deleted?: boolean;
  skip?: number;
  limit?: number;
} = {}) {
  const { status, include_deleted = false, skip = 0, limit = 50 } = params;
  return useQuery<BlogPostListResponse>({
    queryKey: ["admin", "blog", "posts", { status, include_deleted, skip, limit }],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (include_deleted) qs.set("include_deleted", "true");
      qs.set("skip", String(skip));
      qs.set("limit", String(limit));
      return api<BlogPostListResponse>(`/api/v1/admin/blog/posts?${qs}`);
    },
  });
}

export function useAdminBlogPost(id: string | undefined) {
  return useQuery<BlogPostAdminDetail>({
    queryKey: ["admin", "blog", "posts", id],
    queryFn: () => api<BlogPostAdminDetail>(`/api/v1/admin/blog/posts/${id}`),
    enabled: !!id,
  });
}

export function useAdminCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BlogPostCreate) =>
      api<BlogPostAdminDetail>("/api/v1/admin/blog/posts", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blog", "posts"] }),
  });
}

export function useAdminUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BlogPostUpdate }) =>
      api<BlogPostAdminDetail>(`/api/v1/admin/blog/posts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts"] });
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts", id] });
    },
  });
}

export function useAdminPublishPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<BlogPostAdminDetail>(`/api/v1/admin/blog/posts/${id}/publish`, { method: "POST" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts"] });
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts", id] });
      qc.invalidateQueries({ queryKey: ["blog", "posts"] });
    },
  });
}

export function useAdminUnpublishPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<BlogPostAdminDetail>(`/api/v1/admin/blog/posts/${id}/unpublish`, { method: "POST" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts"] });
      qc.invalidateQueries({ queryKey: ["admin", "blog", "posts", id] });
      qc.invalidateQueries({ queryKey: ["blog", "posts"] });
    },
  });
}

export function useAdminDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/blog/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blog", "posts"] }),
  });
}

export function useAdminRestorePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<BlogPostAdminDetail>(`/api/v1/admin/blog/posts/${id}/restore`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "blog", "posts"] }),
  });
}

export function useAdminUploadBlogImage() {
  return useMutation({
    mutationFn: async (file: File): Promise<{ url: string }> => {
      const form = new FormData();
      form.append("file", file);
      return api<{ url: string }>("/api/v1/admin/blog/images", {
        method: "POST",
        body: form,
      });
    },
  });
}

// ─── Menu ────────────────────────────────────────────────────────────────────

export function useAdminBlogMenu() {
  return useQuery<BlogMenuItem[]>({
    queryKey: ["admin", "blog", "menu"],
    queryFn: () => api<BlogMenuItem[]>("/api/v1/admin/blog/menu"),
  });
}

export function useAdminCreateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BlogMenuItemCreate) =>
      api<BlogMenuItem>("/api/v1/admin/blog/menu", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "menu"] });
      qc.invalidateQueries({ queryKey: ["blog", "menu"] });
    },
  });
}

export function useAdminUpdateMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BlogMenuItemUpdate }) =>
      api<BlogMenuItem>(`/api/v1/admin/blog/menu/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "menu"] });
      qc.invalidateQueries({ queryKey: ["blog", "menu"] });
    },
  });
}

export function useAdminDeleteMenuItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/api/v1/admin/blog/menu/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "menu"] });
      qc.invalidateQueries({ queryKey: ["blog", "menu"] });
    },
  });
}

export function useAdminReorderMenu() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ordered_ids: string[]) =>
      api("/api/v1/admin/blog/menu/reorder", {
        method: "POST",
        body: JSON.stringify({ ordered_ids }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "blog", "menu"] });
      qc.invalidateQueries({ queryKey: ["blog", "menu"] });
    },
  });
}
