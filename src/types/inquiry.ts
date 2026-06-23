export type InquiryType =
  | "house_question"
  | "metrics_question"
  | "portfolio_request"
  | "matched_property_subscribe"
  | "delivery_question";

export interface Inquiry {
  id: string;
  type: InquiryType;
  property_id: string | null;
  property_title: string | null;
  name: string | null;
  question: string | null;
  contact_type: string | null;
  contact_value: string | null;
  city: string | null;
  district: string | null;
  privacy_consent: boolean;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InquiryListResponse {
  items: Inquiry[];
  total: number;
  skip: number;
  limit: number;
}

export interface InquiryCreatePayload {
  type: InquiryType;
  property_id?: string | null;
  name?: string | null;
  question?: string | null;
  contact_type?: "phone" | "email" | null;
  contact_value?: string | null;
  city?: string | null;
  district?: string | null;
  privacy_consent: boolean;
  source_url?: string | null;
}
