/**
 * Frontend-facing Property type. Populated dynamically from the API
 * (see `src/lib/propertyAdapter.ts`).
 *
 * Image fields hold URLs (`/uploads/...`) — they used to be bundled imports.
 *
 * Camel-cased on purpose: matches what the existing components expect.
 */

export interface OpenHouseEvent {
  id?: string;
  date: string;
  time: string;
  availableSpots: number;
  capacity?: number | null;
  reservationCount?: number;
  status?: string | null;
}

export interface Specs {
  beds: number;
  baths: number;
  landArea: string;
  builtYear?: string;
  indoorArea?: string;
  scale?: string;
}

export interface LoanInfo {
  estimatedMonthlyPayment: number;
  maxLoanAmount: number;
  interestRate: number;
  loanTerm: number;
}

export interface HousePlanSpecRow {
  label: string;
  value: string;
  info_text?: string;
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
  /** lucide-react icon name. Resolved by the consumer. */
  icon: string;
  label: string;
  info_text?: string;
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
  /** Resolved URL of the image. */
  src: string;
  caption: string;
  room: string;
  portrait: boolean;
  floor: number;
  floorplanRect: [number, number, number, number];
  beforeSrc?: string;
  beforePosition?: BeforePosition;
  swapped?: boolean;
}

export interface FloorplanEntry {
  src: string;
  label: string;
}

export interface LifestyleScenario {
  src: string;
  description: string;
}

export interface Property {
  id: string;
  slug: string | null;
  title: string;
  subtitle: string;
  location: string;
  price: number;
  /** Hero image URL. */
  image: string;
  lifestyleStory: string;
  lifestyleHighlights: string[];
  portfolioThumb?: string;
  /**
   * Public visibility flag derived from API status:
   * - "on"  ← published
   * - "off" ← draft / archived
   */
  status?: "on" | "off";
  specs?: Specs;
  openHouseEvents: OpenHouseEvent[];
  tags?: string[];
  loanInfo: LoanInfo;

  // Newly-dynamic sections (optional so list-only consumers still typecheck).
  housePlanSpecs?: HousePlanSpecs;
  nearbyPlaces?: NearbyCategory[];
  evaluationMetrics?: EvaluationMetric[];
  interiorPhotos?: InteriorPhoto[];
  floorplans?: Record<string, FloorplanEntry>;
  lifestyleScenarios?: LifestyleScenario[];
  lifestyleLayout?: string;
  lifestyleStoryOverlay?: boolean;
}
