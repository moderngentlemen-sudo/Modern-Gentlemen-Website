import { field } from "./fields";

export const AFTER_HOURS_PHOTO =
  "https://qnfoztnyxhubnnulpfwt.supabase.co/storage/v1/object/public/media/2026/09/222f0f4c-cs05-wet-night-street.png";
export const AFTER_HOURS_DEFAULTS = {
  layout: {
    standalone: true,
    align: "center",
    position: "bottom",
    width: 680,
    padding: 48,
    mobilePadding: 24,
    bottom: 48,
    mobileBottom: 32,
    gap: 28,
    minHeight: 100,
  },
  background: {
    overlay: 30,
    grayscale: 100,
    focalX: 50,
    focalY: 50,
    mobileFocalX: 50,
    mobileFocalY: 50,
    color: "#080808",
  },
  logo: {
    show: true,
    image: "/mg-logo.svg",
    alt: "Modern Gentlemen",
    href: "/",
    width: 56,
    mobileWidth: 48,
  },
  type: {
    headingFont: "serif",
    headingSize: 88,
    mobileHeadingSize: 56,
    headingWeight: 400,
    headingTracking: -2,
    textSize: 16,
    labelFont: "mono",
    color: "#f4f4f4",
  },
  divider: { show: true, color: "#C8102E", width: 80, thickness: 2 },
  countdown: {
    show: true,
    target: "",
    seconds: true,
    separators: true,
    size: 38,
    mobileSize: 28,
    width: 420,
    font: "serif",
    days: "Days",
    hours: "Hours",
    minutes: "Minutes",
    secondsLabel: "Seconds",
    expired: "hide",
    message: "",
  },
  signup: {
    placeholder: "Your email address",
    accessibleLabel: "Email address",
    submitLabel: "Subscribe",
    style: "underline",
    width: 420,
    thickness: 1,
    opacity: 35,
    arrowWidth: 1,
    privacy: "",
  },
  social: { show: true, style: "icons", separators: true, size: 22, gap: 24 },
  about: {
    show: true,
    label: "About",
    title: "Excellence is worth pursuing.",
    text: "A lifestyle guide for the modern man.",
    closeLabel: "Close about",
    width: 480,
    color: "#131315",
  },
};
export type AfterHoursConfig = {
  [K in keyof typeof AFTER_HOURS_DEFAULTS]?: Partial<(typeof AFTER_HOURS_DEFAULTS)[K]>;
};

const number = (label: string, value: number, min: number, max: number) =>
  field.number({ label, default: value, min, max });
const choice = (label: string, value: string, values: string[]) =>
  field.select({
    label,
    default: value,
    options: values.map((value) => ({ value, label: value })),
  });
const color = (label: string, value: string) =>
  field.text({
    label,
    default: value,
    help: "Hex color, e.g. #f4f4f4. Invalid colors use the design default.",
  });
const font = (label: string, value: string) =>
  choice(label, value, ["serif", "sans", "mono", "navigation"]);
