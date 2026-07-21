import { defineType, defineField } from "sanity";

export const storyBand = defineType({
  name: "storyBand",
  title: "Story band (full-bleed statement)",
  type: "object",
  fields: [
    defineField({ name: "eyebrow", type: "string" }),
    defineField({ name: "quote", type: "text", rows: 3, validation: (r) => r.required() }),
    defineField({ name: "attribution", type: "string" }),
    defineField({ name: "backgroundImage", type: "imageWithAlt" }),
    defineField({ name: "cta", type: "cta" }),
  ],
  preview: {
    select: { title: "quote", media: "backgroundImage" },
    prepare: ({ title, media }) => ({ title: title || "Story band", subtitle: "Full-bleed band", media }),
  },
});
