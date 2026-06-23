import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, setToken } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { messageForError } from "@/lib/errorMessage";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import termsText from "@/data/terms/v1.txt?raw";

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: { id: string; email: string };
}

const CONSENT_MESSAGES: Record<string, string> = {
  "http-400": "회원가입 세션이 만료되었습니다. 다시 로그인해주세요.",
  "validation-error": "잘못된 요청입니다.",
};

const OAuthConsent = () => {
  useDocumentTitle("이용약관 동의 | 하우스인어스");
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();

  const token = useMemo(() => params.get("token")?.trim() ?? "", [params]);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No token → there's no signup in progress; send the user back to /login.
  if (!token) {
    navigate("/login", { replace: true });
    return null;
  }

  const onAgree = async () => {
    if (!agreed) return;
    setError(null);
    setSubmitting(true);
    try {
      const resp = await api<AuthResponse>("/api/v1/auth/oauth/consent", {
        method: "POST",
        body: {
          token,
          terms_version: CURRENT_TERMS_VERSION,
        } as unknown as BodyInit,
      });
      setToken(resp.access_token);
      await refresh();
      navigate("/", { replace: true });
    } catch (err) {
      setToken(null);
      setError(messageForError(err, CONSENT_MESSAGES, "가입을 완료할 수 없습니다."));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <Link
            to="/"
            className="font-serif text-2xl font-semibold text-foreground tracking-tight mb-6"
          >
            하우스인어스
          </Link>
          <h1 className="text-xl font-semibold">서비스 이용약관 동의</h1>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            소셜 로그인으로 회원가입을 마치려면 아래 약관에 동의해주세요.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="h-72 overflow-y-auto p-5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-b border-border font-sans">
            {termsText}
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-start gap-2">
              <input
                id="oauth-terms-check"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                disabled={submitting}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
              />
              <label
                htmlFor="oauth-terms-check"
                className="text-sm cursor-pointer leading-relaxed"
              >
                <Link to="/terms" target="_blank" className="text-primary hover:underline">
                  이용약관
                </Link>
                {" "}및{" "}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline">
                  개인정보처리방침
                </Link>
                에 동의합니다. (필수)
              </label>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
                {error}
              </div>
            )}

            <Button
              className="w-full"
              disabled={!agreed || submitting}
              onClick={onAgree}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              동의하고 가입 완료
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuthConsent;