export const afterHoursFields = field.group({
  label: "After Hours — refined design controls (CS21)",
  fields: {
    layout: field.group({
      label: "Layout & responsive spacing",
      fields: {
        standalone: field.boolean({
          label: "Use standalone page (hide site header/footer)",
          default: true,
        }),
        align: choice("Content alignment", "center", ["left", "center", "right"]),
        position: choice("Vertical position", "bottom", ["top", "center", "bottom"]),
        width: number("Content maximum width (px)", 680, 240, 1600),
        padding: number("Desktop page inset (px)", 48, 16, 160),
        mobilePadding: number("Mobile page inset (px)", 24, 16, 80),
        bottom: number("Desktop bottom inset (px)", 48, 16, 240),
        mobileBottom: number("Mobile bottom inset (px)", 32, 16, 160),
        gap: number("Element spacing (px)", 28, 8, 100),
        minHeight: number("Minimum viewport height (%)", 100, 50, 200),
      },
    }),
    background: field.group({
      label: "Photograph & scrim",
      fields: {
        overlay: number("Dark overlay (%)", 30, 0, 95),
        grayscale: number("Monochrome (%)", 100, 0, 100),
        focalX: number("Desktop focal point X (%)", 50, 0, 100),
        focalY: number("Desktop focal point Y (%)", 50, 0, 100),
        mobileFocalX: number("Mobile focal point X (%)", 50, 0, 100),
        mobileFocalY: number("Mobile focal point Y (%)", 50, 0, 100),
        color: color("Background color", "#080808"),
      },
    }),
    logo: field.group({
      label: "Logo",
      fields: {
        show: field.boolean({ label: "Show logo", default: true }),
        image: field.image({ label: "Logo artwork", default: "/mg-logo.svg" }),
        alt: field.text({ label: "Logo description", default: "Modern Gentlemen" }),
        href: field.url({ label: "Logo destination", default: "/" }),
        width: number("Desktop logo width (px)", 56, 20, 300),
        mobileWidth: number("Mobile logo width (px)", 48, 20, 200),
      },
    }),
    type: field.group({
      label: "Typography",
      fields: {
        headingFont: font("Heading family", "serif"),
        headingSize: number("Desktop heading (px)", 88, 24, 180),
        mobileHeadingSize: number("Mobile heading (px)", 56, 24, 100),
        headingWeight: number("Heading weight", 400, 300, 700),
        headingTracking: number("Heading tracking (px)", -2, -4, 12),
        textSize: number("Body text (px)", 16, 16, 28),
        labelFont: font("Label family", "mono"),
        color: color("Text color", "#f4f4f4"),
      },
    }),
    divider: field.group({
      label: "Accent divider",
      fields: {
        show: field.boolean({ label: "Show accent divider", default: true }),
        color: color("Accent color", "#C8102E"),
        width: number("Width (px)", 80, 16, 240),
        thickness: number("Thickness (px)", 2, 0.5, 8),
      },
    }),
    countdown: field.group({
      label: "Live countdown",
      fields: {
        show: field.boolean({ label: "Enable countdown", default: true }),
        target: field.text({
          label: "Launch date & time with timezone",
          default: "",
          help: "ISO date with timezone, e.g. 2027-01-15T18:00:00-05:00. Leave blank to hide; no date is invented. Invalid dates also hide the timer.",
        }),
        seconds: field.boolean({ label: "Show seconds", default: true }),
        separators: field.boolean({ label: "Show fine dividers", default: true }),
        size: number("Desktop numeral size (px)", 38, 18, 80),
        mobileSize: number("Mobile numeral size (px)", 28, 18, 48),
        width: number("Countdown width (px)", 420, 240, 900),
        font: font("Numeral family", "serif"),
        days: field.text({ label: "Days label", default: "Days" }),
        hours: field.text({ label: "Hours label", default: "Hours" }),
        minutes: field.text({ label: "Minutes label", default: "Minutes" }),
        secondsLabel: field.text({ label: "Seconds label", default: "Seconds" }),
        expired: choice("At launch time", "hide", ["hide", "message", "zero"]),
        message: field.text({ label: "At-launch message", default: "" }),
      },
    }),
    signup: field.group({
      label: "Email field (enable Show newsletter signup above)",
      fields: {
        placeholder: field.text({ label: "Placeholder", default: "Your email address" }),
        accessibleLabel: field.text({
          label: "Accessible email label",
          required: true,
          default: "Email address",
        }),
        submitLabel: field.text({
          label: "Accessible submit label",
          required: true,
          default: "Subscribe",
        }),
        style: choice("Field treatment", "underline", ["underline", "outline"]),
        width: number("Field width (px)", 420, 240, 900),
        thickness: number("Line thickness (px)", 1, 0.5, 4),
        opacity: number("Line opacity (%)", 35, 10, 100),
        arrowWidth: number("Arrow stroke", 1, 0.5, 3),
        privacy: field.text({ label: "Optional consent / privacy copy", default: "" }),
      },
    }),
    social: field.group({
      label: "Social presentation",
      fields: {
        show: field.boolean({ label: "Show configured social links", default: true }),
        style: choice("Link style", "icons", ["icons", "text", "both"]),
        separators: field.boolean({ label: "Show separators", default: true }),
        size: number("Icon size (px)", 22, 16, 40),
        gap: number("Gap (px)", 24, 8, 64),
      },
    }),
    about: field.group({
      label: "About overlay",
      fields: {
        show: field.boolean({ label: "Show About control", default: true }),
        label: field.text({ label: "Control label", required: true, default: "About" }),
        title: field.text({ label: "About heading", default: "Excellence is worth pursuing." }),
        text: field.textarea({
          label: "About copy",
          default: "A lifestyle guide for the modern man.",
        }),
        closeLabel: field.text({ label: "Close label", required: true, default: "Close about" }),
        width: number("Panel width (px)", 480, 280, 800),
        color: color("Panel background", "#131315"),
      },
    }),
  },
});

/** Timezone is mandatory so every viewer counts down to the same instant. */
export function countdownParts(target: string, now: number): number[] | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(target)) return null;
  const end = Date.parse(target);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return null;
  const date = target.slice(0, 10);
  if (new Date(date).toISOString().slice(0, 10) !== date) return null;
  const seconds = Math.max(0, Math.ceil((end - now) / 1000));
  return [
    Math.floor(seconds / 86400),
    Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ];
}
export function safeAfterHoursColor(value: string, fallback: string) {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? value : fallback;
}
