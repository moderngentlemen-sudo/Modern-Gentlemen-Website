import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/EditorialHero.tsx`.
 *
 * The component also accepts `children` (the Membership page passes its billing
 * toggle through it). That is a React slot, not content — it cannot survive a
 * JSON round trip and so has no field here. Blocks composed in the builder
 * never supply it; the bespoke Membership page renders the component directly.
 */
export const editorialHero = defineBlock({
  type: "editorialHero",
  label: "Editorial page hero",
  category: "hero",
  description:
    "Type-only page opener: mono eyebrow, oversized headline with an optional accent-red trailing clause, serif dek. Left or centred.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow", required: true }),
    headline: field.textarea({ label: "Headline", required: true }),
    accent: field.text({
      label: "Accent clause",
      help: "Trailing part of the headline, rendered in accent red.",
    }),
    dek: field.textarea({ label: "Dek" }),
    align: field.select({
      label: "Alignment",
      default: "left",
      options: [
        { value: "left", label: "Left" },
        { value: "center", label: "Centred" },
      ],
    }),
  },
  insertDefaults: {
    eyebrow: "Eyebrow",
    headline: "Headline",
  },
});
