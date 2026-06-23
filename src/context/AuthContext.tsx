import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, getToken, setToken, ApiError } from "@/lib/apiClient";
import type { UserRole, UserStatus } from "@/types/user";

export type { UserRole, UserStatus };

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  profile_image_url: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  terms_agreed_at: string | null;
  terms_version: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const ADMIN_ROLES: UserRole[] = ["admin", "owner"];

// SessionStorage key the login flow reads as a fallback redirect target.
// Set by the provider on every non-auth navigation; cleared once a user is
// successfully authenticated.
export const PRE_AUTH_PATH_KEY = "houseinus_pre_auth_path";

const AUTH_PATHS = new Set([
  "/login",
  "/signup",
  "/email-verify",
  "/reset-password",
]);

const Ctx = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Remember the last non-auth page the user looked at so that whoever sends
  // them to /login next (header, in-page link, or even direct URL entry) can
  // recover it without each call site having to thread a redirect param.
  useEffect(() => {
    if (AUTH_PATHS.has(location.pathname)) return;
    try {
      sessionStorage.setItem(
        PRE_AUTH_PATH_KEY,
        location.pathname + location.search,
      );
    } catch {
      /* sessionStorage unavailable (Safari private mode etc.) — best-effort */
    }
  }, [location.pathname, location.search]);

  // Once the user is signed in there's nothing left to redirect back to,
  // and stale entries would mis-fire on a future logout → /login cycle.
  useEffect(() => {
    if (user) {
      try {
        sessionStorage.removeItem(PRE_AUTH_PATH_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [user]);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const me = await api<AuthUser>("/api/v1/auth/me");
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // On first mount, pick up an OAuth-callback access token from the URL hash
  // and then fetch the current user. Doing both inside the provider avoids a
  // race where a top-level hash hook stores the token *after* this provider's
  // refresh has already concluded "no user". See app/api/v1/oauth.py callback
  // which redirects to `/#access_token=...&token_type=bearer[&redirect_to=...]`.
  useEffect(() => {
    const raw = window.location.hash;
    let oauthRedirect: string | null = null;
    if (raw) {
      const params = new URLSearchParams(
        raw.startsWith("#") ? raw.slice(1) : raw,
      );
      const token = params.get("access_token");
      if (token) {
        setToken(token);
        // First-time OAuth signups go through /oauth-consent (a server-side
        // 302), so the only OAuth callbacks reaching here are for established
        // users — no terms gating needed.
        // Treat the redirect_to fragment as advisory and validate it: in-app
        // paths only, no protocol-relative URLs.
        const redirectTo = params.get("redirect_to");
        let finalRedirect: string | null = null;
        if (
          redirectTo &&
          redirectTo.startsWith("/") &&
          !redirectTo.startsWith("//")
        ) {
          finalRedirect = redirectTo;
        } else {
          // Fragment didn't carry redirect_to (older callback, or the user
          // started auth from a page that didn't pass one). Fall back to the
          // sessionStorage record set by the provider on every non-auth page.
          try {
            const stored = sessionStorage.getItem(PRE_AUTH_PATH_KEY);
            if (
              stored &&
              stored.startsWith("/") &&
              !stored.startsWith("//")
            ) {
              finalRedirect = stored;
            }
          } catch {
            /* ignore — best-effort */
          }
        }
        oauthRedirect = finalRedirect;
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }
    }
    void refresh().then(() => {
      if (oauthRedirect) navigate(oauthRedirect, { replace: true });
    });
  }, [refresh, navigate]);

  const logout = useCallback(async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {
      /* server-side session may already be gone — clear locally anyway */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAdmin: !!user && ADMIN_ROLES.includes(user.role),
      refresh,
      logout,
    }),
    [user, loading, refresh, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = (): AuthState => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};
