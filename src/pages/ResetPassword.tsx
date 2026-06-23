import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { api } from "@/lib/apiClient";
import { messageForError } from "@/lib/errorMessage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const RESET_MESSAGES: Record<string, string> = {
  "verification-token-invalid":
    "인증이 만료되었습니다. 이메일 인증을 다시 진행해주세요.",
  "user-not-found": "계정을 찾을 수 없습니다.",
  "validation-error": "비밀번호 형식을 다시 확인해주세요.",
};

const ResetPassword = () => {
  useDocumentTitle("비밀번호 재설정 | 하우스인어스");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token")?.trim() ?? "", [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

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
      await api("/api/v1/auth/password/reset", {
        method: "POST",
        body: {
          verification_token: token,
          new_password: password,
        } as unknown as BodyInit,
      });
      setDone(true);
    } catch (err) {
      setError(
        messageForError(err, RESET_MESSAGES, "비밀번호 재설정에 실패했습니다."),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            {done ? (
              <CheckCircle2 className="w-7 h-7 text-primary" />
            ) : (
              <KeyRound className="w-7 h-7 text-primary" />
            )}
          </div>
          <h1 className="font-serif text-2xl font-medium">
            {done ? "변경 완료" : "비밀번호 재설정"}
          </h1>
        </div>

        {done ? (
          <div className="bg-card border border-border rounded-lg p-6 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">로그인</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="bg-card border border-border rounded-lg p-6 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">새 비밀번호</Label>
              <Input
                id="new-password"
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
              <Label htmlFor="confirm-password">새 비밀번호 확인</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              비밀번호 변경
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
