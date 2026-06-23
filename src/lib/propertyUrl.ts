import type { Property } from "@/data/properties";

export const propertyUrl = (p: Pick<Property, "id" | "slug">) =>
  `/properties/${p.slug ?? p.id}`;
