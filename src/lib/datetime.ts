/**
 * Date/time formatting helpers for the admin UI.
 *
 * Renders in Asia/Seoul. Uses `yyyy/mm/dd` order.
 */

const KST = "Asia/Seoul";

const pad = (n: number) => String(n).padStart(2, "0");

const partsKst = (iso: string) => {
  const d = new Date(iso);
  // Use Intl to extract individual fields in KST regardless of host TZ.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    mi: get("minute"),
    s: get("second"),
  };
};

/** "2026/04/25" — date only. */
export const formatDateKst = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const { y, m, d } = partsKst(iso);
  return `${y}/${m}/${d}`;
};

/** "2026/04/25 14:30" — date + minutes. */
export const formatDateTimeKst = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const { y, m, d, h, mi } = partsKst(iso);
  return `${y}/${m}/${d} ${h}:${mi}`;
};

/** "2026/04/25 14:30:21" — date + seconds. */
export const formatDateTimeSecKst = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const { y, m, d, h, mi, s } = partsKst(iso);
  return `${y}/${m}/${d} ${h}:${mi}:${s}`;
};

// Suppress "pad not used" if rotated out — kept for callers that want raw padding.
export { pad };
