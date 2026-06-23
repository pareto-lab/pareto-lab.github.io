import { formatFloorLabel } from "@/lib/floor";
import type { InteriorPhoto, FloorplanEntry, LifestyleScenario } from "@/data/properties";

export type UploadMode = "peterpan" | "daangn";

const S = 4;
const CSS_W = 390;
const W = CSS_W * S;

function getCssHsl(name: string): string {
  return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return [];
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line + word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line.trimEnd());
      line = word.trimStart();
    } else {
      line = test;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.length > 0 ? lines : [];
}

export async function buildCardCanvas(
  photo: InteriorPhoto,
  floorplan?: FloorplanEntry,
  mode: UploadMode = "peterpan",
): Promise<HTMLCanvasElement> {
  const mainSrc   = photo.swapped && photo.beforeSrc ? photo.beforeSrc : photo.src;
  const insetSrc  = photo.swapped ? photo.src : photo.beforeSrc;
  const insetLabel = photo.swapped ? "활용 제안" : "실제 공간";

  const [photoImg, fpImg, beforeImg] = await Promise.all([
    loadImg(mainSrc),
    floorplan ? loadImg(floorplan.src).catch(() => null) : Promise.resolve(null),
    insetSrc ? loadImg(insetSrc).catch(() => null) : Promise.resolve(null),
  ]);

  const C_CARD    = getCssHsl("--card");
  const C_FG      = getCssHsl("--foreground");
  const C_MUTED   = getCssHsl("--muted-foreground");
  const C_PRIMARY = getCssHsl("--primary");
  const C_BORDER  = getCssHsl("--border");

  const PX4  = 16 * S;
  const PY2  = 8 * S;
  const PY25 = 10 * S;
  const FP   = 60 * S;

  const FONT_ROOM    = 18 * S;
  const FONT_FLOOR   = 12 * S;
  const FONT_CAPTION = 12 * S;
  const LH_ROOM      = FONT_ROOM * 1.4;
  const LH_FLOOR_L   = FONT_FLOOR * 1.4;
  const LH_CAPTION   = FONT_CAPTION * 1.6;

  const HEADER_H = Math.max(LH_ROOM + LH_FLOOR_L + PY2 * 2, FP + PY2 * 2);
  const PHOTO_H  = mode === "daangn"
    ? W
    : photo.portrait ? Math.round(W * 4 / 3) : Math.round(W * 3 / 4);
  const CAPTION_H = HEADER_H;

  const tmpCtx = document.createElement("canvas").getContext("2d")!;
  tmpCtx.font = `400 ${FONT_CAPTION}px system-ui, sans-serif`;
  const allCapLines = wrapLines(tmpCtx, photo.caption || "", W - PX4 * 2);
  const CAP_PAD_TOP = PY25 * 2;
  const maxCapLines = Math.floor((CAPTION_H - CAP_PAD_TOP - PY25) / LH_CAPTION);
  const capLines = allCapLines.slice(0, maxCapLines);
  if (allCapLines.length > maxCapLines && capLines.length > 0) {
    let last = capLines[capLines.length - 1];
    while (last.length > 0 && tmpCtx.measureText(last + "…").width > W - PX4 * 2) {
      last = last.slice(0, -1);
    }
    capLines[capLines.length - 1] = last + "…";
  }

  const TOTAL_H = Math.ceil(HEADER_H + PHOTO_H + CAPTION_H);
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = TOTAL_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = C_CARD;
  ctx.fillRect(0, 0, W, TOTAL_H);

  const midY  = HEADER_H / 2;
  const colTop = midY - (LH_ROOM + LH_FLOOR_L) / 2;

  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.font      = `600 ${FONT_ROOM}px serif`;
  ctx.fillStyle = C_FG;
  ctx.fillText(photo.room, PX4, colTop);
  ctx.font      = `400 ${FONT_FLOOR}px system-ui, sans-serif`;
  ctx.fillStyle = C_MUTED;
  ctx.fillText(formatFloorLabel(photo.floor), PX4, colTop + LH_ROOM);

  if (fpImg) {
    const sc = FP / fpImg.naturalHeight;
    const dw = fpImg.naturalWidth * sc;
    const dh = FP;
    const dx = W - dw - PX4;
    const dy = midY - dh / 2;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(fpImg, dx, dy, dw, dh);
    ctx.globalAlpha = 1;
    const [rx, ry, rw, rh] = photo.floorplanRect;
    if (rw && rh) {
      const hx = dx + (rx / 100) * dw;
      const hy = dy + (ry / 100) * dh;
      const hw = (rw / 100) * dw;
      const hh = (rh / 100) * dh;
      ctx.fillStyle   = C_PRIMARY;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(hx, hy, hw, hh);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = C_PRIMARY;
      ctx.lineWidth   = 2 * S;
      ctx.strokeRect(hx, hy, hw, hh);
    }
  }

  ctx.strokeStyle = C_BORDER;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(W, HEADER_H);
  ctx.stroke();

  const photoY = HEADER_H;
  ctx.fillStyle = "rgba(10,10,10,0.05)";
  ctx.fillRect(0, photoY, W, PHOTO_H);
  const psc = Math.min(W / photoImg.naturalWidth, PHOTO_H / photoImg.naturalHeight);
  const pdw = photoImg.naturalWidth  * psc;
  const pdh = photoImg.naturalHeight * psc;
  ctx.drawImage(photoImg, (W - pdw) / 2, photoY + (PHOTO_H - pdh) / 2, pdw, pdh);

  if (beforeImg && insetSrc && photo.beforePosition) {
    const BM = 8 * S;
    const BW = W * 0.333;
    const BH = PHOTO_H * 0.333;
    let bx = BM, by = photoY + BM;
    if (photo.beforePosition === "top-right")    { bx = W - BW - BM; }
    if (photo.beforePosition === "bottom-left")  { by = photoY + PHOTO_H - BH - BM; }
    if (photo.beforePosition === "bottom-right") { bx = W - BW - BM; by = photoY + PHOTO_H - BH - BM; }
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, BW, BH);
    ctx.clip();
    ctx.fillStyle = "rgba(10,10,10,0.05)";
    ctx.fillRect(bx, by, BW, BH);
    const bsc = Math.min(BW / beforeImg.naturalWidth, BH / beforeImg.naturalHeight);
    const bdw = beforeImg.naturalWidth  * bsc;
    const bdh = beforeImg.naturalHeight * bsc;
    ctx.drawImage(beforeImg, bx + (BW - bdw) / 2, by + (BH - bdh) / 2, bdw, bdh);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth   = 2 * S;
    ctx.strokeRect(bx, by, BW, BH);
    ctx.font = `400 ${9 * S}px system-ui, sans-serif`;
    const lblTxt = insetLabel;
    const lblPad = 6 * S;
    const lblW   = ctx.measureText(lblTxt).width + lblPad * 2;
    const lblH   = 16 * S;
    const lblX   = bx + 6 * S;
    const lblY   = by + BH - lblH - 6 * S;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(lblX, lblY, lblW, lblH);
    ctx.fillStyle    = C_MUTED;
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(lblTxt, lblX + lblPad, lblY + lblH / 2);
  }

  const capY = HEADER_H + PHOTO_H;
  ctx.strokeStyle = C_BORDER;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, capY);
  ctx.lineTo(W, capY);
  ctx.stroke();
  ctx.font         = `400 ${FONT_CAPTION}px system-ui, sans-serif`;
  ctx.fillStyle    = C_MUTED;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  capLines.forEach((line, i) => {
    ctx.fillText(line, PX4, capY + CAP_PAD_TOP + i * LH_CAPTION);
  });
  ctx.font         = `400 ${9 * S}px system-ui, sans-serif`;
  ctx.fillStyle    = C_MUTED;
  ctx.globalAlpha  = 0.5;
  ctx.textAlign    = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("made with 하우스인어스", W - PX4, capY + CAPTION_H - PY25);
  ctx.globalAlpha  = 1;

  return canvas;
}

