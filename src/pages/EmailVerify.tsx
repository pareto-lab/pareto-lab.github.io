import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MailCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import { messageForError } from "@/lib/errorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type Purpose = "signup" | "reset";

interface VerifyConfirmResponse {
  verification_token: string;
}

const START_MESSAGES: Record<string, string> = {
  "email-already-registered": "이미 가입된 이메일입니다. 로그인 페이지로 돌아가 주세요.",
  "email-service-unavailable": "메일 서버가 설정되지 않았습니다. 관리자에게 문의해주세요.",
  "email-send-failed": "인증메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
  "validation-error": "이메일 형식을 확인해주세요.",
};

const CONFIRM_MESSAGES: Record<string, string> = {
  "verification-code-invalid": "인증번호가 일치하지 않거나 만료되었습니다.",
};

const isPurpose = (v: string | null): v is Purpose =>
  v === "signup" || v === "reset";

const EmailVerify = () => {
  useDocumentTitle("이메일 인증 | 하우스인어스");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = useMemo(() => params.get("email")?.trim() ?? "", [params]);
  const purposeParam = params.get("purpose");
  const purpose: Purpose = isPurpose(purposeParam) ? purposeParam : "signup";
  const redirectTo = params.get("redirect") || "/";
  const termsVersion = useMemo(
    () => params.get("terms_version")?.trim() ?? "",
    [params],
  );

  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sentRef = useRef(false);

  const sendCode = async () => {
    if (!email) return;
    setError(null);
    setInfo(null);
    setSending(true);
    try {
      await api("/api/v1/auth/email/verify/start", {
        method: "POST",
        body: { email, purpose } as unknown as BodyInit,
      });
      setInfo(`${email} 로 인증번호를 발송했습니다.`);
    } catch (err) {
      setError(messageForError(err, START_MESSAGES, "인증메일 발송에 실패했습니다."));
    } finally {
      setSending(false);
    }
  };

  // Auto-send a code on first mount so the user lands here and sees a
  // ready-to-type form. Guard against React 18 dev StrictMode's double-invoke.
  // Signup purpose requires upstream terms agreement — bounce direct entries
  // back to /login so the verification email is never sent before consent.
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    if (!email) {
      setError("이메일이 지정되지 않았습니다. 로그인 페이지에서 다시 시작해주세요.");
      return;
    }
    if (purpose === "signup" && !termsVersion) {
      navigate("/login", { replace: true });
      return;
    }
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirming(true);
    try {
      const resp = await api<VerifyConfirmResponse>(
        "/api/v1/auth/email/verify/confirm",
        {
          method: "POST",
          body: { email, code, purpose } as unknown as BodyInit,
        },
      );
      const token = resp.verification_token;
      if (purpose === "signup") {
        const redirectQuery =
          redirectTo !== "/" ? `&redirect=${encodeURIComponent(redirectTo)}` : "";
        const termsQuery = termsVersion
          ? `&terms_version=${encodeURIComponent(termsVersion)}`
          : "";
        navigate(
          `/signup?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}${termsQuery}${redirectQuery}`,
          { replace: true },
        );
      } else {
        navigate(`/reset-password?token=${encodeURIComponent(token)}`, {
          replace: true,
        });
      }
    } catch (err) {
      setError(messageForError(err, CONFIRM_MESSAGES, "인증에 실패했습니다."));
      setConfirming(false);
    }
  };

  const heading = purpose === "signup" ? "회원가입 인증" : "비밀번호 재설정 인증";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <MailCheck className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-serif text-2xl font-medium">{heading}</h1>
          <p className="text-xs text-muted-foreground mt-2">
            메일로 받은 6자리 인증번호를 입력해주세요.
          </p>
        </div>

        <form
          onSubmit={onConfirm}
          className="bg-card border border-border rounded-lg p-6 space-y-4"
        >
          <div className="space-y-2">
            <Label>이메일</Label>
            <div className="text-sm font-medium">{email}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="verify-code">인증번호</Label>
            <Input
              id="verify-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              minLength={6}
              pattern="[0-9]{6}"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={confirming}
              className="tracking-[0.4em] text-center font-mono"
            />
            <p className="text-xs text-muted-foreground">
              메일이 오지 않으면 스팸함도 확인해보세요.
            </p>
          </div>

          {info && !error && (
            <div className="text-sm text-muted-foreground bg-secondary/40 border border-border rounded-sm px-3 py-2">
              {info}
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={confirming || code.length !== 6}
          >
            {confirming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            확인
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-muted-foreground hover:text-foreground"
            >
              로그인으로 돌아가기
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={sending || confirming}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {sending ? "발송 중..." : "인증번호 다시 보내기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailVerify;
