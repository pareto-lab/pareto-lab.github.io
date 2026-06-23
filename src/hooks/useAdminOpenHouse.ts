import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  OpenHouseEvent,
  OpenHouseEventListResponse,
  OpenHouseEventPayload,
  OpenHouseReservation,
  OpenHouseReservationListResponse,
  OpenHouseReservationStatus,
} from "@/types/openHouse";

const eventsKey = (propertyId: string) => ["admin-open-house-events", propertyId] as const;
const reservationsKey = (propertyId: string, eventId: string | null) =>
  ["admin-open-house-reservations", propertyId, eventId] as const;

export function useAdminOpenHouseEvents(propertyId: string) {
  return useQuery<OpenHouseEventListResponse>({
    queryKey: eventsKey(propertyId),
    queryFn: () =>
      api<OpenHouseEventListResponse>(
        `/api/v1/admin/properties/${propertyId}/open-house-events`,
      ),
  });
}

export function useCreateOpenHouseEvent(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenHouseEventPayload) =>
      api<OpenHouseEvent>(`/api/v1/admin/properties/${propertyId}/open-house-events`, {
        method: "POST",
        body: payload as unknown as BodyInit,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey(propertyId) });
    },
  });
}

export function useUpdateOpenHouseEvent(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<OpenHouseEventPayload> }) =>
      api<OpenHouseEvent>(
        `/api/v1/admin/properties/${propertyId}/open-house-events/${id}`,
        {
          method: "PATCH",
          body: payload as unknown as BodyInit,
        },
      ),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: eventsKey(propertyId) });
      qc.invalidateQueries({ queryKey: reservationsKey(propertyId, variables.id) });
    },
  });
}

export function useDeleteOpenHouseEvent(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<void>(`/api/v1/admin/properties/${propertyId}/open-house-events/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey(propertyId) });
    },
  });
}

export function useAdminOpenHouseReservations(propertyId: string, eventId: string | null) {
  return useQuery<OpenHouseReservationListResponse>({
    queryKey: reservationsKey(propertyId, eventId),
    queryFn: () =>
      api<OpenHouseReservationListResponse>(
        `/api/v1/admin/properties/${propertyId}/open-house-events/${eventId}/reservations`,
      ),
    enabled: !!eventId,
  });
}

export function useUpdateOpenHouseReservation(propertyId: string, eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      notes,
    }: {
      id: string;
      status: OpenHouseReservationStatus;
      notes?: string | null;
    }) =>
      api<OpenHouseReservation>(
        `/api/v1/admin/properties/${propertyId}/open-house-events/${eventId}/reservations/${id}`,
        {
          method: "PATCH",
          body: { status, notes } as unknown as BodyInit,
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reservationsKey(propertyId, eventId) });
      qc.invalidateQueries({ queryKey: eventsKey(propertyId) });
    },
  });
}
