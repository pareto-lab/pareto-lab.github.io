import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle2, Loader2, LogOut, Link2Off } from "lucide-react";
import { api, getToken, ApiError } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import kakaoSymbol from "@/assets/oauth/kakao-symbol.svg";
import naverSymbol from "@/assets/oauth/naver-symbol.svg";
import googleLogo from "@/assets/oauth/google-logo.svg";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface UserRead {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin" | "owner";
  status: "active" | "suspended" | "deleted";
  profile_image_url: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

type OAuthProvider = "google" | "naver" | "kakao";

interface OAuthAccountSummary {
  provider: OAuthProvider;
  email: string | null;
  linked_at: string;
}

const ROLE_LABEL: Record<UserRead["role"], string> = {
  user: "일반 사용자",
  admin: "관리자",
  owner: "소유자",
};

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: "Google",
  naver: "네이버",
  kakao: "카카오",
};

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const MyAccount = () => {
  useDocumentTitle("내 계정 | 하우스인어스");
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState<UserRead | null>(null);
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccountSummary[] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!getToken()) {
        navigate("/login?redirect=/me", { replace: true });
        return;
      }
      try {
        const [me, accounts] = await Promise.all([
          api<UserRead>("/api/v1/auth/me"),
          api<OAuthAccountSummary[]>("/api/v1/auth/me/oauth-accounts"),
        ]);
        if (!cancelled) {
          setUser(me);
          setOauthAccounts(accounts);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate("/login?redirect=/me", { replace: true });
          return;
        }
        if (!cancelled) setLoading(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  };

  let content: ReactNode;
  if (loading) {
    content = <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />;
  } else if (!user) {
    content = (
      <div className="text-sm text-muted-foreground">
        사용자 정보를 불러올 수 없습니다.
      </div>
    );
  } else {
    content = (
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {user.profile_image_url ? (
            <img
              src={user.profile_image_url}
              alt={user.display_name}
              className="w-16 h-16 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <UserCircle2 className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className="font-serif text-2xl font-medium">{user.display_name}</h1>
          <p className="text-xs text-muted-foreground mt-1">{user.email}</p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-3">
          <Row label="이름" value={user.display_name} />
          <Row label="이메일" value={user.email} />
          <Row label="이메일 인증" value={user.email_verified_at ? "완료" : "미인증"} />
          <Row label="권한" value={ROLE_LABEL[user.role]} />
          <Row label="상태" value={user.status} />
          <Row label="가입일" value={formatDate(user.created_at)} />
          <Row label="최근 로그인" value={formatDate(user.last_login_at)} />
        </div>

        <div className="bg-card border border-border rounded-lg p-6 mt-4">
          <h2 className="text-sm font-medium mb-3">연결된 소셜 계정</h2>
          {oauthAccounts === null ? (
            <div className="text-sm text-muted-foreground">불러오는 중…</div>
          ) : oauthAccounts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link2Off className="w-4 h-4" />
              연결된 소셜 계정이 없습니다.
            </div>
          ) : (
            <ul className="space-y-3">
              {oauthAccounts.map((acc) => (
                <li
                  key={acc.provider}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ProviderBadge provider={acc.provider} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {PROVIDER_LABEL[acc.provider]}
                      </div>
                      {acc.email && (
                        <div className="text-xs text-muted-foreground truncate">
                          {acc.email}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(acc.linked_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full mt-6"
          onClick={onLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4 mr-2" />
          )}
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 pt-24 pb-16">
        {content}
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right truncate ml-4">{value}</span>
  </div>
);

const ProviderBadge = ({ provider }: { provider: OAuthProvider }) => {
  if (provider === "google") {
    return (
      <div className="w-8 h-8 rounded-full bg-white border border-[#747775] flex items-center justify-center shrink-0">
        <img src={googleLogo} alt="" className="w-4 h-4" />
      </div>
    );
  }
  if (provider === "naver") {
    return (
      <div className="w-8 h-8 rounded-full bg-[#03A94D] flex items-center justify-center shrink-0">
        <img src={naverSymbol} alt="" className="w-3 h-3" />
      </div>
    );
  }
  // kakao
  return (
    <div className="w-8 h-8 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
      <img src={kakaoSymbol} alt="" className="w-4 h-4" />
    </div>
  );
};

export default MyAccount;
