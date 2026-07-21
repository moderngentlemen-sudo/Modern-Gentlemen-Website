import { defineType, defineField } from "sanity";

export const twoUpCategory = defineType({
  name: "twoUpCategory",
  title: "Two-up category features",
  type: "object",
  fields: [
    defineField({
      name: "items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "kicker", type: "string" }),
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "href", type: "string" }),
            defineField({ name: "image", type: "imageWithAlt" }),
          ],
          preview: { select: { title: "title", subtitle: "kicker", media: "image" } },
        },
      ],
      validation: (r) => r.length(2),
    }),
  ],
  preview: { prepare: () => ({ title: "Two-up category" }) },
});
