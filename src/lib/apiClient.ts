/**
 * Thin fetch wrapper for the houseinus-api.
 *
 * Auth token is stored in localStorage under TOKEN_KEY and attached as
 * `Authorization: Bearer ...` on every request. On 401 responses the token is
 * cleared automatically.
 */

export const TOKEN_KEY = "houseinus_token";

/**
 * Standard error envelope from the API: `{ code: string, detail: unknown }`.
 *
 * The frontend should branch on ``code`` (a stable [a-z][a-z0-9_-]* token) to
 * render localized messages, NOT on ``detail`` (which is dev-facing). See
 * AGENTS.md → "API 에러 코드 규약". When the response is non-conformant
 * (e.g. proxy 502), ``code`` falls back to ``"http-<status>"`` or
 * ``"network-error"``.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string,
  ) {
    super(detail);
  }
}

export function getToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

interface ApiOptions extends RequestInit {
  /** Send body as form-urlencoded instead of JSON. Used for /auth/token. */
  form?: Record<string, string>;
}

export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined = options.body as BodyInit | undefined;
  if (options.form) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    body = new URLSearchParams(options.form).toString();
  } else if (body && !headers.has("Content-Type")) {
    if (
      typeof body === "string" ||
      (typeof body === "object" &&
        !(body instanceof FormData) &&
        !(body instanceof URLSearchParams) &&
        !(body instanceof Blob))
    ) {
      headers.set("Content-Type", "application/json");
      if (typeof body === "object") body = JSON.stringify(body);
    }
  }

  const res = await fetch(path, { ...options, headers, body });

  if (res.status === 401) {
    setToken(null);
  }

  if (!res.ok) {
    let code = `http-${res.status}`;
    let detail = res.statusText;
    try {
      const data = await res.json();
      if (typeof data?.code === "string") code = data.code;
      // `detail` is dev-facing; collapse to a string for logs/dialogs.
      if (typeof data?.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data?.detail)) {
        detail = data.detail
          .map((e: { msg?: string; loc?: (string | number)[] }) =>
            e.loc?.length ? `${e.loc.join(".")}: ${e.msg ?? ""}` : (e.msg ?? ""),
          )
          .filter(Boolean)
          .join("; ") || res.statusText;
      } else if (data?.detail) {
        detail = JSON.stringify(data.detail);
      }
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, code, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
