import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { api } from "@/lib/apiClient";
import type { AdminUser } from "@/types/user";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeKst } from "@/lib/datetime";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  skip: number;
  limit: number;
}

const PAGE_SIZE = 20;

const roleVariant = (role: string) =>
  role === "owner" ? "default" : role === "admin" ? "secondary" : "outline";

// Date format helpers moved to src/lib/datetime.ts.

const AdminUsers = () => {
  useDocumentTitle("사용자 관리 | 관리자 | 하우스인어스");
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Debounce typing into the search box.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(rawSearch.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(id);
  }, [rawSearch]);

  const { data, isLoading, isFetching, error } = useQuery<AdminUserListResponse>({
    queryKey: ["admin-users", search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set("q", search);
      return api<AdminUserListResponse>(`/api/v1/admin/users?${params.toString()}`);
    },
  });

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-medium">유저 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            가입한 사용자를 검색하고 권한을 관리합니다.
          </p>
        </div>
        {data && (
          <span className="text-sm text-muted-foreground">
            전체 {data.total.toLocaleString()}명
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="이메일 또는 이름 검색"
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-3 py-2">
          {error instanceof Error ? error.message : "유저 목록을 불러오지 못했습니다"}
        </div>
      )}

      <div className="border border-border rounded-sm overflow-hidden bg-card relative">
        {(isLoading || isFetching) && (
          <div className="absolute top-2 right-3 z-10">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이메일</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>권한</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead className="text-right">최근 로그인</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  검색 결과가 없습니다
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((u) => (
              <TableRow key={u.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link to={`/admin/users/${u.id}`} className="hover:text-primary">
                    {u.email}
                  </Link>
                </TableCell>
                <TableCell>{u.display_name}</TableCell>
                <TableCell>
                  <Badge variant={roleVariant(u.role)}>{u.role}</Badge>
                </TableCell>
                <TableCell>
                  {u.banned_at ? (
                    <Badge variant="destructive">차단</Badge>
                  ) : u.deleted_at ? (
                    <Badge variant="outline">탈퇴</Badge>
                  ) : (
                    <Badge variant="secondary">{u.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDateTimeKst(u.created_at)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground text-right">
                  {formatDateTimeKst(u.last_login_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {data ? `${page + 1} / ${totalPages}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            이전
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data || page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
