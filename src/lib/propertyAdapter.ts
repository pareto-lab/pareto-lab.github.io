import type {
  Property as ApiProperty,
  PropertyListItem as ApiPropertyListItem,
} from "@/types/property";
import type { Property } from "@/data/properties";

const adaptStatus = (s: string): "on" | "off" =>
  s === "published" ? "on" : "off";

const adaptSpecs = (api: ApiProperty["specs"]): Property["specs"] => {
  // Only return specs object if at least one field has a value.
  const hasAny =
    api.beds != null ||
    api.baths != null ||
    api.land_area ||
    api.built_year ||
    api.indoor_area ||
    api.scale;
  if (!hasAny) return undefined;
  return {
    beds: api.beds ?? 0,
    baths: api.baths ?? 0,
    landArea: api.land_area ?? "",
    builtYear: api.built_year ?? undefined,
    indoorArea: api.indoor_area ?? undefined,
    scale: api.scale ?? undefined,
  };
};

const adaptLoanInfo = (api: ApiProperty["loan_info"]): Property["loanInfo"] => ({
  estimatedMonthlyPayment: api.estimated_monthly_payment ?? 0,
  maxLoanAmount: api.max_loan_amount ?? 0,
  interestRate: api.interest_rate ?? 0,
  loanTerm: api.loan_term ?? 0,
});

const adaptEvents = (api: ApiProperty["open_house_events"]) =>
  api.map((e) => ({
    id: e.id ?? undefined,
    date: e.date,
    time: e.time,
    availableSpots: e.available_spots,
    capacity: e.capacity ?? null,
    reservationCount: e.reservation_count ?? 0,
    status: e.status ?? null,
  }));

export function adaptProperty(api: ApiProperty): Property {
  // Build image_id → URL map for resolving nested references.
  const urlById = new Map<string, string>();
  for (const img of api.images) urlById.set(img.id, img.url);

  return {
    id: api.id,
    slug: api.slug,
    title: api.title,
    subtitle: api.subtitle ?? "",
    location: api.location,
    price: api.price,
    image: api.hero_image?.url ?? "",
    tags: api.tags,
    status: adaptStatus(api.status),
    portfolioThumb: api.portfolio_thumb?.url,
    lifestyleStory: api.lifestyle_story ?? "",
    lifestyleHighlights: api.lifestyle_highlights,
    specs: adaptSpecs(api.specs),
    openHouseEvents: adaptEvents(api.open_house_events),
    loanInfo: adaptLoanInfo(api.loan_info),

    housePlanSpecs: api.house_plan_specs,
    nearbyPlaces: api.nearby_places,
    evaluationMetrics: api.evaluation_metrics,

    interiorPhotos: api.interior_photos
      .map((ip) => {
        const beforeSrc = ip.before_image_id
          ? urlById.get(ip.before_image_id)
          : undefined;
        return {
          src: urlById.get(ip.image_id) ?? "",
          caption: ip.caption,
          room: ip.room,
          portrait: ip.portrait,
          floor: ip.floor,
          floorplanRect: [
            Number(ip.floorplan_rect[0] ?? 0),
            Number(ip.floorplan_rect[1] ?? 0),
            Number(ip.floorplan_rect[2] ?? 0),
            Number(ip.floorplan_rect[3] ?? 0),
          ] as [number, number, number, number],
          ...(beforeSrc ? { beforeSrc, beforePosition: ip.before_position, swapped: ip.swapped ?? false } : {}),
        };
      })
      .filter((ip) => ip.src),

    floorplans: Object.fromEntries(
      Object.entries(api.floorplans)
        .map(([floor, entry]) => [
          floor,
          {
            src: urlById.get(entry.image_id) ?? "",
            label: entry.label,
          },
        ])
        .filter(([, fp]) => (fp as { src: string }).src),
    ),

    lifestyleScenarios: api.lifestyle_scenarios
      .map((s) => ({
        src: urlById.get(s.image_id) ?? "",
        description: s.description,
      }))
      .filter((s) => s.src),

    lifestyleLayout: api.lifestyle_layout ?? undefined,
    lifestyleStoryOverlay: api.lifestyle_story_overlay ?? false,
  };
}

export function adaptListItem(api: ApiPropertyListItem): Property {
  return {
    id: api.id,
    slug: api.slug,
    title: api.title,
    subtitle: api.subtitle ?? "",
    location: api.location,
    price: api.price,
    image: api.hero_image?.url ?? "",
    tags: api.tags,
    status: adaptStatus(api.status),
    lifestyleStory: "",
    lifestyleHighlights: [],
    specs: adaptSpecs(api.specs),
    openHouseEvents: adaptEvents(api.open_house_events),
    loanInfo: { estimatedMonthlyPayment: 0, maxLoanAmount: 0, interestRate: 0, loanTerm: 0 },
  };
}
