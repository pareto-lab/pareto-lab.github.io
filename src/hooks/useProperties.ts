/**
 * Public read hooks — fetch from the houseinus-api backend.
 * Static data has been moved into the DB; this file used to reach for a
 * Google Sheets fallback, which is now retired.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { adaptListItem, adaptProperty } from "@/lib/propertyAdapter";
import type { Property } from "@/data/properties";
import type {
  Property as ApiProperty,
  PropertyListResponse,
} from "@/types/property";

const LIST_LIMIT = 200; // small catalog — fetch everything in one shot.

export const useProperties = () => {
  return useQuery<Property[]>({
    queryKey: ["public-properties"],
    queryFn: async () => {
      const resp = await api<PropertyListResponse>(
        `/api/v1/properties?limit=${LIST_LIMIT}`,
      );
      return resp.items.map(adaptListItem);
    },
    staleTime: 1000 * 60,
  });
};

export const useProperty = (
  id: string | undefined,
  opts?: { token?: string; birthdate?: string },
) => {
  const params = new URLSearchParams();
  if (opts?.token) params.set("token", opts.token);
  if (opts?.birthdate) params.set("birthdate", opts.birthdate);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const query = useQuery<Property>({
    queryKey: ["public-property", id, opts?.token, opts?.birthdate],
    queryFn: async () => {
      const resp = await api<ApiProperty>(`/api/v1/properties/${id}${qs}`);
      return adaptProperty(resp);
    },
    enabled: !!id,
    staleTime: 1000 * 60,
  });

  return {
    property: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
};
