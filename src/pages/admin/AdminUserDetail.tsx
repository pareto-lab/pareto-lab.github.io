import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  Shield,
  ShieldOff,
} from "lucide-react";
import { api, ApiError } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import type { AdminUser, UserRole } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTimeSecKst } from "@/lib/datetime";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

// Date format helpers moved to src/lib/datetime.ts.

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground self-center">{label}</span>
    <span className="text-sm break-all">{children}</span>
  </div>
);

const AdminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: currentAdmin } = useAuth();
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [roleDialog, setRoleDialog] = useState<UserRole | null>(null);

  const { data: user, isLoading, error } = useQuery<AdminUser>({
    queryKey: ["admin-user", id],
    queryFn: () => api<AdminUser>(`/api/v1/admin/users/${id}`),
    enabled: !!id,
  });

  useDocumentTitle(
    user
      ? `${user.display_name || user.email} | 사용자 관리 | 관리자 | 하우스인어스`
      : "사용자 관리 | 관리자 | 하우스인어스",
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-user", id] });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const banMutation = useMutation({
    mutationFn: (reason: string | null) =>
      api<AdminUser>(`/api/v1/admin/users/${id}/ban`, {
        method: "POST",
        body: { reason } as unknown as BodyInit,
      }),
    onSuccess: () => {
      setBanDialogOpen(false);
      setBanReason("");
      setActionError(null);
      invalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.detail : String(err));
    },
  });

  const unbanMutation = useMutation({
    mutationFn: () =>
      api<AdminUser>(`/api/v1/admin/users/${id}/unban`, { method: "POST" }),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.detail : String(err));
    },
  });

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) =>
      api<AdminUser>(`/api/v1/admin/users/${id}/role`, {
        method: "POST",
        body: { role } as unknown as BodyInit,
      }),
    onSuccess: () => {
      setRoleDialog(null);
      setActionError(null);
      invalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.detail : String(err));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/users")}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
        </Button>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
          {error instanceof Error ? error.message : "유저를 찾을 수 없습니다"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/users">
          <ArrowLeft className="w-4 h-4 mr-1" /> 목록으로
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium break-all">
            {user.display_name}
          </h1>
          <p className="text-sm text-muted-foreground break-all">{user.email}</p>
          <div className="flex gap-2 mt-2">
            <Badge variant={user.role === "owner" ? "default" : user.role === "admin" ? "secondary" : "outline"}>
              {user.role}
            </Badge>
            {user.banned_at ? (
              <Badge variant="destructive">차단됨</Badge>
            ) : user.deleted_at ? (
              <Badge variant="outline">탈퇴</Badge>
            ) : (
              <Badge variant="secondary">{user.status}</Badge>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {/* Owner-only role controls. Hidden on self / on another Owner. */}
          {currentAdmin?.role === "owner" &&
            currentAdmin.id !== user.id &&
            user.role !== "owner" && (
              user.role === "admin" ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionError(null);
                    setRoleDialog("user");
                  }}
                  disabled={roleMutation.isPending}
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  관리자 권한 회수
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionError(null);
                    setRoleDialog("admin");
                  }}
                  disabled={roleMutation.isPending}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  관리자 권한 부여
                </Button>
              )
            )}

          {user.banned_at ? (
            <Button
              variant="outline"
              onClick={() => unbanMutation.mutate()}
              disabled={unbanMutation.isPending}
            >
              {unbanMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              차단 해제
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                setActionError(null);
                setBanDialogOpen(true);
              }}
            >
              <Ban className="w-4 h-4 mr-2" />
              차단
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
          {actionError}
        </div>
      )}

      <section className="bg-card border border-border rounded-sm p-4">
        <h2 className="text-sm font-semibold mb-2">계정 정보</h2>
        <Field label="ID">
          <code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{user.id}</code>
        </Field>
        <Field label="이메일">{user.email}</Field>
        <Field label="이메일 인증">{formatDateTimeSecKst(user.email_verified_at)}</Field>
        <Field label="이름">{user.display_name}</Field>
        <Field label="휴대폰">{user.phone_number ?? "—"}</Field>
        <Field label="시간대">{user.timezone ?? "—"}</Field>
        <Field label="로케일">{user.locale ?? "—"}</Field>
      </section>

      <section className="bg-card border border-border rounded-sm p-4">
        <h2 className="text-sm font-semibold mb-2">활동</h2>
        <Field label="가입일">{formatDateTimeSecKst(user.created_at)}</Field>
        <Field label="마지막 수정">{formatDateTimeSecKst(user.updated_at)}</Field>
        <Field label="최근 로그인">{formatDateTimeSecKst(user.last_login_at)}</Field>
        <Field label="탈퇴일">{formatDateTimeSecKst(user.deleted_at)}</Field>
      </section>

      {user.banned_at && (
        <section className="bg-destructive/5 border border-destructive/20 rounded-sm p-4">
          <h2 className="text-sm font-semibold mb-2 text-destructive">차단 정보</h2>
          <Field label="차단일">{formatDateTimeSecKst(user.banned_at)}</Field>
          <Field label="사유">{user.ban_reason ?? "—"}</Field>
          <Field label="처리자 ID">
            {user.banned_by_id ? (
              <code className="text-xs">{user.banned_by_id}</code>
            ) : (
              "—"
            )}
          </Field>
        </section>
      )}

      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 유저를 차단하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              차단된 유저는 즉시 모든 기기에서 로그아웃되며, 다시 로그인할 수 없습니다.
              나중에 차단을 해제할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="ban-reason" className="text-sm">사유 (선택)</Label>
            <Textarea
              id="ban-reason"
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="내부 메모용 (유저에겐 노출되지 않음)"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={banMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                banMutation.mutate(banReason.trim() || null);
              }}
              disabled={banMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {banMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              차단
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={roleDialog !== null} onOpenChange={(open) => !open && setRoleDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {roleDialog === "admin"
                ? "이 유저에게 관리자 권한을 부여하시겠습니까?"
                : "이 유저의 관리자 권한을 회수하시겠습니까?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {roleDialog === "admin"
                ? "관리자는 다른 유저를 조회/검색하고 차단할 수 있습니다. " +
                  "단, 관리자 권한을 다른 유저에게 부여하거나 회수할 수는 없습니다 (Owner 전용)."
                : "이 유저는 관리자 페이지 접근 권한을 잃습니다. 일반 유저로 돌아갑니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={roleMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (roleDialog) roleMutation.mutate(roleDialog);
              }}
              disabled={roleMutation.isPending}
            >
              {roleMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {roleDialog === "admin" ? "권한 부여" : "권한 회수"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUserDetail;
