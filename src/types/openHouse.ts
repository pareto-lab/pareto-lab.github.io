export type OpenHouseEventStatus = "scheduled" | "closed" | "cancelled";
export type OpenHouseReservationStatus = "reserved" | "cancelled" | "attended" | "no_show";

export interface OpenHouseEvent {
  id: string;
  property_id: string;
  property_title: string | null;
  date: string;
  time: string;
  capacity: number;
  available_spots: number;
  reservation_count: number;
  status: OpenHouseEventStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenHouseEventListResponse {
  items: OpenHouseEvent[];
  total: number;
}

export interface OpenHouseEventPayload {
  date: string;
  time: string;
  capacity: number;
  status: OpenHouseEventStatus;
  notes?: string | null;
}

export interface OpenHouseReservation {
  id: string;
  event_id: string;
  property_id: string | null;
  property_title: string | null;
  event_date: string | null;
  event_time: string | null;
  name: string;
  email: string;
  phone: string;
  privacy_consent: boolean;
  status: OpenHouseReservationStatus;
  notes: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenHouseReservationListResponse {
  items: OpenHouseReservation[];
  total: number;
}

export interface OpenHouseReservationCreatePayload {
  name: string;
  email: string;
  phone: string;
  privacy_consent: boolean;
  source_url?: string | null;
}
