import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Loader2, Mail, ArrowLeft } from "lucide-react";
import { api, setToken } from "@/lib/apiClient";
import { useAuth, PRE_AUTH_PATH_KEY } from "@/context/AuthContext";
import { messageForError } from "@/lib/errorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import kakaoSymbol from "@/assets/oauth/kakao-symbol.svg";
import naverSymbol from "@/assets/oauth/naver-symbol.svg";
import googleLogo from "@/assets/oauth/google-logo.svg";
import termsText from "@/data/terms/v1.txt?raw";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type Step = "options" | "email" | "password" | "terms";
type OAuthProvider = "naver" | "kakao" | "google";

const OAUTH_LABELS: Record<OAuthProvider, string> = {
  naver: "네이버",
  kakao: "카카오",
  google: "Google",
};

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface OAuthAuthorizeResponse {
  authorization_url: string;
  state: string;
}

interface EmailCheckResponse {
  exists: boolean;
  has_password: boolean;
}

const LOGIN_MESSAGES: Record<string, string> = {
  "http-401": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "http-403": "로그인할 수 없는 계정입니다.",
};

const EMAIL_CHECK_MESSAGES: Record<string, string> = {
  "validation-error": "이메일 형식을 확인해주세요.",
};

const Login = () => {
  useDocumentTitle("로그인 | 하우스인어스");
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const [params] = useSearchParams();
  // Explicit ?redirect= wins (set by callers that want to be precise); fall
  // back to whatever non-auth page the AuthProvider last recorded so users
  // who reach /login from a page without a header still get bounced back.
  const redirectTo = useMemo(() => {
    const explicit = params.get("redirect");
    if (explicit) return explicit;
    try {
      const stored = sessionStorage.getItem(PRE_AUTH_PATH_KEY);
      if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
        return stored;
      }
    } catch {
      /* ignore — best-effort */
    }
    return "/";
  }, [params]);

  // If the user is already signed in, jump straight to the requested page
  // (or "/" when none was specified). Wait for the initial /auth/me probe
  // to settle so we don't bounce away before we know.
  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, user, redirectTo, navigate]);

  const [step, setStep] = useState<Step>("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchStep = (next: Step) => {
    setError(null);
    setSubmitting(false);
    if (next !== "password") setPassword("");
    if (next !== "terms") setTermsAgreed(false);
    setStep(next);
  };

  const onOAuthLogin = async (provider: OAuthProvider) => {
    setError(null);
    setSubmitting(true);
    try {
      // Ask the backend to remember redirect_to in its OAuth state record so
      // the callback can bounce us back here. Only attach the param when it
      // points somewhere other than "/" — backend treats missing == "/".
      const qs =
        redirectTo && redirectTo !== "/"
          ? `?redirect_to=${encodeURIComponent(redirectTo)}`
          : "";
      const resp = await api<OAuthAuthorizeResponse>(
        `/api/v1/auth/oauth/${provider}/authorize${qs}`,
      );
      window.location.href = resp.authorization_url;
    } catch (err) {
      const label = OAUTH_LABELS[provider];
      setError(
        messageForError(
          err,
          { "http-404": `${label} 로그인이 설정되지 않았습니다.` },
          `${label} 로그인을 시작할 수 없습니다.`,
        ),
      );
      setSubmitting(false);
    }
  };

  const onEmailNext = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const check = await api<EmailCheckResponse>("/api/v1/auth/email/check", {
        method: "POST",
        body: { email } as unknown as BodyInit,
      });
      if (check.exists && check.has_password) {
        setStep("password");
        setSubmitting(false);
        return;
      }
      if (check.exists && !check.has_password) {
        setError(
          "소셜 로그인으로 가입된 계정입니다. 가입에 사용한 소셜 로그인 버튼을 이용해주세요.",
        );
        setSubmitting(false);
        return;
      }
      // 회원이 아니면 → 약관 동의를 먼저 받고, 동의한 경우에만 인증메일을 발송한다.
      switchStep("terms");
    } catch (err) {
      setError(
        messageForError(err, EMAIL_CHECK_MESSAGES, "이메일 확인에 실패했습니다."),
      );
      setSubmitting(false);
    }
  };

  const onPasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await api<TokenResponse>("/api/v1/auth/token", {
        method: "POST",
        form: { username: email, password },
      });
      setToken(resp.access_token);
      await refresh();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setToken(null);
      setError(messageForError(err, LOGIN_MESSAGES, "로그인에 실패했습니다."));
      setSubmitting(false);
    }
  };

  const onAgreeAndContinue = () => {
    if (!termsAgreed) return;
    const redirectQuery =
      redirectTo !== "/" ? `&redirect=${encodeURIComponent(redirectTo)}` : "";
    navigate(
      `/email-verify?email=${encodeURIComponent(email)}&purpose=signup&terms_version=${encodeURIComponent(CURRENT_TERMS_VERSION)}${redirectQuery}`,
    );
  };

  const onForgotPassword = () => {
    if (!email) return;
    navigate(
      `/email-verify?email=${encodeURIComponent(email)}&purpose=reset`,
    );
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-medium">로그인</h1>
          <p className="text-xs text-muted-foreground mt-2">
            하우스인어스 계정으로 로그인
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          {step === "options" && (
            <>
              {/* <button
                type="button"
                onClick={() => onOAuthLogin("naver")}
                disabled={submitting}
                className="w-full h-10 rounded-md bg-[#03A94D] text-white font-medium flex items-center justify-center gap-2 hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <img src={naverSymbol} alt="" className="w-[14px] h-[14px]" />
                네이버 로그인
              </button> */}
              <button
                type="button"
                onClick={() => onOAuthLogin("kakao")}
                disabled={submitting}
                className="w-full h-10 rounded-md bg-[#FEE500] font-medium flex items-center justify-center gap-2 hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: "rgba(0,0,0,0.85)" }}
              >
                <img src={kakaoSymbol} alt="" className="w-4 h-4" />
                카카오 로그인
              </button>
              <button
                type="button"
                onClick={() => onOAuthLogin("google")}
                disabled={submitting}
                className="w-full h-10 rounded-md bg-white text-[#1F1F1F] font-medium flex items-center justify-center gap-2 hover:bg-[#F8F9FA] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <img src={googleLogo} alt="" className="w-[18px] h-[18px]" />
                Google 계정으로 로그인
              </button>
              <button
                type="button"
                onClick={() => switchStep("email")}
                disabled={submitting}
                className="w-full h-10 rounded-md bg-secondary text-foreground font-medium flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                메일 계정으로 로그인
              </button>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
                  {error}
                </div>
              )}
            </>
          )}

          {step === "email" && (
            <form onSubmit={onEmailNext} className="space-y-4">
              <button
                type="button"
                onClick={() => switchStep("options")}
                disabled={submitting}
                className="flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> 다른 방법으로 로그인
              </button>

              <div className="space-y-2">
                <Label htmlFor="login-email">이메일</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting || !email}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                다음
              </Button>
            </form>
          )}

          {step === "terms" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => switchStep("email")}
                disabled={submitting}
                className="flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> 이메일 다시 입력
              </button>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  가입되어있지 않은 이메일 주소입니다.
                </div>
                <div className="text-xs text-muted-foreground">
                  {email}로 회원가입을 진행합니다.
                </div>
                <h2 className="font-serif text-lg font-medium pt-2">회원가입</h2>
              </div>

              <div className="border border-border rounded-md overflow-hidden">
                <div className="h-56 overflow-y-auto p-4 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {termsText}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <input
                  id="login-terms-agree"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                />
                <label
                  htmlFor="login-terms-agree"
                  className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                >
                  <Link to="/terms" target="_blank" className="text-primary hover:underline">이용약관</Link>
                  {" "}및{" "}
                  <Link to="/privacy" target="_blank" className="text-primary hover:underline">개인정보처리방침</Link>
                  에 동의합니다. (필수)
                </label>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                disabled={!termsAgreed || submitting}
                onClick={onAgreeAndContinue}
              >
                동의하고 인증메일 받기
              </Button>
            </div>
          )}

          {step === "password" && (
            <form onSubmit={onPasswordLogin} className="space-y-4">
              <button
                type="button"
                onClick={() => switchStep("email")}
                disabled={submitting}
                className="flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> 이메일 다시 입력
              </button>

              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{email}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                로그인
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  disabled={submitting}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  비밀번호를 잊어버렸어요
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
