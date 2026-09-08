import { FONT_LIBRARY } from "@/lib/domain/fontLibrary";
import { field, fieldSetToZod, options, type FieldSet } from "./fields";

export const STUDIO_WIDGET_KINDS = ["countdown", "signup", "social"] as const;
export type StudioWidgetKind = (typeof STUDIO_WIDGET_KINDS)[number];
export const CLOCK_UNITS = ["months", "weeks", "days", "hours", "minutes", "seconds"] as const;
export type ClockUnit = (typeof CLOCK_UNITS)[number];
export interface WidgetTypography {
  font?: string;
  size?: number;
  weight?: number;
  color?: string;
  tracking?: number;
  leading?: number;
  align?: "left" | "center" | "right";
  italic?: boolean;
  underline?: boolean;
  gap?: number;
  case?: "none" | "uppercase" | "lowercase" | "capitalize";
  visible?: boolean;
}
export interface CountdownWidget {
  target: string;
  variant?: "Minimal" | "Divided" | "Cards";
  unitMode?: "days" | "weeks" | "months";
  showSeconds?: boolean;
  endText?: string;
  labels?: Partial<Record<ClockUnit, string>>;
  numberStyle?: WidgetTypography;
  labelStyle?: WidgetTypography;
}
export interface SignupWidget {
  variant?: "Underline" | "Boxed";
  placeholder?: string;
  buttonMode?: "Arrow" | "Label";
  successText?: string;
}
export interface SocialWidget {
  variant?: "Labels" | "Outlined" | "Icons";
  links: { label: string; platform: string; url: string }[];
}
const numberStyle: FieldSet = {
  font: field.font({ label: "Font" }),
  size: field.number({ label: "Size", min: 8, max: 240 }),
  weight: field.number({ label: "Weight", min: 100, max: 900 }),
  color: field.text({ label: "Color" }),
  tracking: field.number({ label: "Letter spacing", min: -20, max: 100 }),
  leading: field.number({ label: "Line height", min: 0.5, max: 4 }),
  align: field.select({ label: "Alignment", options: options("left", "center", "right") }),
  italic: field.boolean({ label: "Italic" }),
  underline: field.boolean({ label: "Underline" }),
};
export const studioWidgetFields: Record<StudioWidgetKind, FieldSet> = {
  countdown: {
    target: field.text({ label: "Target date and time", required: true }),
    variant: field.select({ label: "Appearance", options: options("Minimal", "Divided", "Cards") }),
    unitMode: field.select({ label: "Units", options: options("days", "weeks", "months") }),
    showSeconds: field.boolean({ label: "Show seconds" }),
    endText: field.text({ label: "End message" }),
    labels: field.group({
      label: "Unit labels",
      fields: Object.fromEntries(CLOCK_UNITS.map((unit) => [unit, field.text({ label: unit })])),
    }),
    numberStyle: field.group({ label: "Numbers", fields: numberStyle }),
    labelStyle: field.group({
      label: "Unit typography",
      fields: {
        ...numberStyle,
        gap: field.number({ label: "Space below numbers", min: 0, max: 64 }),
        case: field.select({
          label: "Case",
          options: options("none", "uppercase", "lowercase", "capitalize"),
        }),
        visible: field.boolean({ label: "Show labels" }),
      },
    }),
  },
  signup: {
    variant: field.select({ label: "Appearance", options: options("Underline", "Boxed") }),
    placeholder: field.text({ label: "Email placeholder" }),
    buttonMode: field.select({ label: "Submit button", options: options("Arrow", "Label") }),
    successText: field.text({ label: "Confirmation message" }),
  },
  social: {
    variant: field.select({ label: "Appearance", options: options("Labels", "Outlined", "Icons") }),
    links: field.list({
      label: "Social links",
      required: true,
      min: 1,
      max: 6,
      of: {
        label: field.text({ label: "Label", required: true }),
        platform: field.select({
          label: "Platform",
          required: true,
          options: options("Instagram", "LinkedIn", "YouTube", "Facebook", "Website"),
        }),
        url: field.url({ label: "URL" }),
      },
    }),
  },
};
const schemas = Object.fromEntries(
  STUDIO_WIDGET_KINDS.map((kind) => [kind, fieldSetToZod(studioWidgetFields[kind], true)])
);
export function isStudioWidgetKind(value: string): value is StudioWidgetKind {
  return (STUDIO_WIDGET_KINDS as readonly string[]).includes(value);
}
export function socialDestination(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value) || /[\s\\<>]/.test(value)) return;
  try {
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? value : undefined;
  } catch {
    return;
  }
}
export function normalizeStudioWidget(kind: StudioWidgetKind, raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { issues: ["Open this widget's settings and configure it before publishing."] };
  const config = structuredClone(raw) as Record<string, unknown>;
  // Studio stores font labels; manifests and public rendering use canonical library values.
  for (const role of ["numberStyle", "labelStyle"]) {
    const style = config[role] as WidgetTypography | undefined;
    if (style && typeof style === "object" && typeof style.font === "string") {
      style.font =
        FONT_LIBRARY.find((font) => font.label === style.font || font.value === style.font)
          ?.value || style.font;
    }
  }
  const parsed = schemas[kind].safeParse(config);
  if (!parsed.success)
    return {
      issues: parsed.error.issues.map(
        (issue) => `${kind}.${issue.path.join(".")}: ${issue.message}`
      ),
    };
  const value = parsed.data;
  const issues: string[] = [];
  if (kind === "countdown") {
    if (
      typeof value.target !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value.target) ||
      !Number.isFinite(Date.parse(value.target))
    )
      issues.push("Choose a valid countdown target date and time in widget settings.");
    for (const role of ["numberStyle", "labelStyle"]) {
      const style = value[role] as WidgetTypography | undefined;
      if (
        style?.color &&
        !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(style.color) &&
        style.color !== "transparent"
      )
        issues.push(`Choose a supported ${role === "numberStyle" ? "number" : "label"} color.`);
    }
  }
  if (kind === "social") {
    for (const link of value.links as SocialWidget["links"]) {
      if (!socialDestination(link.url))
        issues.push(
          `Add a full http:// or https:// destination for ${link.label || link.platform} in Social link settings.`
        );
    }
  }
  return { value, issues };
}
export function countdownUnits(
  settings: Pick<CountdownWidget, "unitMode" | "showSeconds">
): ClockUnit[] {
  return [
    ...(settings.unitMode === "months"
      ? (["months", "weeks"] as const)
      : settings.unitMode === "weeks"
        ? (["weeks"] as const)
        : []),
    "days",
    "hours",
    "minutes",
    ...(settings.showSeconds === false ? [] : (["seconds"] as const)),
  ];
}
/** Same calendar-month clamping and rounded remaining seconds as the Studio. */
export function countdownParts(
  target: string,
  now: number,
  mode: CountdownWidget["unitMode"] = "days"
) {
  const end = Date.parse(target);
  if (!Number.isFinite(end)) return null;
  let start = now,
    months = 0;
  const expired = end <= now;
  if (mode === "months" && !expired) {
    const from = new Date(now),
      to = new Date(end);
    months = Math.max(
      0,
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth()
    );
    const advance = (count: number) => {
      const date = new Date(now),
        day = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + count);
      const last = new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
      ).getUTCDate();
      date.setUTCDate(Math.min(day, last));
      return +date;
    };
    if (advance(months) > end) months--;
    start = advance(months);
  }
  const seconds = Math.max(0, Math.ceil((end - start) / 1000)),
    totalDays = Math.floor(seconds / 86400);
  return {
    expired,
    months,
    weeks: mode === "days" ? 0 : Math.floor(totalDays / 7),
    days: mode === "days" ? totalDays : totalDays % 7,
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
