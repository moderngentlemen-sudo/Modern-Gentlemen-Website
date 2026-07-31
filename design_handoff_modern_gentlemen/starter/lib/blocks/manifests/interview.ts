import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/Interview.tsx`. */
export const interview = defineBlock({
  type: "interview",
  label: "The Interview — Q&A",
  category: "editorial",
  description:
    "Narrow-column question-and-answer run. A single long entry also covers the Letter from the Editor treatment.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow" }),
    headline: field.textarea({ label: "Headline", required: true }),
    subject: field.text({ label: "Subject", help: "Mono line under the headline." }),
    qa: field.list({
      label: "Exchanges",
      required: true,
      itemLabel: "exchange",
      of: {
        q: field.textarea({ label: "Question", required: true }),
        a: field.richText({ label: "Answer", required: true }),
      },
    }),
  },
  insertDefaults: {
    headline: "Headline",
    qa: [{ q: "The question.", a: "The answer." }],
  },
});
