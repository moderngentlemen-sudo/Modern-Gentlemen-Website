import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import { WIDGET_DESIGNS } from "../widgets";
export const widgetStudio = defineBlock({
  type: "widgetStudio",
  label: "Widget studio",
  category: "widgets",
  description:
    "Countdown, signup, social links, accordion, tabs, figures, progress and quotations in one customizable studio.",
  fields: {
    variant: field.select({
      label: "Widget",
      default: "countdown",
      options: WIDGET_DESIGNS.map((w) => ({ value: w.id, label: w.label })),
    }),
    title: field.text({ label: "Heading" }),
    text: field.textarea({ label: "Supporting text / quotation" }),
    align: field.select({
      label: "Alignment",
      default: "center",
      options: ["left", "center", "right"].map((value) => ({ value, label: value })),
    }),
    treatment: field.select({
      label: "Surface",
      default: "transparent",
      options: ["transparent", "paper", "dark"].map((value) => ({ value, label: value })),
    }),
    padding: field.number({ label: "Padding (px)", default: 24, min: 0, max: 120, integer: true }),
    size: field.number({
      label: "Display size (px)",
      default: 48,
      min: 16,
      max: 120,
      integer: true,
    }),
    mobileSize: field.number({
      label: "Mobile display size (px)",
      default: 32,
      min: 16,
      max: 80,
      integer: true,
    }),
    divider: field.boolean({ label: "Show divider", default: true }),
    target: field.text({
      label: "Countdown launch instant",
      help: "ISO date and time with timezone, e.g. 2027-01-01T18:00:00-05:00. Hidden until set.",
    }),
    seconds: field.boolean({ label: "Show seconds", default: true }),
    expired: field.text({ label: "Countdown completion message" }),
    placeholder: field.text({ label: "Email placeholder", default: "Your email address" }),
    buttonLabel: field.text({ label: "Submit label", default: "Subscribe" }),
    value: field.text({ label: "Statement number" }),
    progress: field.number({
      label: "Progress percentage",
      default: 0,
      min: 0,
      max: 100,
      integer: true,
    }),
    attribution: field.text({ label: "Attribution" }),
    items: field.list({
      label: "Panels / social links",
      max: 20,
      itemLabel: "item",
      of: {
        title: field.text({ label: "Label", required: true }),
        text: field.textarea({ label: "Panel content" }),
        href: field.url({ label: "Social destination" }),
        network: field.select({
          label: "Social icon",
          default: "text",
          options: ["text", "instagram", "linkedin", "x", "youtube"].map((value) => ({
            value,
            label: value,
          })),
        }),
      },
    }),
  },
});
