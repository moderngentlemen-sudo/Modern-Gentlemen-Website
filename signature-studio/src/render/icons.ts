import qrcode from "qrcode-generator";
import { GLYPH_PATHS, ICON_PATHS } from "../core/iconPaths";
import type { IconShape } from "../core/types";
import { esc } from "../lib/escape";

/** Social icon as SVG in one of the icon shapes. */
export function socialSvg(platform: string, shape: IconShape, size: number, color: string): string {
  const path = ICON_PATHS[platform] ?? ICON_PATHS.custom;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">`;
  const glyph = (scale: number, fill: string) => {
    const o = (24 - 24 * scale) / 2;
    return `<path transform="translate(${o} ${o}) scale(${scale})" fill="${esc(fill)}" d="${path}"/>`;
  };
  switch (shape) {
    case "plain":
      return `${open}${glyph(0.92, color)}</svg>`;
    case "outline":
      return `${open}<circle cx="12" cy="12" r="11.1" fill="none" stroke="${esc(color)}" stroke-width="1.4"/>${glyph(0.48, color)}</svg>`;
    case "circle":
      return `${open}<circle cx="12" cy="12" r="12" fill="${esc(color)}"/>${glyph(0.52, "#ffffff")}</svg>`;
    case "rounded":
      return `${open}<rect width="24" height="24" rx="6" fill="${esc(color)}"/>${glyph(0.54, "#ffffff")}</svg>`;
    case "square":
      return `${open}<rect width="24" height="24" fill="${esc(color)}"/>${glyph(0.54, "#ffffff")}</svg>`;
  }
}

/** Small contact/add-on glyph (phone, email, star…). */
export function glyphSvg(name: string, size: number, color: string, background?: string): string {
  const path = GLYPH_PATHS[name] ?? GLYPH_PATHS.website;
  const bg = background ? `<rect width="24" height="24" rx="12" fill="${esc(background)}"/>` : "";
  const scale = background ? 0.6 : 1;
  const o = (24 - 24 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${bg}<path transform="translate(${o} ${o}) scale(${scale})" fill="${esc(color)}" d="${path}"/></svg>`;
}

/** App store badge (text-based, brand-neutral). */
export function badgeSvg(store: "apple" | "google", height: number): string {
  const w = Math.round(height * 3.1);
  const [small, big] = store === "apple" ? ["Download on the", "App Store"] : ["GET IT ON", "Google Play"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 124 40"><rect width="124" height="40" rx="7" fill="#000"/><rect x=".5" y=".5" width="123" height="39" rx="6.5" fill="none" stroke="#a6a6a6"/><text x="62" y="16" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="8" fill="#fff">${small}</text><text x="62" y="31" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="600" fill="#fff">${big}</text></svg>`;
}

export function qrSvg(value: string, size: number, color: string): string {
  const qr = qrcode(0, "M");
  qr.addData(value || " ");
  qr.make();
  const count = qr.getModuleCount();
  const n = count + 4;
  let d = "";
  for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path fill="${esc(color)}" d="${d}"/></svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
