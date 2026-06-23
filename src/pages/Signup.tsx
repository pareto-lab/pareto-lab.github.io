import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus, Loader2 } from "lucide-react";
import { api, setToken } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { messageForError } from "@/lib/errorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: { id: string; email: string };
}

const SIGNUP_MESSAGES: Record<string, string> = {
  "http-409": "이미 가입된 이메일입니다.",
  "email-already-registered": "이미 가입된 이메일입니다.",
  "verification-token-invalid":
    "인증이 만료되었습니다. 이메일 인증을 다시 진행해주세요.",
  "validation-error": "입력값을 다시 확인해주세요.",
};

const Signup = () => {
  useDocumentTitle("회원가입 | 하우스인어스");
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const email = useMemo(() => params.get("email")?.trim() ?? "", [params]);
  const verificationToken = useMemo(
    () => params.get("token")?.trim() ?? "",
    [params],
  );
  const termsVersion = useMemo(
    () => params.get("terms_version")?.trim() ?? "",
    [params],
  );
  // Explicit ?redirect= wins; otherwise fall back to whatever non-auth page
  // the AuthProvider last recorded so users who land here after the email-
  // verify flow still get bounced back where they started.
  const redirectTo = useMemo(() => {
    const explicit = params.get("redirect");
    if (explicit && explicit.startsWith("/") && !explicit.startsWith("//")) {
      return explicit;
    }
    return "/";
  }, [params]);

  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Verification token AND prior terms agreement are both mandatory — bounce
  // back to /login if either is missing. Terms consent must come from the
  // login terms step; we never accept a signup without it.
  useEffect(() => {
    if (!email || !verificationToken || !termsVersion) {
      navigate("/login", { replace: true });
    }
  }, [email, verificationToken, termsVersion, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await api<AuthResponse>("/api/v1/auth/register", {
        method: "POST",
        body: {
          verification_token: verificationToken,
          password,
          display_name: displayName,
          terms_version: termsVersion,
        } as unknown as BodyInit,
      });
      setToken(resp.access_token);
      await refresh();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setToken(null);
      setError(messageForError(err, SIGNUP_MESSAGES, "회원가입에 실패했습니다."));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <UserPlus className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-medium">회원가입</h1>
          <p className="text-xs text-muted-foreground mt-2">
            하우스인어스 새 계정 만들기
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-card border border-border rounded-lg p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label>이메일</Label>
            <Input value={email} disabled readOnly className="bg-muted/40" />
            <p className="text-xs text-muted-foreground">
              인증된 이메일로 가입됩니다.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-name">이름</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">비밀번호</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">최소 8자 이상</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-confirm">비밀번호 확인</Label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={submitting}
            />
          </div>

          <p className="text-xs text-muted-foreground pt-1">
            <Link to="/terms" target="_blank" className="text-primary hover:underline">이용약관</Link> 및{" "}
            <Link to="/privacy" target="_blank" className="text-primary hover:underline">개인정보처리방침</Link>에 동의한 상태로 가입이 진행됩니다.
          </p>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            가입하기
          </Button>

          <p className="text-xs text-muted-foreground text-center pt-2">
            이미 계정이 있으신가요?{" "}
            <Link to="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
