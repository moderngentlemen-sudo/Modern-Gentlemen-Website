import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/FilmStills.tsx`. */
export const filmStills = defineBlock({
  type: "filmStills",
  label: "MG Film — stills",
  category: "editorial",
  description:
    "Film episode row: still frames with a play affordance and duration, each optionally backed by a video.",
  fields: {
    heading: field.text({ label: "Heading", default: "MG Film" }),
    eyebrow: field.text({ label: "Eyebrow" }),
    allHref: field.url({ label: "All-episodes link" }),
    allLabel: field.text({ label: "All-episodes label", default: "All episodes →" }),
    items: field.list({
      label: "Episodes",
      required: true,
      itemLabel: "episode",
      of: {
        title: field.text({ label: "Title", required: true }),
        still: field.image({ label: "Still frame" }),
        videoUrl: field.video({ label: "Video URL" }),
        duration: field.text({ label: "Duration", help: 'e.g. "4:12"' }),
      },
    }),
  },
  insertDefaults: {
    items: [{ title: "Episode title" }],
  },
  bindable: ["items"],
});
