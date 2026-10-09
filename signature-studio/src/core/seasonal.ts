/**
 * Ready-made sign-offs and seasonal / promotional banners. Banners are drawn
 * as SVG here (pure) and turned into PNG images by the UI, because email
 * clients don't show SVG.
 */
import { esc } from "../lib/escape";

export interface SignOffGroup {
  label: string;
  items: string[];
}

export const SIGN_OFFS: SignOffGroup[] = [
  { label: "Professional", items: ["Best regards,", "Kind regards,", "Sincerely,", "Respectfully,", "With thanks,", "All the best,"] },
  { label: "Warm", items: ["Warmly,", "Cheers,", "Talk soon,", "Thanks so much,", "Have a great day,", "With gratitude,"] },
  {
    label: "Seasonal",
    items: [
      "Happy holidays,",
      "Season's greetings,",
      "Wishing you a happy new year,",
      "Enjoy the summer,",
      "Happy Thanksgiving,",
      "Eid Mubarak,",
      "Happy Lunar New Year,",
    ],
  },
];

export type Motif = "snow" | "confetti" | "sun" | "leaf" | "heart" | "crescent" | "lantern" | "spark" | "calendar" | "tag" | "people" | "mic";

export interface BannerSpec {
  id: string;
  label: string;
  /** Months (1–12) when it's most relevant; empty = any time. */
  months: number[];
  headline: string;
  sub: string;
  bg: string;
  fg: string;
  accent: string;
  motif: Motif;
  serif?: boolean;
}

export const BANNERS: BannerSpec[] = [
  {
    id: "holidays",
    label: "Happy holidays",
    months: [11, 12],
    headline: "Happy holidays",
    sub: "Wishing you a restful season",
    bg: "#14301f",
    fg: "#ffffff",
    accent: "#e8c372",
    motif: "snow",
    serif: true,
  },
  {
    id: "new-year",
    label: "New year",
    months: [12, 1],
    headline: "Happy new year",
    sub: "Here's to what we'll build together",
    bg: "#121218",
    fg: "#ffffff",
    accent: "#f2c14e",
    motif: "confetti",
    serif: true,
  },
  {
    id: "closure",
    label: "Holiday hours",
    months: [12],
    headline: "Holiday hours",
    sub: "Closed Dec 24 – Jan 1 · Replies may be slower",
    bg: "#f6efe4",
    fg: "#2b2118",
    accent: "#b23a2b",
    motif: "calendar",
  },
  {
    id: "lunar",
    label: "Lunar New Year",
    months: [1, 2],
    headline: "Happy Lunar New Year",
    sub: "Wishing you luck and prosperity",
    bg: "#8e1b1b",
    fg: "#ffe9b0",
    accent: "#f5c242",
    motif: "lantern",
    serif: true,
  },
  {
    id: "valentine",
    label: "Valentine's",
    months: [2],
    headline: "Made with love",
    sub: "Thank you for being part of our story",
    bg: "#fbe7ea",
    fg: "#5c1426",
    accent: "#e0475f",
    motif: "heart",
    serif: true,
  },
  {
    id: "ramadan",
    label: "Ramadan / Eid",
    months: [2, 3, 4],
    headline: "Ramadan Kareem",
    sub: "Wishing you a blessed month",
    bg: "#0f2a3d",
    fg: "#f6efe0",
    accent: "#e3b55b",
    motif: "crescent",
    serif: true,
  },
  {
    id: "spring",
    label: "Spring launch",
    months: [3, 4, 5],
    headline: "Something new is here",
    sub: "See what we've been working on",
    bg: "#eef6ee",
    fg: "#16351f",
    accent: "#3d9a5b",
    motif: "spark",
  },
  {
    id: "summer",
    label: "Summer hours",
    months: [6, 7, 8],
    headline: "Summer hours",
    sub: "Fridays we close at 1pm — enjoy the sun",
    bg: "#fff3d9",
    fg: "#3d2a05",
    accent: "#f29a1d",
    motif: "sun",
  },
  {
    id: "ooo",
    label: "Out of office",
    months: [],
    headline: "Out of office",
    sub: "Back soon — replies may be delayed",
    bg: "#eef1f6",
    fg: "#1c2433",
    accent: "#4a6cf7",
    motif: "calendar",
  },
  {
    id: "autumn",
    label: "Autumn",
    months: [9, 10, 11],
    headline: "Hello, autumn",
    sub: "New season, new ideas",
    bg: "#3a1f12",
    fg: "#fbead8",
    accent: "#e07b39",
    motif: "leaf",
    serif: true,
  },
  {
    id: "thanks",
    label: "Thanksgiving",
    months: [10, 11],
    headline: "With gratitude",
    sub: "Thank you for a wonderful year",
    bg: "#f7ecdf",
    fg: "#3b2414",
    accent: "#c0622b",
    motif: "leaf",
    serif: true,
  },
  {
    id: "sale",
    label: "Sale",
    months: [11],
    headline: "The sale is on",
    sub: "Up to 30% off — this week only",
    bg: "#0d0d0d",
    fg: "#ffffff",
    accent: "#ff4d3d",
    motif: "tag",
  },
  {
    id: "hiring",
    label: "We're hiring",
    months: [],
    headline: "We're hiring",
    sub: "Join the team — see open roles",
    bg: "#f2efff",
    fg: "#21184a",
    accent: "#6c55ff",
    motif: "people",
  },
  {
    id: "webinar",
    label: "Webinar",
    months: [],
    headline: "Join our live session",
    sub: "Save your seat — it's free",
    bg: "#101826",
    fg: "#ffffff",
    accent: "#3dd6c4",
    motif: "mic",
  },
];

