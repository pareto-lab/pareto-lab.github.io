import { api } from "@/lib/apiClient";
import type { Inquiry, InquiryCreatePayload } from "@/types/inquiry";
import type { MbtiResult, MbtiResultCreatePayload } from "@/types/mbti";
import type {
  OpenHouseReservation,
  OpenHouseReservationCreatePayload,
} from "@/types/openHouse";
import type {
  OpenHouseInquiry,
  OpenHouseInquiryCreatePayload,
} from "@/types/openHouseInquiry";

const currentUrl = () => (typeof window === "undefined" ? null : window.location.href);

export const createInquiry = (payload: InquiryCreatePayload) =>
  api<Inquiry>("/api/v1/inquiries", {
    method: "POST",
    body: {
      ...payload,
      source_url: payload.source_url ?? currentUrl(),
    } as unknown as BodyInit,
  });

export const createMbtiResult = (payload: MbtiResultCreatePayload) =>
  api<MbtiResult>("/api/v1/mbti-results", {
    method: "POST",
    body: {
      ...payload,
      source_url: payload.source_url ?? currentUrl(),
    } as unknown as BodyInit,
  });

export const sendMbtiResultBeacon = (payload: MbtiResultCreatePayload) => {
  const body = JSON.stringify({
    ...payload,
    source_url: payload.source_url ?? currentUrl(),
  });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/v1/mbti-results", blob)) return;

  void fetch("/api/v1/mbti-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
};

export const createOpenHouseInquiry = (payload: OpenHouseInquiryCreatePayload) =>
  api<OpenHouseInquiry>("/api/v1/open-house-inquiries", {
    method: "POST",
    body: {
      ...payload,
      source_url: payload.source_url ?? currentUrl(),
    } as unknown as BodyInit,
  });

export const createOpenHouseReservation = (
  eventId: string,
  payload: OpenHouseReservationCreatePayload,
) =>
  api<OpenHouseReservation>(`/api/v1/open-house-events/${eventId}/reservations`, {
    method: "POST",
    body: {
      ...payload,
      source_url: payload.source_url ?? currentUrl(),
    } as unknown as BodyInit,
  });
