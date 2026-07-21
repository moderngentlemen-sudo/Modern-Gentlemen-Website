import { defineType, defineField } from "sanity";

export const latestGrid = defineType({
  name: "latestGrid",
  title: "The Latest — editorial grid",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string", initialValue: "The Latest" }),
    defineField({
      name: "variant",
      type: "string",
      options: { list: ["threeCol", "featureLeft", "mosaic"], layout: "radio" },
      initialValue: "threeCol",
    }),
    defineField({
      name: "items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "kicker", type: "string", description: "Category label" }),
            defineField({ name: "title", type: "string", validation: (r) => r.required() }),
            defineField({ name: "href", type: "string" }),
            defineField({ name: "meta", type: "string", description: "e.g. date / read time" }),
            defineField({ name: "image", type: "imageWithAlt" }),
          ],
          preview: { select: { title: "title", subtitle: "kicker", media: "image" } },
        },
      ],
      validation: (r) => r.min(1),
    }),
  ],
  preview: {
    select: { heading: "heading", count: "items.length" },
    prepare: ({ heading, count }) => ({ title: heading || "The Latest", subtitle: `Grid · ${count || 0} items` }),
  },
});
