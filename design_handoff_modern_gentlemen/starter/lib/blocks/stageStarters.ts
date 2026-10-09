import { isFontValue } from "@/lib/domain/fontLibrary";
import { countdownParts } from "./afterHours";
import {
  REEL_DEFAULTS,
  REEL_DESIGNS,
  REEL_POSTER,
  REEL_STARTERS,
  REEL_VIDEO,
  reelConfigWithLaunchDate,
  type ReelDesignId,
} from "./comingSoonReel";
import type { BlockNode, BlockTree } from "./types";

/**
 * CS22–CS35 rebuilt as Stage layouts: the same fourteen compositions, but every
 * piece is a separate element that can be dragged, resized, scaled, restyled,
 * deleted or joined by new ones.
 *
 * Placements are read off the original designs at 1440×900 and stored as
 * percentages, so each layout keeps its proportions on any desktop. Phones
 * stack the elements in the order listed here (the reading order); `phone` is
 * the scale each element takes there, or "hide" for purely decorative pieces
 * that do not belong in a single column.
 *
 * Everything an editor would want to change is a setting on one of these
 * elements; the stage itself holds only the background.
 */

export interface StarterContent {
  title: string;
  eyebrow?: string;
  intro?: string;
  signature?: string;
  brand: string;
  buttonLabel: string;
  showSignup: boolean;
  socialLinks: { network: string; label: string; href: string }[];
  video: string;
  poster: string;
  caption?: string;
  target: string;
  message: string;
  placeholder: string;
  details?: { title: string; text?: string }[];
}

const SOCIAL = [
  { network: "instagram", label: "Instagram", href: "https://instagram.com" },
  { network: "x", label: "X", href: "https://x.com" },
  { network: "youtube", label: "YouTube", href: "https://youtube.com" },
];

export function starterContent(
  id: ReelDesignId,
  overrides: Partial<StarterContent> = {},
  /** False when converting an existing page: optional copy it never had stays absent. */
  starterCopy = true
) {
  const copy = starterCopy ? REEL_STARTERS[id] : { ...REEL_STARTERS[id], ...NO_OPTIONAL_COPY };
  const base: StarterContent = {
    title: copy.title,
    eyebrow: copy.eyebrow,
    intro: copy.intro,
    signature: copy.signature,
    brand: copy.brand ?? "Modern Gentlemen",
    buttonLabel: copy.buttonLabel,
    showSignup: true,
    socialLinks: SOCIAL.map((link) => ({ ...link })),
    video: REEL_VIDEO,
    poster: REEL_POSTER,
    caption: copy.caption,
    target: "",
    message: REEL_DEFAULTS.countdown.message,
    placeholder: REEL_DEFAULTS.placeholder,
    details: copy.details?.map((d) => ({ ...d })),
  };
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined && value !== "")
  );
  return { ...base, ...defined } as StarterContent;
}

const NO_OPTIONAL_COPY = {
  eyebrow: undefined,
  intro: undefined,
  signature: undefined,
  caption: undefined,
  details: undefined,
};

const WHITE = "#f4f4f4";
const INK = "#141414";
const RED_ON_DARK = "#ff4d5e";
const RED = "#c8102e";
const SERIF = "theme:editorial";
const SANS = "theme:heading";
const MONO = "theme:label";

type Phone = number | "hide";
interface Spec {
  type: string;
  name: string;
  settings: Record<string, unknown>;
  /** x, y, w (percent of the stage), z. */
  at: [number, number, number, number?];
  scale?: number;
  phone?: Phone;
}

function node(id: string, index: number, spec: Spec): BlockNode {
  const [x, y, w, z = 2] = spec.at;
  const scale = spec.scale ?? 1;
  const desktop = { x, y, w, scale, z };
  return {
    _key: `cs${id}-${index}`,
    _type: spec.type,
    settings: spec.settings,
    visual: {
      name: spec.name,
      stage: {
        desktop,
        ...(typeof spec.phone === "number" ? { mobile: { ...desktop, scale: spec.phone } } : {}),
      },
    },
    ...(spec.phone === "hide" ? { visibility: { devices: ["desktop", "tablet"] } } : {}),
  } as BlockNode;
}

