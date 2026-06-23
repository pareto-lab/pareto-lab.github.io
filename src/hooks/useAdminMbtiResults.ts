import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { MbtiResultListResponse } from "@/types/mbti";

export function useAdminMbtiResults(page = 0, pageSize = 50) {
  return useQuery<MbtiResultListResponse>({
    queryKey: ["admin-mbti-results", page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        skip: String(page * pageSize),
        limit: String(pageSize),
      });
      return api<MbtiResultListResponse>(`/api/v1/admin/mbti-results?${params.toString()}`);
    },
  });
}
