import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { OpenHouseEventListResponse } from "@/types/openHouse";

export function useAdminOpenHouseCalendar(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const qs = params.toString();
  return useQuery<OpenHouseEventListResponse>({
    queryKey: ["admin-open-house-calendar", dateFrom ?? null, dateTo ?? null],
    queryFn: () =>
      api<OpenHouseEventListResponse>(
        `/api/v1/admin/open-house-events${qs ? `?${qs}` : ""}`,
      ),
  });
}
