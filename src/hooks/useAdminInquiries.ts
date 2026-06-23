import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { InquiryListResponse, InquiryType } from "@/types/inquiry";

export function useAdminInquiries(type: InquiryType, page = 0, pageSize = 50) {
  return useQuery<InquiryListResponse>({
    queryKey: ["admin-inquiries", type, page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        type,
        skip: String(page * pageSize),
        limit: String(pageSize),
      });
      return api<InquiryListResponse>(`/api/v1/admin/inquiries?${params.toString()}`);
    },
  });
}