export async function buildLifestyleCanvas(
  scenario: LifestyleScenario,
  index: number,
  mode: UploadMode = "peterpan",
): Promise<HTMLCanvasElement> {
  const photoImg = await loadImg(scenario.src);

  const C_CARD    = getCssHsl("--card");
  const C_FG      = getCssHsl("--foreground");
  const C_MUTED   = getCssHsl("--muted-foreground");
  const C_BORDER  = getCssHsl("--border");

  const PX4  = 16 * S;
  const PY2  = 8 * S;
  const PY25 = 10 * S;

  const FP = 60 * S;

  const FONT_TITLE   = 18 * S;
  const FONT_IDX     = 12 * S;
  const FONT_CAPTION = 12 * S;
  const LH_TITLE     = FONT_TITLE * 1.4;
  const LH_IDX       = FONT_IDX * 1.4;
  const LH_CAPTION   = FONT_CAPTION * 1.6;

  const HEADER_H  = Math.max(LH_TITLE + LH_IDX + PY2 * 2, FP + PY2 * 2);
  const PHOTO_H   = mode === "daangn" ? W : Math.round(W * 3 / 4);
  const CAPTION_H = HEADER_H;

  const tmpCtx = document.createElement("canvas").getContext("2d")!;
  tmpCtx.font = `400 ${FONT_CAPTION}px system-ui, sans-serif`;
  const allCapLines = wrapLines(tmpCtx, scenario.description || "", W - PX4 * 2);
  const CAP_PAD_TOP = PY25 * 2;
  const maxCapLines = Math.floor((CAPTION_H - CAP_PAD_TOP - PY25) / LH_CAPTION);
  const capLines = allCapLines.slice(0, maxCapLines);
  if (allCapLines.length > maxCapLines && capLines.length > 0) {
    let last = capLines[capLines.length - 1];
    while (last.length > 0 && tmpCtx.measureText(last + "…").width > W - PX4 * 2) {
      last = last.slice(0, -1);
    }
    capLines[capLines.length - 1] = last + "…";
  }

  const TOTAL_H = Math.ceil(HEADER_H + PHOTO_H + CAPTION_H);
  const canvas = document.createElement("canvas");
  canvas.width  = W;
  canvas.height = TOTAL_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = C_CARD;
  ctx.fillRect(0, 0, W, TOTAL_H);

  const midY  = HEADER_H / 2;
  const colTop = midY - (LH_TITLE + LH_IDX) / 2;

  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  ctx.font      = `600 ${FONT_TITLE}px serif`;
  ctx.fillStyle = C_FG;
  ctx.fillText("이곳에서의 일상", PX4, colTop);
  ctx.font      = `400 ${FONT_IDX}px system-ui, sans-serif`;
  ctx.fillStyle = C_MUTED;
  ctx.fillText(`#${index}`, PX4, colTop + LH_TITLE);

  ctx.strokeStyle = C_BORDER;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(W, HEADER_H);
  ctx.stroke();

  const photoY = HEADER_H;
  ctx.fillStyle = "rgba(10,10,10,0.05)";
  ctx.fillRect(0, photoY, W, PHOTO_H);
  const psc = Math.min(W / photoImg.naturalWidth, PHOTO_H / photoImg.naturalHeight);
  const pdw = photoImg.naturalWidth  * psc;
  const pdh = photoImg.naturalHeight * psc;
  ctx.drawImage(photoImg, (W - pdw) / 2, photoY + (PHOTO_H - pdh) / 2, pdw, pdh);

  const capY = HEADER_H + PHOTO_H;
  ctx.strokeStyle = C_BORDER;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, capY);
  ctx.lineTo(W, capY);
  ctx.stroke();
  ctx.font         = `400 ${FONT_CAPTION}px system-ui, sans-serif`;
  ctx.fillStyle    = C_MUTED;
  ctx.textAlign    = "left";
  ctx.textBaseline = "top";
  capLines.forEach((line, i) => {
    ctx.fillText(line, PX4, capY + CAP_PAD_TOP + i * LH_CAPTION);
  });
  ctx.font         = `400 ${9 * S}px system-ui, sans-serif`;
  ctx.fillStyle    = C_MUTED;
  ctx.globalAlpha  = 0.5;
  ctx.textAlign    = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText("made with 하우스인어스", W - PX4, capY + CAPTION_H - PY25);
  ctx.globalAlpha  = 1;

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/jpeg", quality)
  );
}