/** Banners for this time of year first, then the rest. */
export function bannersFor(date = new Date()): BannerSpec[] {
  const m = date.getMonth() + 1;
  const score = (b: BannerSpec) => (b.months.includes(m) ? 0 : b.months.length ? 2 : 1);
  return [...BANNERS].sort((a, b) => score(a) - score(b));
}

export const BANNER_W = 600;
export const BANNER_H = 150;

function motif(m: Motif, c: string, fg: string): string {
  const x = 520;
  const y = 75;
  switch (m) {
    case "snow":
      return [
        [500, 40, 16],
        [552, 82, 11],
        [470, 104, 9],
        [560, 30, 7],
      ]
        .map(
          ([cx, cy, r]) =>
            `<g stroke="${c}" stroke-width="2.4" stroke-linecap="round">${[0, 60, 120]
              .map((a) => `<line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" transform="rotate(${a} ${cx} ${cy})"/>`)
              .join("")}</g>`,
        )
        .join("");
    case "confetti":
      return Array.from({ length: 18 }, (_, i) => {
        const px = 440 + ((i * 47) % 150);
        const py = 18 + ((i * 31) % 114);
        const col = [c, fg, "#ff6b6b", "#5ad1ff"][i % 4];
        return `<rect x="${px}" y="${py}" width="${6 + (i % 3) * 2}" height="${3 + (i % 2) * 3}" rx="1" fill="${col}" transform="rotate(${(i * 37) % 180} ${px} ${py})"/>`;
      }).join("");
    case "sun":
      return `<circle cx="${x}" cy="${y}" r="28" fill="${c}"/>${Array.from({ length: 12 }, (_, i) => `<line x1="${x}" y1="${y - 38}" x2="${x}" y2="${y - 52}" stroke="${c}" stroke-width="4" stroke-linecap="round" transform="rotate(${i * 30} ${x} ${y})"/>`).join("")}`;
    case "leaf":
      return [
        [500, 60, -20, 1],
        [552, 95, 25, 0.8],
        [545, 40, 60, 0.6],
      ]
        .map(
          ([lx, ly, a, s]) =>
            `<g transform="translate(${lx} ${ly}) rotate(${a}) scale(${s})"><path d="M0 -34 C 26 -18 26 18 0 34 C -26 18 -26 -18 0 -34 Z" fill="${c}"/><line x1="0" y1="-30" x2="0" y2="40" stroke="${fg}" stroke-opacity=".5" stroke-width="2"/></g>`,
        )
        .join("");
    case "heart":
      return `<path transform="translate(${x} ${y})" d="M0 26 C -40 -2 -30 -40 0 -18 C 30 -40 40 -2 0 26 Z" fill="${c}"/><path transform="translate(${x - 52} ${y - 34}) scale(.45)" d="M0 26 C -40 -2 -30 -40 0 -18 C 30 -40 40 -2 0 26 Z" fill="${c}" opacity=".6"/>`;
    case "crescent":
      return `<circle cx="${x}" cy="${y}" r="34" fill="${c}"/><circle cx="${x + 14}" cy="${y - 8}" r="30" fill="BG"/><path transform="translate(${x + 30} ${y - 30})" d="M0 -10 L3 -3 L10 -3 L4 2 L6 10 L0 5 L-6 10 L-4 2 L-10 -3 L-3 -3 Z" fill="${c}"/>`;
    case "lantern":
      return [
        [495, 0.9],
        [550, 1.1],
      ]
        .map(
          ([lx, s]) =>
            `<g transform="translate(${lx} 20) scale(${s})"><line x1="0" y1="0" x2="0" y2="14" stroke="${c}" stroke-width="2"/><ellipse cx="0" cy="44" rx="24" ry="30" fill="${c}"/><rect x="-10" y="12" width="20" height="6" fill="${fg}"/><rect x="-10" y="70" width="20" height="6" fill="${fg}"/><line x1="0" y1="76" x2="0" y2="92" stroke="${c}" stroke-width="2"/></g>`,
        )
        .join("");
    case "spark":
      return [
        [515, 70, 30],
        [560, 34, 14],
        [470, 112, 10],
      ]
        .map(
          ([cx, cy, r]) =>
            `<path d="M${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z" fill="${c}"/>`,
        )
        .join("");
    case "calendar":
      return `<g transform="translate(${x - 34} ${y - 36})"><rect width="68" height="70" rx="8" fill="none" stroke="${c}" stroke-width="4"/><rect width="68" height="18" rx="6" fill="${c}"/><line x1="18" y1="-6" x2="18" y2="8" stroke="${c}" stroke-width="4" stroke-linecap="round"/><line x1="50" y1="-6" x2="50" y2="8" stroke="${c}" stroke-width="4" stroke-linecap="round"/>${[
        0, 1, 2,
      ]
        .flatMap((r) =>
          [0, 1, 2].map(
            (k) => `<rect x="${12 + k * 17}" y="${28 + r * 13}" width="9" height="8" rx="2" fill="${c}" opacity="${r === 1 && k === 1 ? 1 : 0.45}"/>`,
          ),
        )
        .join("")}</g>`;
    case "tag":
      return `<g transform="translate(${x} ${y}) rotate(-18)"><path d="M-44 -24 H22 L44 0 L22 24 H-44 Z" fill="${c}"/><circle cx="24" cy="0" r="5" fill="BG"/><text x="-10" y="7" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="20" fill="${fg}" text-anchor="middle">%</text></g>`;
    case "people":
      return [
        [495, 0.85],
        [535, 1],
        [575, 0.85],
      ]
        .map(
          ([px, s]) =>
            `<g transform="translate(${px} ${y}) scale(${s})"><circle cx="0" cy="-18" r="14" fill="${c}"/><path d="M-24 34 C -24 6 24 6 24 34 Z" fill="${c}"/></g>`,
        )
        .join("");
    case "mic":
      return `<g transform="translate(${x} ${y - 6})"><rect x="-14" y="-40" width="28" height="50" rx="14" fill="${c}"/><path d="M-26 -4 C -26 30 26 30 26 -4" fill="none" stroke="${c}" stroke-width="4"/><line x1="0" y1="26" x2="0" y2="44" stroke="${c}" stroke-width="4"/></g>`;
  }
}

/**
 * The banner as SVG (600×150 design units; render at 2× for sharpness).
 * Fonts are system stacks because images can't load webfonts.
 */
export function bannerSvg(b: BannerSpec, o: { headline?: string; sub?: string; accent?: string } = {}): string {
  const accent = o.accent ?? b.accent;
  const head = esc((o.headline ?? b.headline).slice(0, 40));
  const sub = esc((o.sub ?? b.sub).slice(0, 70));
  const family = b.serif ? "Georgia, 'Times New Roman', serif" : "'Helvetica Neue', Helvetica, Arial, sans-serif";
  const size = head.length > 18 ? 32 : 38;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_W * 2}" height="${BANNER_H * 2}" viewBox="0 0 ${BANNER_W} ${BANNER_H}">
<rect width="${BANNER_W}" height="${BANNER_H}" fill="${b.bg}"/>
<rect x="0" y="0" width="6" height="${BANNER_H}" fill="${accent}"/>
<text x="36" y="${BANNER_H / 2 + 2}" font-family="${family}" font-size="${size}" font-weight="${b.serif ? 400 : 700}" ${b.serif ? 'font-style="italic"' : ""} fill="${b.fg}">${head}</text>
<text x="38" y="${BANNER_H / 2 + 32}" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="15" fill="${b.fg}" fill-opacity=".78">${sub}</text>
${motif(b.motif, accent, b.fg).replace(/BG/g, b.bg)}
</svg>`;
}