// ── Element recipes ────────────────────────────────────────────────────────

const text = (
  name: string,
  content: string,
  at: Spec["at"],
  style: Record<string, unknown>,
  phone: Phone = 1
): Spec => ({
  type: "nativeText",
  name,
  at,
  phone,
  settings: { content, maxWidth: "none", align: "start", ...style },
});

const heading = (
  name: string,
  value: string,
  at: Spec["at"],
  style: Record<string, unknown>,
  phone: Phone = 0.55
): Spec => ({
  type: "nativeHeading",
  name,
  at,
  phone,
  settings: { text: value, level: "h1", maxWidth: "none", ...style },
});

const italic = (color: string, size: number, align = "left") => ({
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: size,
  textColor: color,
  textAlign: align,
  lineHeight: 1.05,
});
const mono = (color: string | undefined, size = 10, align = "left") => ({
  fontFamily: MONO,
  fontSize: size,
  letterSpacing: 0.22,
  textTransform: "uppercase",
  textAlign: align,
  ...(color ? { textColor: color } : {}),
});
const sans = (color: string | undefined, size: number, align = "left", weight = "500") => ({
  fontFamily: SANS,
  fontSize: size,
  fontWeight: weight,
  lineHeight: 1.02,
  letterSpacing: -0.02,
  textAlign: align,
  ...(color ? { textColor: color } : {}),
});

const logo = (
  at: Spec["at"],
  c: StarterContent,
  extra: Record<string, unknown> = {},
  phone: Phone = 1
): Spec => ({
  type: "nativeLogo",
  name: "Logo",
  at,
  phone,
  settings: { variant: "wordmark", size: 30, label: c.brand, href: "/", ...extra },
});

const social = (at: Spec["at"], c: StarterContent, align: string, color?: string): Spec => ({
  type: "nativeSocial",
  name: "Social links",
  at,
  phone: 1,
  settings: {
    links: c.socialLinks.map((l) => ({ ...l })),
    size: 20,
    gap: 24,
    align,
    ...(color ? { color } : {}),
  },
});

const signup = (at: Spec["at"], c: StarterContent, align: string, color?: string): Spec => ({
  type: "nativeSignup",
  name: "Email signup",
  at,
  phone: 1,
  settings: {
    buttonLabel: c.buttonLabel,
    placeholder: c.placeholder,
    align,
    accessibleLabel: "Email address",
    ...(color ? { color } : {}),
  },
});

const countdown = (
  at: Spec["at"],
  c: StarterContent,
  style: Record<string, unknown>,
  phone?: Phone
): Spec => ({
  type: "nativeCountdown",
  name: "Countdown",
  at,
  // On phones a stacked Stage caps the numerals at a share of the screen, so labels keep their size.
  phone: phone ?? 1,
  settings: { target: c.target, message: c.message, ...style },
});

const shape = (name: string, at: Spec["at"], settings: Record<string, unknown>): Spec => ({
  type: "nativeShape",
  name,
  at,
  phone: "hide",
  settings,
});

/** "18:00 GMT, 15 January" from the launch date, or the fallback when there is none. */
function doorsOpen(target: string, fallback: string) {
  if (countdownParts(target, 0) === null) return fallback;
  const when = new Date(Date.parse(target));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(when);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
  }).format(when);
  return `${time}, ${day}`;
}

// ── The fourteen layouts ───────────────────────────────────────────────────

type Layout = {
  stage: Record<string, unknown>;
  elements: (c: StarterContent) => (Spec | false | "" | undefined)[];
};

const VIDEO_STAGE = (c: StarterContent, extra: Record<string, unknown> = {}) => ({
  video: c.video,
  image: c.poster,
  color: "#0d0d0d",
  tone: "light",
  scrim: 40,
  shade: "even",
  height: "screen",
  mobileLayout: "stack",
  standalone: true,
  ...extra,
});

