import { defineType, defineField } from "sanity";
import { blockTypes } from "../index";

/**
 * A composable page = ordered sections[]. The array's `of` list is what the
 * editor can drag in. Grid insert-menu view gives a visual picker gallery
 * (mirrors the prototype's Section Library). See 05_SECTION_BUILDER.md.
 */
export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({
      name: "sections",
      title: "Sections",
      type: "array",
      of: blockTypes.map((b) => ({ type: b.name })),
      options: { insertMenu: { views: [{ name: "grid" }, { name: "list" }] } },
    }),
  ],
  preview: {
    select: { title: "title", slug: "slug.current" },
    prepare: ({ title, slug }) => ({ title, subtitle: `/${slug || ""}` }),
  },
});
