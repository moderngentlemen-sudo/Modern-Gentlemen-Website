import { defineBlock } from "../defineBlock";
import { field } from "../fields";

const ALIGN_OPTIONS = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
] as const;

const MAX_WIDTH_OPTIONS = [
  { value: "none", label: "No limit" },
  { value: "reading", label: "Reading width — 760px" },
  { value: "content", label: "Site content width" },
] as const;

export const nativeHeading = defineBlock({
  type: "nativeHeading",
  label: "Heading",
  category: "layout",
  description: "A semantic heading with independent type, scale, alignment and width controls.",
  fields: {
    text: field.textarea({ label: "Text", required: true }),
    level: field.select({
      label: "Semantic level",
      default: "h2",
      options: ["h1", "h2", "h3", "h4", "h5", "h6"].map((value) => ({
        value,
        label: value.toUpperCase(),
      })),
    }),
    size: field.select({
      label: "Visual size",
      default: "large",
      options: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
        { value: "display", label: "Display" },
      ],
    }),
    font: field.select({
      label: "Font role",
      default: "heading",
      options: [
        { value: "heading", label: "Heading" },
        { value: "editorial", label: "Editorial serif" },
        { value: "label", label: "Label mono" },
        { value: "navigation", label: "Navigation" },
      ],
    }),
    weight: field.select({
      label: "Weight",
      default: "medium",
      options: [
        { value: "light", label: "Light" },
        { value: "regular", label: "Regular" },
        { value: "medium", label: "Medium" },
        { value: "bold", label: "Bold" },
      ],
    }),
    align: field.select({ label: "Alignment", default: "start", options: ALIGN_OPTIONS }),
    maxWidth: field.select({
      label: "Maximum width",
      default: "none",
      options: MAX_WIDTH_OPTIONS,
    }),
  },
  insertDefaults: { text: "A considered heading" },
});

export const nativeText = defineBlock({
  type: "nativeText",
  label: "Text",
  category: "layout",
  description: "A free text element for body copy, introductions, small print or labels.",
  fields: {
    content: field.richText({
      label: "Content",
      required: true,
      help: "Format headings, emphasis, links, quotations and lists without leaving the builder.",
    }),
    style: field.select({
      label: "Text style",
      default: "body",
      options: [
        { value: "lead", label: "Lead" },
        { value: "body", label: "Body" },
        { value: "small", label: "Small" },
        { value: "label", label: "Label" },
      ],
    }),
    align: field.select({ label: "Alignment", default: "start", options: ALIGN_OPTIONS }),
    maxWidth: field.select({
      label: "Maximum width",
      default: "reading",
      options: MAX_WIDTH_OPTIONS,
    }),
  },
  insertDefaults: { content: "Write with clarity and purpose." },
});

export const nativeImage = defineBlock({
  type: "nativeImage",
  label: "Image",
  category: "layout",
  description: "A media-library image with alt text, caption, crop ratio and focal position.",
  fields: {
    src: field.image({ label: "Image", required: true }),
    alt: field.text({ label: "Alternative text", help: "Leave blank only when decorative." }),
    caption: field.text({ label: "Caption" }),
    aspect: field.select({
      label: "Aspect ratio",
      default: "auto",
      options: [
        { value: "auto", label: "Original" },
        { value: "square", label: "Square — 1:1" },
        { value: "portrait", label: "Portrait — 3:4" },
        { value: "landscape", label: "Landscape — 4:3" },
        { value: "wide", label: "Wide — 16:9" },
      ],
    }),
    fit: field.select({
      label: "Image fit",
      default: "cover",
      options: [
        { value: "cover", label: "Cover" },
        { value: "contain", label: "Contain" },
      ],
    }),
    position: field.select({
      label: "Focal position",
      default: "center",
      options: [
        { value: "top", label: "Top" },
        { value: "center", label: "Center" },
        { value: "bottom", label: "Bottom" },
      ],
    }),
  },
  insertDefaults: { src: "/images/hero-cover.jpg", alt: "Modern Gentlemen editorial" },
});

export const nativeButton = defineBlock({
  type: "nativeButton",
  label: "Button",
  category: "layout",
  description: "A linked call to action with bounded visual and accessibility settings.",
  fields: {
    label: field.text({ label: "Label", required: true }),
    href: field.url({ label: "Destination", required: true }),
    variant: field.select({
      label: "Style",
      default: "solid",
      options: [
        { value: "solid", label: "Solid" },
        { value: "outline", label: "Outline" },
        { value: "text", label: "Text link" },
      ],
    }),
    size: field.select({
      label: "Size",
      default: "medium",
      options: [
        { value: "small", label: "Small" },
        { value: "medium", label: "Medium" },
        { value: "large", label: "Large" },
      ],
    }),
    align: field.select({ label: "Alignment", default: "start", options: ALIGN_OPTIONS }),
    newTab: field.boolean({
      label: "Open in a new tab",
      default: false,
      help: "Use for external destinations only.",
    }),
  },
  insertDefaults: { label: "Discover more", href: "/" },
});

export const nativeDivider = defineBlock({
  type: "nativeDivider",
  label: "Divider",
  category: "layout",
  description: "A horizontal rule with style, weight and width controls.",
  fields: {
    lineStyle: field.select({
      label: "Line style",
      default: "solid",
      options: [
        { value: "solid", label: "Solid" },
        { value: "dashed", label: "Dashed" },
        { value: "dotted", label: "Dotted" },
      ],
    }),
    weight: field.select({
      label: "Weight",
      default: "hairline",
      options: [
        { value: "hairline", label: "Hairline" },
        { value: "regular", label: "Regular" },
        { value: "strong", label: "Strong" },
      ],
    }),
    width: field.select({
      label: "Width",
      default: "full",
      options: [
        { value: "full", label: "Full" },
        { value: "reading", label: "Reading width" },
        { value: "half", label: "Half" },
      ],
    }),
  },
});

export const nativeSpacer = defineBlock({
  type: "nativeSpacer",
  label: "Spacer",
  category: "layout",
  description: "Intentional responsive whitespace with an independent height at each device size.",
  fields: {
    desktop: field.number({
      label: "Desktop height",
      default: 64,
      min: 0,
      max: 320,
      integer: true,
    }),
    tablet: field.number({ label: "Tablet height", default: 48, min: 0, max: 320, integer: true }),
    mobile: field.number({ label: "Mobile height", default: 32, min: 0, max: 320, integer: true }),
  },
});
