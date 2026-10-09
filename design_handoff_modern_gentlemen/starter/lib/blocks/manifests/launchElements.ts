import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Elements for launch and coming-soon layouts, transcribed from
 * `components/elements/LaunchElements.tsx`.
 *
 * They are ordinary blocks: they work anywhere, but they were designed for the
 * Stage, where each one can be dragged, resized and scaled. Every manifest
 * lists its fields most-used first, because the inspector shows them in this
 * order: what the element says or counts to, then how it looks, then fine
 * detail.
 */

const ALIGN = ["left", "center", "right"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));
const UNITS = ["days", "hours", "minutes", "seconds"] as const;
const TIME_ZONES = [
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export const nativeCountdown = defineBlock({
  type: "nativeCountdown",
  label: "Countdown",
  category: "layout",
  description:
    "A live countdown to a launch date: big numerals, one line, a grid, a dial, a clock face or a single giant unit.",
  fields: {
    target: field.text({
      label: "Launch date & time",
      default: "",
      help: "With a timezone, e.g. 2027-01-15T18:00:00-05:00 or 2026-12-01T09:00:00Z. Until a valid date is set the countdown shows dashes; no date is invented.",
    }),
    message: field.text({
      label: "Message at launch time",
      default: "We are open.",
      help: "Replaces the countdown when it reaches zero. Leave empty to show zeros.",
    }),
    style: field.select({
      label: "Style",
      default: "numerals",
      options: [
        { value: "numerals", label: "Numerals" },
        { value: "inline", label: "One line" },
        { value: "grid", label: "Grid of four" },
        { value: "dial", label: "Dial" },
        { value: "clock", label: "Clock face" },
        { value: "single", label: "One giant unit" },
      ],
    }),
    size: field.number({
      label: "Number size (px)",
      default: 96,
      min: 10,
      max: 600,
      integer: true,
      help: "At the stage's design width; it scales with the screen and with the element.",
    }),
    color: field.color({ label: "Number colour" }),
    accentColor: field.color({ label: "Accent colour", default: "#c8102e" }),
    tick: field.select({
      label: "When a number changes",
      default: "none",
      options: [
        { value: "none", label: "Just change" },
        { value: "fade", label: "Fade in" },
        { value: "rise", label: "Rise in" },
        { value: "flip", label: "Flip over" },
      ],
      help: "Still for visitors who ask for reduced motion.",
    }),
    accentUnit: field.select({
      label: "Accent unit",
      default: "seconds",
      options: [{ value: "none", label: "None" }, ...UNITS.map((u) => ({ value: u, label: u }))],
    }),
    align: field.select({ label: "Alignment", default: "center", options: ALIGN }),
    font: field.font({ label: "Number font", default: "theme:heading" }),
    separator: field.select({
      label: "Between units",
      default: "colon",
      options: [
        { value: "colon", label: "Colon" },
        { value: "dot", label: "Dot" },
        { value: "none", label: "Nothing" },
      ],
    }),
    units: field.group({
      label: "Units shown",
      fields: Object.fromEntries(
        UNITS.map((u) => [u, field.boolean({ label: `Show ${u}`, default: true })])
      ),
    }),
    labels: field.group({
      label: "Unit labels",
      fields: Object.fromEntries(
        UNITS.map((u) => [u, field.text({ label: u, default: u[0].toUpperCase() + u.slice(1) })])
      ),
    }),
    labelFont: field.font({ label: "Label font", default: "theme:label" }),
    labelSize: field.number({ label: "Label size (px)", default: 10, min: 6, max: 60 }),
    labelColor: field.color({ label: "Label colour" }),
    unit: field.select({
      label: "Giant unit",
      default: "seconds",
      options: UNITS.map((u) => ({ value: u, label: u })),
      help: "Used by the One giant unit style.",
    }),
    outline: field.boolean({
      label: "Outlined numerals",
      default: true,
      help: "Used by the One giant unit style.",
    }),
    timeZone: field.select({
      label: "Clock time zone",
      default: "Europe/London",
      options: TIME_ZONES.map((value) => ({ value, label: value.replace(/_/g, " ") })),
      help: "The Clock face style's hands show the current time here.",
    }),
  },
});

export const nativeSignup = defineBlock({
  type: "nativeSignup",
  label: "Email signup",
  category: "layout",
  description:
    "An email field that joins the newsletter, as a fine underline, a box or a pill. Submissions use the site's newsletter connection.",
  fields: {
    buttonLabel: field.text({ label: "Button label", default: "Notify me", required: true }),
    placeholder: field.text({ label: "Placeholder", default: "Your email address" }),
    style: field.select({
      label: "Style",
      default: "underline",
      options: [
        { value: "underline", label: "Fine underline" },
        { value: "boxed", label: "Box with a solid button" },
        { value: "pill", label: "Pill" },
      ],
    }),
    color: field.color({ label: "Text and line colour" }),
    accentColor: field.color({ label: "Button colour", default: "#c8102e" }),
    font: field.font({
      label: "Font",
      help: "For the field and the button. Leave unset to follow the theme's label font.",
    }),
    align: field.select({ label: "Alignment", default: "center", options: ALIGN }),
    consent: field.text({
      label: "Consent note",
      help: "Optional small print under the field, e.g. how often you will email.",
    }),
    accessibleLabel: field.text({
      label: "Field name for screen readers",
      default: "Email address",
      required: true,
    }),
  },
});

export const nativeSocial = defineBlock({
  type: "nativeSocial",
  label: "Social links",
  category: "layout",
  description: "Icons or names linking to the brand's profiles.",
  fields: {
    links: field.list({
      label: "Profiles",
      itemLabel: "profile",
      max: 8,
      of: {
        network: field.select({
          label: "Network",
          default: "instagram",
          options: ["instagram", "x", "youtube", "tiktok", "linkedin"].map((value) => ({
            value,
            label: value,
          })),
        }),
        href: field.url({ label: "Profile URL", required: true }),
        label: field.text({ label: "Name for screen readers", required: true }),
      },
    }),
    style: field.select({
      label: "Show as",
      default: "icons",
      options: [
        { value: "icons", label: "Icons" },
        { value: "text", label: "Names" },
        { value: "both", label: "Icons and names" },
      ],
    }),
    size: field.number({ label: "Icon size (px)", default: 22, min: 10, max: 120 }),
    gap: field.number({ label: "Spacing (px)", default: 24, min: 0, max: 160 }),
    color: field.color({ label: "Colour" }),
    font: field.font({
      label: "Font",
      help: "For profile names. Leave unset to follow the theme's label font.",
    }),
    align: field.select({ label: "Alignment", default: "center", options: ALIGN }),
  },
  insertDefaults: {
    links: [
      { network: "instagram", label: "Instagram", href: "https://instagram.com" },
      { network: "x", label: "X", href: "https://x.com" },
      { network: "youtube", label: "YouTube", href: "https://youtube.com" },
    ],
  },
});

export const nativeLogo = defineBlock({
  type: "nativeLogo",
  label: "Logo",
  category: "layout",
  description: "The MG mark: with the red bar, on its own, or inside a turning seal of text.",
  fields: {
    variant: field.select({
      label: "Style",
      default: "wordmark",
      options: [
        { value: "wordmark", label: "MG with the red bar" },
        { value: "monogram", label: "MG only" },
        { value: "seal", label: "Seal with text around it" },
      ],
    }),
    size: field.number({ label: "Height (px)", default: 32, min: 8, max: 600 }),
    label: field.text({
      label: "Name for screen readers",
      default: "Modern Gentlemen",
      required: true,
    }),
    href: field.url({ label: "Link", help: "Optional: where the logo goes when clicked." }),
    color: field.color({ label: "Colour" }),
    accentColor: field.color({ label: "Bar colour", default: "#c8102e" }),
    sealText: field.text({
      label: "Seal text",
      default: "MODERN GENTLEMEN · COMING SOON · ",
      help: "Runs around the seal style.",
    }),
    font: field.font({
      label: "Seal text font",
      help: "Leave unset to follow the theme's label font.",
    }),
    align: field.select({ label: "Alignment", default: "left", options: ALIGN }),
  },
});

export const nativeKnockout = defineBlock({
  type: "nativeKnockout",
  label: "Knockout text",
  category: "layout",
  description:
    "Giant letters cut out of a solid panel, so the stage's video or photograph shows through them.",
  fields: {
    text: field.text({ label: "Text", default: "SOON", required: true }),
    panel: field.select({
      label: "Panel",
      default: "light",
      options: [
        { value: "light", label: "Light panel" },
        { value: "dark", label: "Dark panel" },
      ],
    }),
    panelColor: field.color({
      label: "Panel colour",
      help: "Optional; replaces the light or dark preset. The letters stay cut out either way. Pale colours lighten the video and deep colours darken it, so white or black give a solid panel and anything between gives a tinted one.",
    }),
    panelOpacity: field.number({
      label: "Panel opacity (%)",
      default: 100,
      min: 0,
      max: 100,
      integer: true,
      help: "Lower it to let the video show faintly through the panel as well as the letters.",
    }),
    size: field.number({ label: "Letter size (px)", default: 320, min: 20, max: 1200 }),
    cover: field.boolean({
      label: "Panel covers the whole stage",
      default: true,
      help: "Off: the panel is only as large as the letters.",
    }),
    font: field.font({ label: "Font", default: "theme:heading" }),
    weight: field.select({
      label: "Weight",
      default: "700",
      options: ["300", "400", "500", "600", "700", "800", "900"].map((value) => ({
        value,
        label: value,
      })),
    }),
    letterSpacing: field.number({
      label: "Letter spacing (em)",
      default: -0.04,
      min: -0.2,
      max: 1,
    }),
    align: field.select({ label: "Alignment", default: "center", options: ALIGN }),
  },
});

export const nativeShape = defineBlock({
  type: "nativeShape",
  label: "Shape",
  category: "layout",
  description:
    "A panel, band, circle, ring or line: solid, translucent or frosted glass. Decorative.",
  fields: {
    shape: field.select({
      label: "Shape",
      default: "rectangle",
      options: [
        { value: "rectangle", label: "Rectangle or band" },
        { value: "circle", label: "Circle" },
        { value: "ring", label: "Ring" },
        { value: "line", label: "Line" },
      ],
    }),
    fill: field.color({ label: "Colour", default: "#c8102e" }),
    fillOpacity: field.number({
      label: "Colour opacity (%)",
      default: 100,
      min: 0,
      max: 100,
      integer: true,
      help: "How solid the colour is. Below 100 the colour turns translucent while the blur and outline stay full strength — the usual way to build frosted glass.",
    }),
    opacity: field.number({
      label: "Overall opacity (%)",
      default: 100,
      min: 0,
      max: 100,
      integer: true,
      help: "Fades the whole shape, blur and outline included.",
    }),
    blur: field.number({
      label: "Frosted glass blur (px)",
      default: 0,
      min: 0,
      max: 80,
      help: "Blurs whatever is behind the shape. Pair with a lower colour opacity.",
    }),
    saturation: field.number({
      label: "Frosted glass saturation (%)",
      default: 100,
      min: 0,
      max: 300,
      integer: true,
      help: "Of what shows through the shape: 0 is greyscale, above 100 is richer.",
    }),
    height: field.number({
      label: "Height (px)",
      default: 200,
      min: 1,
      max: 4000,
      help: "At the stage's design width; circles and rings use the width instead.",
    }),
    radius: field.number({ label: "Corner radius (px)", default: 0, min: 0, max: 2000 }),
    fill2: field.color({
      label: "Gradient to colour",
      help: "Optional; fades from the colour above to this one.",
    }),
    gradientAngle: field.number({
      label: "Gradient direction (°)",
      default: 180,
      min: 0,
      max: 360,
      integer: true,
      help: "180 runs top to bottom, 90 left to right.",
    }),
    fill2Opacity: field.number({
      label: "Gradient end opacity (%)",
      default: 100,
      min: 0,
      max: 100,
      integer: true,
      help: "Set to 0 for a colour that fades away.",
    }),
    borderColor: field.color({
      label: "Outline colour",
      help: "Optional outline for rectangles and circles; the ring uses its own colour.",
    }),
    stroke: field.number({ label: "Ring or outline width (px)", default: 2, min: 0, max: 80 }),
    shadow: field.select({
      label: "Shadow",
      default: "none",
      options: [
        { value: "none", label: "None" },
        { value: "soft", label: "Soft" },
        { value: "strong", label: "Strong" },
      ],
    }),
    sheen: field.boolean({
      label: "Light sweep",
      default: false,
      help: "A slow band of light crosses the panel every few seconds. Still for visitors who ask for reduced motion.",
    }),
    blend: field.select({
      label: "Blend with the background",
      default: "normal",
      options: [
        { value: "normal", label: "Normal" },
        { value: "multiply", label: "Multiply (darkens)" },
        { value: "screen", label: "Screen (lightens)" },
        { value: "overlay", label: "Overlay (contrast)" },
        { value: "soft-light", label: "Soft light" },
        { value: "color", label: "Colour (tints)" },
      ],
    }),
  },
});
