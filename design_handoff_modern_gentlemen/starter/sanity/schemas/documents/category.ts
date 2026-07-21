import { defineType, defineField } from "sanity";
import { blockTypes } from "../index";

export const category = defineType({
  name: "category",
  title: "Category",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title" },
      description: "style | grooming | watches | culture | film",
      validation: (r) => r.required(),
    }),
    defineField({ name: "intro", type: "text", rows: 3 }),
    defineField({ name: "heroImage", type: "imageWithAlt" }),
    defineField({
      name: "sections",
      type: "array",
      of: blockTypes.map((b) => ({ type: b.name })),
      options: { insertMenu: { views: [{ name: "grid" }, { name: "list" }] } },
    }),
  ],
  preview: { select: { title: "title", media: "heroImage" } },
});
