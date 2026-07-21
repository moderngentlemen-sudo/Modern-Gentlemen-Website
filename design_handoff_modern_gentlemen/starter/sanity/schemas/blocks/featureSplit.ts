import { defineType, defineField } from "sanity";

export const featureSplit = defineType({
  name: "featureSplit",
  title: "Feature — split",
  type: "object",
  fields: [
    defineField({ name: "eyebrow", type: "string" }),
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "body", type: "text", rows: 4 }),
    defineField({ name: "image", type: "imageWithAlt" }),
    defineField({ name: "cta", type: "cta" }),
    defineField({
      name: "variant",
      type: "string",
      options: { list: ["imageRight", "imageLeft", "overlap"], layout: "radio" },
      initialValue: "imageRight",
    }),
  ],
  preview: {
    select: { title: "headline", media: "image" },
    prepare: ({ title, media }) => ({ title: title || "Feature", subtitle: "Feature split", media }),
  },
});
