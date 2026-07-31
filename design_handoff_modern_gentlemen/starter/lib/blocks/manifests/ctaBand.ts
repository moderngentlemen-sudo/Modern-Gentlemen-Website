import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/CtaBand.tsx`.
 *
 * `variant` is required with no default — the component has none either, and
 * the three layouts use different halves of the field set, so guessing one
 * would silently pick a layout the editor did not choose.
 */
export const ctaBand = defineBlock({
  type: "ctaBand",
  label: "CTA band (red)",
  category: "bands",
  description:
    "The red band, in three layouts: split newsletter, centred join with an email field, or a centred dark pill link.",
  fields: {
    variant: field.select({
      label: "Layout",
      required: true,
      options: [
        { value: "split", label: "Split — heading left, email right" },
        { value: "centered", label: "Centred — heading over email" },
        { value: "link", label: "Link — heading over a dark pill" },
      ],
    }),
    eyebrow: field.text({ label: "Eyebrow" }),
    heading: field.textarea({ label: "Heading", required: true }),
    sub: field.textarea({ label: "Sub copy", help: "Link layout only." }),
    placeholder: field.text({
      label: "Input placeholder",
      default: "you@email.com",
      help: "Email layouts only.",
    }),
    buttonLabel: field.text({ label: "Button label", default: "SUBSCRIBE" }),
    successLabel: field.text({ label: "Success label", default: "SUBSCRIBED ✓" }),
    cta: field.link({ label: "Call to action", help: "Link layout only." }),
    gutter: field.number({
      label: "Side gutter",
      default: 48,
      integer: true,
      min: 0,
      help: "Minimum side padding in px — 48 on Category, 22 on About and Membership.",
    }),
  },
  insertDefaults: {
    variant: "centered",
    heading: "Join Modern Gentlemen",
  },
});
