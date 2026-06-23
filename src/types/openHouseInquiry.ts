export interface OpenHouseInquiry {
  id: string;
  property_id: string | null;
  property_title: string | null;
  name: string;
  email: string;
  privacy_consent: boolean;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenHouseInquiryListResponse {
  items: OpenHouseInquiry[];
  total: number;
  skip: number;
  limit: number;
}

export interface OpenHouseInquiryCreatePayload {
  property_id?: string | null;
  name: string;
  email: string;
  privacy_consent: boolean;
  source_url?: string | null;
}
