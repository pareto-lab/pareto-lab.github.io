export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  status: "draft" | "published";
  reference_date: string;
  tags: BlogTag[];
}

export interface BlogPostDetail extends BlogPostListItem {
  content: Record<string, unknown>;
}

export interface BlogPostAdminDetail extends BlogPostDetail {
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by_id: string | null;
  updated_by_id: string | null;
}

export interface BlogPostListResponse {
  items: BlogPostListItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface BlogMenuItem {
  id: string;
  label: string;
  icon: string | null;
  tag_id: string | null;
  tag: BlogTag | null;
  parent_id: string | null;
  sort_order: number;
  children: BlogMenuItem[];
}

export interface BlogPostCreate {
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  content: Record<string, unknown>;
  tag_ids: string[];
  reference_date?: string | null;
}

export interface BlogPostUpdate {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  content?: Record<string, unknown>;
  tag_ids?: string[];
  reference_date?: string | null;
}

export interface BlogTagCreate {
  name: string;
  slug: string;
}

export interface BlogMenuItemCreate {
  label: string;
  icon?: string | null;
  tag_id?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

export interface BlogMenuItemUpdate {
  label?: string;
  icon?: string | null;
  tag_id?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}
