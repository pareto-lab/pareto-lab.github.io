/** Mirrors houseinus-api/app/schemas/property.py. Snake_case kept for parity. */

export type PropertyStatus = "draft" | "published" | "archived";

export interface Specs {
  beds?: number | null;
  baths?: number | null;
  land_area?: string | null;
  built_year?: string | null;
  indoor_area?: string | null;
  scale?: string | null;
}

export interface LoanInfo {
  estimated_monthly_payment?: number | null;
  max_loan_amount?: number | null;
  interest_rate?: number | null;
  loan_term?: number | null;
}

export interface OpenHouseEvent {
  id?: string | null;
  property_id?: string | null;
  date: string;
  time: string;
  available_spots: number;
  capacity?: number | null;
  reservation_count?: number;
  status?: string | null;
}

export interface HousePlanSpecRow {
  label: string;
  value: string;
  info_text?: string | null;
  hide_info?: boolean;
}

export interface HousePlanSpecs {
  main: HousePlanSpecRow[];
  collapsed: HousePlanSpecRow[];
}

export interface NearbyPlace {
  name: string;
  distance?: string | null;
}

export interface NearbyCategory {
  icon: string; // lucide icon name
  label: string;
  info_text?: string | null;
  hide_info?: boolean;
  places: NearbyPlace[];
}

export interface EvaluationMetric {
  score: number;
  title: string;
  description: string;
}

export type BeforePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface InteriorPhoto {
  image_id: string;
  caption: string;
  room: string;
  portrait: boolean;
  floor: number;
  floorplan_rect: [number, number, number, number] | number[];
  before_image_id?: string;
  before_position?: BeforePosition;
  swapped?: boolean;
}

export interface FloorplanEntry {
  image_id: string;
  label: string;
}

export interface LifestyleScenario {
  image_id: string;
  description: string;
}

export interface PropertyImage {
  id: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  alt: string | null;
  uploaded_at: string;
  url: string;
}

export interface Property {
  id: string;
  slug: string | null;
  delivery_token?: string | null;
  delivery_birthdate?: string | null;
  status: PropertyStatus;

  title: string;
  subtitle: string | null;
  location: string;
  price: number;
  display_order: number;
  tags: string[];

  hero_image: PropertyImage | null;
  portfolio_thumb: PropertyImage | null;

  lifestyle_story: string | null;
  lifestyle_story_overlay: boolean;
  lifestyle_highlights: string[];
  lifestyle_layout: string | null;
  specs: Specs;
  loan_info: LoanInfo;
  open_house_events: OpenHouseEvent[];
  house_plan_specs: HousePlanSpecs;
  nearby_places: NearbyCategory[];
  evaluation_metrics: EvaluationMetric[];
  interior_photos: InteriorPhoto[];
  floorplans: Record<string, FloorplanEntry>;
  lifestyle_scenarios: LifestyleScenario[];

  images: PropertyImage[];

  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PropertyListItem {
  id: string;
  slug: string | null;
  status: PropertyStatus;
  title: string;
  subtitle: string | null;
  location: string;
  price: number;
  display_order: number;
  tags: string[];
  specs: Specs;
  open_house_events: OpenHouseEvent[];
  hero_image: PropertyImage | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PropertyListResponse {
  items: PropertyListItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface PropertyCreatePayload {
  title: string;
  location: string;
  price: number;
}

/** Patch payload — every field optional, only changed fields included. */
export type PropertyUpdatePayload = Partial<{
  slug: string | null;
  title: string;
  subtitle: string | null;
  location: string;
  price: number;
  display_order: number;
  tags: string[];

  hero_image_id: string | null;
  portfolio_thumb_id: string | null;

  lifestyle_story: string | null;
  lifestyle_story_overlay: boolean;
  lifestyle_highlights: string[];
  lifestyle_layout: string | null;
  specs: Specs;
  loan_info: LoanInfo;
  open_house_events: OpenHouseEvent[];
  house_plan_specs: HousePlanSpecs;
  nearby_places: NearbyCategory[];
  evaluation_metrics: EvaluationMetric[];
  interior_photos: InteriorPhoto[];
  floorplans: Record<string, FloorplanEntry>;
  lifestyle_scenarios: LifestyleScenario[];
}>;
