/** Shared user types used by the auth context and admin user-management pages. */

export type UserRole = "user" | "admin" | "owner";
export type UserStatus = "active" | "suspended" | "deleted";

/**
 * Full user record as returned by admin endpoints (`/api/v1/admin/users`).
 * Wider than `AuthUser` because the admin list/detail views surface
 * moderation fields (ban_*) and profile metadata.
 */
export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  banned_at: string | null;
  ban_reason: string | null;
  banned_by_id: string | null;
  email_verified_at: string | null;
  phone_number: string | null;
  profile_image_url: string | null;
  timezone: string | null;
  locale: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
