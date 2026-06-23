import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { AdminMe, AdminMeUpdatePayload } from "@/types/adminMe";

const KEY = ["admin-me-settings"] as const;

export function useAdminMe() {
  return useQuery<AdminMe>({
    queryKey: KEY,
    queryFn: () => api<AdminMe>("/api/v1/users/me/admin-settings"),
  });
}

export function useUpdateAdminMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminMeUpdatePayload) =>
      api<AdminMe>("/api/v1/users/me/admin-settings", {
        method: "PATCH",
        body: payload as unknown as BodyInit,
      }),
    onSuccess: (data) => qc.setQueryData(KEY, data),
  });
}
