export interface MbtiResult {
  id: string;
  participant_id: string;
  email: string | null;
  email_consent: boolean;
  age: string;
  gender: string;
  family_type: string;
  driving: boolean;
  plants: boolean;
  pets: boolean;
  camping: boolean;
  hobbies: string[];
  dreams: string[];
  source: "anonymous" | "email_save" | string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MbtiResultListResponse {
  items: MbtiResult[];
  total: number;
  skip: number;
  limit: number;
}

export interface MbtiResultCreatePayload {
  participant_id: string;
  email?: string | null;
  email_consent: boolean;
  age: string;
  gender: string;
  family_type: string;
  driving: boolean;
  plants: boolean;
  pets: boolean;
  camping: boolean;
  hobbies: string[];
  dreams: string[];
  source: "anonymous" | "email_save";
  source_url?: string | null;
}
