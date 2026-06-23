import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getToken } from "@/lib/apiClient";
import type {
  Property,
  PropertyCreatePayload,
  PropertyImage,
  PropertyListResponse,
  PropertyStatus,
  PropertyUpdatePayload,
} from "@/types/property";

export const adminPropertiesKey = (
  q: string,
  statuses: PropertyStatus[],
  page: number,
  pageSize: number,
) => ["admin-properties", q, statuses.sort().join(","), page, pageSize] as const;

export const adminPropertyKey = (id: string) =>
  ["admin-property", id] as const;

interface ListParams {
  q?: string;
  statuses?: PropertyStatus[];
  page?: number;
  pageSize?: number;
}

export function useAdminPropertyList({
  q = "",
  statuses = [],
  page = 0,
  pageSize = 50,
}: ListParams) {
  return useQuery<PropertyListResponse>({
    queryKey: adminPropertiesKey(q, statuses, page, pageSize),
    queryFn: () => {
      const params = new URLSearchParams({
        skip: String(page * pageSize),
        limit: String(pageSize),
      });
      if (q) params.set("q", q);
      for (const s of statuses) params.append("statuses", s);
      return api<PropertyListResponse>(`/api/v1/admin/properties?${params.toString()}`);
    },
  });
}

export function useAdminProperty(id: string | undefined) {
  return useQuery<Property>({
    queryKey: id ? adminPropertyKey(id) : ["admin-property", "noop"],
    queryFn: () => api<Property>(`/api/v1/admin/properties/${id}`),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PropertyCreatePayload) =>
      api<Property>("/api/v1/admin/properties", {
        method: "POST",
        body: payload as unknown as BodyInit,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
    },
  });
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PropertyUpdatePayload) =>
      api<Property>(`/api/v1/admin/properties/${id}`, {
        method: "PATCH",
        body: payload as unknown as BodyInit,
      }),
    onSuccess: (data) => {
      qc.setQueryData(adminPropertyKey(id), data);
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
      qc.invalidateQueries({ queryKey: ["public-property", id] });
    },
  });
}

export function usePublishProperty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "publish" | "unpublish") =>
      api<Property>(`/api/v1/admin/properties/${id}/${action}`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      qc.setQueryData(adminPropertyKey(id), data);
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
    },
  });
}

export function useGenerateDeliveryLink(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (birthdate: string) =>
      api<Property>(`/api/v1/admin/properties/${id}/delivery-link`, {
        method: "POST",
        body: { birthdate } as unknown as BodyInit,
      }),
    onSuccess: (data) => {
      qc.setQueryData(adminPropertyKey(id), data);
    },
  });
}

export function useArchiveProperty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<void>(`/api/v1/admin/properties/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-properties"] });
      qc.invalidateQueries({ queryKey: adminPropertyKey(id) });
    },
  });
}

/** Direct multipart upload — bypasses our JSON wrapper. */
export async function uploadPropertyImage(
  propertyId: string,
  file: File,
  meta?: { caption?: string; alt?: string },
): Promise<PropertyImage> {
  const form = new FormData();
  form.append("file", file);
  if (meta?.caption) form.append("caption", meta.caption);
  if (meta?.alt) form.append("alt", meta.alt);

  const headers: HeadersInit = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api/v1/admin/properties/${propertyId}/images`, {
    method: "POST",
    body: form,
    headers,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await res.json()) as PropertyImage;
}

export function useDeleteImage(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      api<void>(`/api/v1/admin/properties/${propertyId}/images/${imageId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminPropertyKey(propertyId) });
    },
  });
}