const LAYOUTS: Record<ReelDesignId, (c: StarterContent) => Layout> = {
  "22": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 45, shade: "vignette" }),
    elements: () => [
      logo([1.8, 5.2, 10, 3], c),
      text("Eyebrow", c.title, [25, 27, 50, 3], italic(RED_ON_DARK, 28, "center"), 1),
      countdown([12, 33.5, 76, 3], c, {
        style: "numerals",
        size: 150,
        separator: "colon",
        accentUnit: "seconds",
        accentColor: "#e8102e",
      }),
      c.intro &&
        text("Supporting copy", c.intro, [32, 58.5, 36, 3], { fontSize: 17, textAlign: "center" }),
      c.showSignup && signup([32.5, 66.5, 35, 3], c, "center"),
      social([84, 5.8, 14.2, 3], c, "right"),
    ],
  }),
  "23": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 55, shade: "vignette", monochrome: 100 }),
    elements: () => [
      logo([45, 5.2, 10, 3], c, { align: "center" }),
      c.eyebrow && text("Eyebrow", c.eyebrow, [35, 27.5, 30, 3], mono(undefined, 10, "center")),
      heading(
        "Headline",
        c.title,
        [15, 30, 70, 3],
        {
          ...italic(WHITE, 240, "center"),
          lineHeight: 0.9,
        },
        0.35
      ),
      shape("Hairline", [33.5, 59.5, 33, 2], {
        shape: "line",
        fill: "#ffffff",
        opacity: 35,
        stroke: 1,
      }),
      countdown([25, 61.5, 50, 3], c, { style: "inline", size: 11, separator: "dot" }, 1),
      c.showSignup && signup([33.5, 66.5, 33, 3], c, "center"),
      social([40, 92, 20, 3], c, "center"),
    ],
  }),
  "24": (c) => ({
    stage: {
      color: "#f4f4f4",
      tone: "dark",
      height: "screen",
      mobileLayout: "stack",
      standalone: true,
    },
    elements: () => [
      logo([1.8, 5.2, 10, 3], c, { color: INK }),
      c.eyebrow && text("Eyebrow", c.eyebrow, [80, 5.8, 18, 3], mono(INK, 10, "right")),
      heading("Headline", c.title.split(" ")[0] ?? c.title, [2.5, 36, 29, 3], sans(INK, 104), 0.5),
      text(
        "Second word",
        c.title.split(" ").slice(1).join(" ") || "soon",
        [68.5, 36, 22, 3],
        italic(RED, 92),
        0.5
      ),
      {
        type: "nativeVideo",
        name: "Window",
        at: [31.7, 17, 35.7, 2],
        phone: 1,
        settings: {
          src: c.video,
          poster: c.poster,
          aspect: "square",
          fit: "cover",
          controls: false,
          autoplay: true,
          loop: true,
          muted: true,
        },
      },
      countdown(
        [30, 73.5, 40, 3],
        c,
        {
          style: "numerals",
          size: 36,
          separator: "none",
          accentUnit: "none",
          color: INK,
        },
        1
      ),
      c.showSignup && signup([33, 82.5, 34, 3], c, "center", INK),
      c.intro &&
        text("Supporting copy", c.intro, [1.8, 91, 20, 3], { fontSize: 13, textColor: INK }),
      social([82, 94, 16, 3], c, "right", INK),
    ],
  }),
  "25": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 45, shade: "left" }),
    elements: () => [
      logo([1.8, 5.2, 10, 3], c),
      c.signature && text("Signature", c.signature, [80, 5.8, 18, 3], mono(undefined, 10, "right")),
      c.eyebrow && text("Eyebrow", c.eyebrow, [3.7, 26, 32, 3], italic(RED_ON_DARK, 24)),
      heading("Headline", c.title, [3.7, 31, 42, 3], sans(undefined, 64)),
      c.intro && text("Supporting copy", c.intro, [3.7, 59, 25, 3], { fontSize: 16 }),
      c.showSignup && signup([3.7, 67, 33.8, 3], c, "left"),
      countdown([62, 24, 29.5, 3], c, { style: "dial", size: 116, accentColor: "#e8102e" }, 0.75),
      social([3.7, 95, 12, 3], c, "left"),
    ],
  }),
  "26": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 55 }),
    elements: () => [
      logo([36.5, 41, 7, 3], c, { size: 26, align: "right" }),
      heading(
        "Headline",
        c.title,
        [45, 41.3, 24, 3],
        {
          ...sans(undefined, 26, "left", "400"),
          letterSpacing: 0.3,
          textTransform: "uppercase",
        },
        0.8
      ),
      countdown([30, 47.8, 40, 3], c, { style: "inline", size: 10, separator: "dot" }, 1),
      c.showSignup && signup([36, 53.5, 28, 3], c, "center"),
      social([40, 92, 20, 3], c, "center"),
    ],
  }),
  "27": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 15 }),
    elements: () => [
      shape("Frosted panel", [62.4, 0, 37.6, 1], {
        shape: "rectangle",
        fill: "#0d0d0d",
        opacity: 55,
        blur: 24,
        height: 2400,
      }),
      logo([65.5, 5.2, 10, 3], c),
      c.eyebrow && text("Eyebrow", c.eyebrow, [65.5, 28, 30, 3], italic(RED_ON_DARK, 22)),
      heading("Headline", c.title, [65.5, 32.5, 30, 3], sans(undefined, 60)),
      c.intro && text("Supporting copy", c.intro, [65.5, 50.5, 30, 3], { fontSize: 15 }),
      countdown(
        [65.5, 59, 30, 3],
        c,
        {
          style: "grid",
          size: 44,
          align: "left",
          accentUnit: "none",
        },
        1
      ),
      c.showSignup && signup([65.5, 84, 30, 3], c, "left"),
      social([65.5, 92, 14, 3], c, "left"),
      c.caption && text("Caption", c.caption, [3.7, 94, 50, 3], mono(undefined, 10)),
    ],
  }),
  "28": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 0, shade: "none" }),
    elements: () => [
      {
        type: "nativeKnockout",
        name: "Knockout headline",
        at: [12, 24, 76, 1],
        phone: 1,
        settings: { text: c.title.toUpperCase(), panel: "light", size: 400, cover: true },
      },
      logo([1.8, 5.2, 10, 3], c, { color: INK }),
      c.eyebrow && text("Eyebrow", c.eyebrow, [1.8, 86, 30, 3], italic(RED, 18)),
      c.intro &&
        text("Supporting copy", c.intro, [1.8, 89.5, 21, 3], { fontSize: 13, textColor: INK }),
      countdown(
        [36.5, 88, 26, 3],
        c,
        {
          style: "numerals",
          size: 30,
          separator: "none",
          accentUnit: "none",
          color: INK,
        },
        1
      ),
      c.showSignup && signup([67.5, 92, 27.8, 3], c, "left", INK),
      social([84, 5.8, 14.2, 3], c, "right", INK),
    ],
  }),
  "29": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 15 }),
    elements: () => [
      shape("Red band", [0, 62, 100, 1], { shape: "rectangle", fill: RED, height: 900 }),
      logo([1.8, 5.2, 10, 3], c),
      c.signature && text("Signature", c.signature, [80, 5.8, 18, 3], mono(undefined, 10, "right")),
      c.eyebrow && text("Eyebrow", c.eyebrow, [3.7, 71, 30, 3], italic(WHITE, 20)),
      heading("Headline", c.title, [3.7, 75, 30, 3], sans(undefined, 48)),
      countdown(
        [39, 77, 26, 3],
        c,
        {
          style: "numerals",
          size: 52,
          separator: "none",
          accentUnit: "none",
        },
        1
      ),
      c.showSignup && signup([67.5, 77, 27.8, 3], c, "left"),
      social([67.5, 85, 12, 3], c, "left"),
    ],
  }),
  "30": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 10 }),
    elements: () => [
      {
        type: "nativeKnockout",
        name: "Knockout monogram",
        at: [10, 6, 80, 1],
        phone: 1,
        settings: { text: "MG", panel: "dark", size: 600, cover: true, align: "center" },
      },
      text("Masthead", c.brand, [1.8, 6, 30, 3], mono(undefined, 10)),
      c.eyebrow && text("Eyebrow", c.eyebrow, [1.8, 81.5, 30, 3], italic(RED_ON_DARK, 18)),
      heading("Headline", c.title, [1.8, 85, 22, 3], sans(undefined, 38)),
      countdown(
        [38.5, 88, 23, 3],
        c,
        {
          style: "numerals",
          size: 34,
          separator: "none",
          accentUnit: "none",
        },
        1
      ),
      c.showSignup && signup([67.5, 90.5, 27.8, 3], c, "left"),
      social([84, 5.8, 14.2, 3], c, "right"),
    ],
  }),
  "31": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 35, shade: "vignette" }),
    elements: () => [
      c.signature && text("Signature", c.signature, [1.8, 6, 20, 3], mono(undefined, 10)),
      logo([41.3, 23, 17.4, 3], c, { variant: "seal", size: 250, align: "center" }, 0.8),
      heading("Headline", c.title, [32.5, 57, 35, 3], italic(RED_ON_DARK, 24, "center"), 1),
      countdown(
        [32.5, 62, 35, 3],
        c,
        {
          style: "numerals",
          size: 46,
          separator: "none",
          accentUnit: "none",
        },
        1
      ),
      c.showSignup && signup([33.5, 74, 33, 3], c, "center"),
      social([84, 5.8, 14.2, 3], c, "right"),
    ],
  }),
  "32": (c) => {
    const [first, ...rest] = c.title.split(/(?<=\.)\s+/);
    return {
      stage: VIDEO_STAGE(c, { scrim: 40, shade: "left" }),
      elements: () => [
        logo([1.8, 5.2, 10, 3], c),
        text("Quotation mark", "“", [1.6, 10, 8, 3], {
          ...italic(RED_ON_DARK, 120),
          lineHeight: 1,
        }),
        heading("Quotation", first, [1.8, 25, 48, 3], { ...italic(WHITE, 62), lineHeight: 1.08 }),
        text(
          "Quotation, continued",
          [rest.join(" "), c.intro].filter(Boolean).join(" "),
          [1.8, 41.5, 48, 3],
          { ...italic(RED_ON_DARK, 62), lineHeight: 1.08 },
          0.55
        ),
        c.signature && text("Signature", c.signature, [1.8, 61, 40, 3], mono(undefined, 10)),
        countdown(
          [1.8, 88, 23, 3],
          c,
          {
            style: "numerals",
            size: 36,
            separator: "none",
            accentUnit: "none",
            align: "left",
          },
          1
        ),
        c.showSignup && signup([61.5, 91.5, 33.8, 3], c, "left"),
        social([84, 5.8, 14.2, 3], c, "right"),
      ],
    };
  },
  "33": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 40 }),
    elements: () => [
      countdown(
        [46, 16, 60, 1],
        c,
        {
          style: "single",
          unit: "seconds",
          outline: true,
          size: 600,
          align: "left",
          labelSize: 10,
        },
        "hide"
      ),
      logo([1.8, 5.2, 10, 3], c),
      c.eyebrow && text("Eyebrow", c.eyebrow, [3.7, 30.5, 30, 3], italic(RED_ON_DARK, 22)),
      heading("Headline", c.title, [3.7, 34.5, 36, 3], sans(undefined, 60)),
      countdown(
        [3.7, 55, 22, 3],
        c,
        {
          style: "numerals",
          size: 34,
          separator: "none",
          accentUnit: "none",
          align: "left",
        },
        1
      ),
      c.showSignup && signup([3.7, 66, 33.8, 3], c, "left"),
      social([84, 5.8, 14.2, 3], c, "right"),
    ],
  }),
  "34": (c) => ({
    stage: VIDEO_STAGE(c, { scrim: 35 }),
    elements: () => [
      logo([1.8, 5.2, 10, 3], c),
      c.eyebrow && text("Eyebrow", c.eyebrow, [1.8, 15, 30, 3], italic(RED_ON_DARK, 22)),
      heading("Headline", c.title, [1.8, 19, 22, 3], sans(undefined, 64)),
      countdown(
        [41.2, 36.7, 16.6, 2],
        c,
        {
          style: "clock",
          size: 126,
          timeZone: "Europe/London",
        },
        0.8
      ),
      c.showSignup && signup([1.8, 91.5, 27.8, 3], c, "left"),
      text("Doors open label", "Doors open", [80, 88.5, 18, 3], mono(undefined, 10, "right")),
      text(
        "Doors open time",
        doorsOpen(c.target, "Soon"),
        [70, 91, 28, 3],
        italic(RED_ON_DARK, 26, "right")
      ),
      social([84, 5.8, 14.2, 3], c, "right"),
    ],
  }),
  "35": (c) => ({
    stage: {
      color: "#f4f4f4",
      tone: "dark",
      height: "screen",
      mobileLayout: "stack",
      standalone: true,
    },
    elements: () => [
      logo([3.6, 5.2, 10, 3], c, { color: INK }),
      text("Eyebrow", c.eyebrow ?? "", [3.6, 24.5, 30, 3], mono(RED, 10)),
      heading("Headline", c.title, [3.6, 28, 30, 3], { ...italic(INK, 96), lineHeight: 0.95 }),
      text("Masthead", c.brand, [3.6, 42.5, 40, 3], {
        ...sans(INK, 22, "left", "700"),
        textTransform: "uppercase",
      }),
      c.intro && text("Supporting copy", c.intro, [3.6, 47.5, 40, 3], italic(INK, 18)),
      shape("Rule above details", [3.6, 52.8, 41.7, 2], {
        shape: "line",
        fill: INK,
        opacity: 30,
        stroke: 1,
      }),
      ...(c.details ?? []).flatMap((d, i) => [
        text(`Detail ${i + 1}`, d.title, [3.6, 54.2 + i * 4, 20, 3], {
          fontSize: 14,
          textColor: INK,
        }),
        d.text &&
          text(`Detail ${i + 1} value`, d.text, [25.3, 54.2 + i * 4, 20, 3], {
            ...sans(INK, 14, "right", "600"),
          }),
      ]),
      shape("Rule below details", [3.6, 58.6, 41.7, 2], {
        shape: "line",
        fill: INK,
        opacity: 30,
        stroke: 1,
      }),
      countdown(
        [3.6, 61, 23, 3],
        c,
        {
          style: "numerals",
          size: 34,
          separator: "none",
          accentUnit: "none",
          align: "left",
          color: INK,
        },
        1
      ),
      c.showSignup && signup([3.6, 69, 41.7, 3], c, "left", INK),
      shape("Plate", [50.4, 10, 41.7, 1], { shape: "rectangle", fill: "#ffffff", height: 608 }),
      {
        type: "nativeVideo",
        name: "Moving image",
        at: [51, 11, 40.5, 2],
        phone: 1,
        settings: {
          src: c.video,
          poster: c.poster,
          aspect: "square",
          fit: "cover",
          controls: false,
          autoplay: true,
          loop: true,
          muted: true,
        },
      },
      c.caption && text("Caption", c.caption, [51.2, 82, 35, 3], italic(INK, 14)),
      social([3.6, 91.5, 12, 3], c, "left", INK),
      c.signature && text("Signature", c.signature, [31, 92, 14.3, 3], mono(INK, 10, "right")),
    ],
  }),
};

