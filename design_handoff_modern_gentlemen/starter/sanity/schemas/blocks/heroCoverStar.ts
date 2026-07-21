import { defineType, defineField } from "sanity";

export const heroCoverStar = defineType({
  name: "heroCoverStar",
  title: "Hero — Cover Star",
  type: "object",
  fields: [
    defineField({ name: "eyebrow", type: "string", description: "Serif italic kicker" }),
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "sub", title: "Sub-headline", type: "text", rows: 2 }),
    defineField({
      name: "media",
      type: "object",
      fields: [
        defineField({ name: "kind", type: "string", options: { list: ["image", "video"], layout: "radio" }, initialValue: "image" }),
        defineField({ name: "image", type: "imageWithAlt" }),
        defineField({ name: "videoUrl", title: "Video URL (mp4/webm or YouTube)", type: "url" }),
      ],
    }),
    defineField({ name: "cta", type: "cta" }),
    defineField({
      name: "mobileHeight",
      type: "string",
      options: { list: ["auto", "tall", "fullscreen"], layout: "radio" },
      initialValue: "tall",
    }),
  ],
  preview: {
    select: { title: "headline", media: "media.image" },
    prepare: ({ title, media }) => ({ title: title || "Hero — Cover Star", subtitle: "Hero", media }),
  },
});
