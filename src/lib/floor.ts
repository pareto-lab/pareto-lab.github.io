export const ROOFTOP_FLOOR = 999;

export const formatFloorLabel = (floor: number | string): string => {
  const parsed = Number(floor);
  if (!Number.isFinite(parsed)) return String(floor);

  if (parsed === ROOFTOP_FLOOR) return "옥탑";
  if (parsed === -1) return "지하";
  if (parsed <= -2) return `지하 ${Math.abs(parsed)}층`;
  return `${parsed}층`;
};

export const defaultFloorplanLabel = (floor: number | string): string =>
  `평면도 · ${formatFloorLabel(floor)}`;

export const compareFloorKeys = (a: string, b: string): number => {
  const parsedA = Number(a);
  const parsedB = Number(b);
  const validA = Number.isFinite(parsedA);
  const validB = Number.isFinite(parsedB);

  if (validA && validB) return parsedA - parsedB;
  if (validA) return -1;
  if (validB) return 1;
  return a.localeCompare(b, "ko-KR");
};

export const FLOOR_PICK_OPTIONS: { value: number; label: string }[] = [
  { value: -2, label: formatFloorLabel(-2) },
  { value: -1, label: formatFloorLabel(-1) },
  ...Array.from({ length: 30 }, (_, idx) => {
    const value = idx + 1;
    return { value, label: formatFloorLabel(value) };
  }),
  { value: ROOFTOP_FLOOR, label: formatFloorLabel(ROOFTOP_FLOOR) },
];