export const STAGE_STARTERS = REEL_DESIGNS.map(([id, label]) => ({ id, label }));

/**
 * A fresh Stage tree for one of the fourteen designs. Keys are deterministic
 * (`cs22-0`, `cs22-1`…); callers inserting into an existing tree clone them
 * with new keys, as every pattern insert does.
 */
export function stageStarter(
  id: ReelDesignId,
  overrides: Partial<StarterContent> = {},
  starterCopy = true
): BlockTree {
  const content = starterContent(id, overrides, starterCopy);
  const layout = LAYOUTS[id](content);
  const children = layout
    .elements(content)
    .filter((spec): spec is Spec => Boolean(spec))
    .map((spec, index) => node(id, index, spec));
  return [
    {
      _key: `cs${id}-stage`,
      _type: "stageLayout",
      settings: layout.stage,
      visual: { name: `Coming soon · ${REEL_DESIGNS.find(([d]) => d === id)?.[1]}` },
      children,
    },
  ];
}

/**
 * Converts an existing Coming Soon Studio block on a sizzle-reel design into
 * the editable Stage version, carrying over everything the editor wrote: copy,
 * signup, social links, video, still, caption, launch date and launch message.
 * Returns `null` for designs that are not CS22–CS35.
 */
export function stageFromComingSoon(settings: Record<string, unknown>): BlockTree | null {
  const variant = String(settings.variant ?? "");
  if (!REEL_DESIGNS.some(([id]) => id === variant)) return null;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const reel = (settings.reel ?? {}) as Record<string, unknown>;
  const afterHours = (settings.afterHours ?? {}) as { countdown?: { target?: unknown } };
  const config = reelConfigWithLaunchDate(
    reel as Parameters<typeof reelConfigWithLaunchDate>[0],
    afterHours.countdown?.target
  );
  const links = Array.isArray(settings.socialLinks)
    ? (settings.socialLinks as StarterContent["socialLinks"]).filter(
        (l) => l && typeof l.href === "string"
      )
    : undefined;
  const details = Array.isArray(settings.details)
    ? (settings.details as StarterContent["details"])
    : undefined;
  const tree = stageStarter(
    variant as ReelDesignId,
    {
      title: str(settings.title),
      eyebrow: str(settings.eyebrow),
      intro: str(settings.intro),
      signature: str(settings.signature),
      brand: str(settings.brand),
      buttonLabel: str(settings.buttonLabel),
      ...(typeof settings.showSignup === "boolean" ? { showSignup: settings.showSignup } : {}),
      ...(links && links.length ? { socialLinks: links.map((l) => ({ ...l })) } : {}),
      video: str(config.video),
      poster: str(config.poster),
      caption: str(config.caption),
      target: str(config.countdown?.target),
      message: str(config.countdown?.message),
      placeholder: str(config.placeholder),
      ...(details && details.length ? { details: details.map((d) => ({ ...d })) } : {}),
    },
    false
  );
  return withFonts(tree, (settings.fonts ?? {}) as Record<string, unknown>);
}

