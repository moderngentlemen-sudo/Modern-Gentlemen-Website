import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/HeroCoverStar.tsx`. The component is
 * the authority on what these fields mean; this file only says what they are.
 * Where the two ever disagree, the component wins and this is the bug.
 */
export const heroCoverStar = defineBlock({
  type: "heroCoverStar",
  label: "Hero — Cover Star",
  category: "hero",
  description:
    "Full-bleed 100vh cover under a bottom-rising scrim, with the headline block inset from the left and issue meta pinned to the bottom corners.",
  fields: {
    badge: field.text({ label: "Badge", help: 'Red mono pill, e.g. "COVER STORY — ISSUE 042"' }),
    eyebrow: field.text({ label: "Eyebrow", help: "Serif italic kicker above the headline" }),
    headline: field.textarea({
      label: "Headline",
      required: true,
      help: "A newline forces an explicit line break.",
    }),
    sub: field.textarea({ label: "Dek" }),
    media: field.group({
      label: "Cover media",
      fields: {
        kind: field.select({
          label: "Kind",
          options: [
            { value: "image", label: "Image" },
            { value: "video", label: "Video" },
          ],
        }),
        image: field.image({ label: "Image", help: "Also the poster frame for a video cover." }),
        videoUrl: field.video({ label: "Video URL" }),
      },
    }),
    cta: field.link({ label: "Call to action" }),
    credit: field.text({ label: "Credit", help: 'Mono, e.g. "PHOTOGRAPHY · E. MARLOWE"' }),
    meta: field.text({ label: "Meta rail", help: 'e.g. "NO. 042 — A. BELLAMY — 11 MIN"' }),
    mobileHeight: field.select({
      label: "Height on phones",
      default: "fullscreen",
      options: [
        { value: "auto", label: "Auto" },
        { value: "tall", label: "Tall" },
        { value: "fullscreen", label: "Full screen" },
      ],
    }),
  },
  insertDefaults: {
    headline: "Headline",
  },
});
