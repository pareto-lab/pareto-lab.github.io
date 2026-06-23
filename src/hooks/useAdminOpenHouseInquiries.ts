import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { OpenHouseInquiryListResponse } from "@/types/openHouseInquiry";

export function useAdminOpenHouseInquiries(page = 0, pageSize = 50) {
  return useQuery<OpenHouseInquiryListResponse>({
    queryKey: ["admin-open-house-inquiries", page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        skip: String(page * pageSize),
        limit: String(pageSize),
      });
      return api<OpenHouseInquiryListResponse>(
        `/api/v1/admin/open-house-inquiries?${params.toString()}`,
      );
    },
  });
}