/** Which theme role each element's font follows while it is unset. */
const IMPLIED_ROLE: Record<string, Record<string, string>> = {
  nativeHeading: { fontFamily: "heading" },
  nativeText: { fontFamily: "body" },
  nativeCountdown: { font: "heading", labelFont: "label" },
  nativeKnockout: { font: "heading" },
  nativeSignup: { font: "label" },
  nativeSocial: { font: "label" },
  nativeLogo: { font: "label" },
};

/**
 * The legacy block's per-page font roles become each element's own font, so a
 * converted page keeps its typography. An element following a role the page
 * overrode, explicitly (`theme:heading`) or by leaving its font unset, takes
 * the override; a font the starter chose outright is left alone.
 */
function withFonts(tree: BlockTree, fonts: Record<string, unknown>): BlockTree {
  const override = new Map<string, string>();
  for (const role of ["heading", "editorial", "body", "label"]) {
    const value = fonts[role];
    if (typeof value === "string" && isFontValue(value)) override.set(role, value);
  }
  if (override.size === 0) return tree;
  return tree.map((stage) => ({
    ...stage,
    children: stage.children?.map((child) => {
      const settings = { ...(child.settings ?? {}) } as Record<string, unknown>;
      for (const [key, implied] of Object.entries(IMPLIED_ROLE[child._type] ?? {})) {
        const current = settings[key];
        const role =
          current === undefined
            ? implied
            : typeof current === "string" && current.startsWith("theme:")
              ? current.slice(6)
              : undefined;
        if (role && override.has(role)) settings[key] = override.get(role);
      }
      return { ...child, settings };
    }),
  }));
}
