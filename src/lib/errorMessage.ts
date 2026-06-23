/**
 * Translate API error codes into user-facing Korean messages.
 *
 * Convention (see AGENTS.md → "API 에러 코드 규약"):
 *   - API responses look like ``{ code: "kebab-or-snake", detail: "..." }``.
 *   - The frontend NEVER renders ``detail`` directly to users — it switches
 *     on ``code`` and picks a copy string.
 *   - Each feature/page maintains a small map of the codes it expects, and
 *     falls back to a generic message for the rest.
 */

import { ApiError } from "@/lib/apiClient";

/** Catch-all phrasing when a feature page doesn't recognize a code. */
const GENERIC_FALLBACK = "요청을 처리하지 못했습니다.";

/** Codes that almost every page wants to translate the same way. */
const COMMON_MESSAGES: Record<string, string> = {
  "http-401": "로그인이 필요합니다.",
  "http-403": "권한이 없습니다.",
  "http-404": "찾을 수 없습니다.",
  "http-500": "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  "http-502": "서버에 연결할 수 없습니다.",
  "http-503": "서비스가 일시적으로 사용할 수 없습니다.",
  "validation-error": "입력값이 올바르지 않습니다.",
  "network-error": "네트워크에 연결할 수 없습니다.",
};

/**
 * Resolve an unknown error to a user-facing message, preferring the
 * caller-supplied per-feature map. Non-API errors fall through to a generic
 * line — never raw exception text.
 */
export function messageForError(
  err: unknown,
  featureMessages: Record<string, string> = {},
  fallback: string = GENERIC_FALLBACK,
): string {
  if (err instanceof ApiError) {
    return featureMessages[err.code] ?? COMMON_MESSAGES[err.code] ?? fallback;
  }
  return fallback;
}
