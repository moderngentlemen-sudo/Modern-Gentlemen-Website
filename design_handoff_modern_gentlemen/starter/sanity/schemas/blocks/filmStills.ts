import { defineType, defineField } from "sanity";

export const filmStills = defineType({
  name: "filmStills",
  title: "MG Film — video stills row",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string", initialValue: "MG Film" }),
    defineField({
      name: "items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "still", title: "Still image", type: "imageWithAlt" }),
            defineField({ name: "videoUrl", title: "Video URL (mp4/webm or YouTube)", type: "url" }),
            defineField({ name: "duration", type: "string" }),
          ],
          preview: { select: { title: "title", media: "still" } },
        },
      ],
      validation: (r) => r.min(1).max(3),
    }),
  ],
  preview: {
    select: { heading: "heading" },
    prepare: ({ heading }) => ({ title: heading || "MG Film", subtitle: "Video stills row" }),
  },
});
