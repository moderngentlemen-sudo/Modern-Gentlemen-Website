import { defineType, defineField } from "sanity";

/** Template-driven editorial article. `template` picks the hero+body variant
 *  (replaces the prototype's per-article localStorage template choice). */
export const article = defineType({
  name: "article",
  title: "Article",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "title" }, validation: (r) => r.required() }),
    defineField({ name: "category", type: "reference", to: [{ type: "category" }] }),
    defineField({ name: "excerpt", type: "text", rows: 3 }),
    defineField({ name: "heroImage", type: "imageWithAlt" }),
    defineField({ name: "publishedAt", type: "datetime" }),
    defineField({
      name: "template",
      title: "Article template",
      type: "string",
      description: "Hero + body layout variant. Extend the list as you build variants.",
      options: {
        list: ["standard", "fullBleedHero", "splitHero", "centered", "photoEssay"],
      },
      initialValue: "standard",
    }),
    defineField({
      name: "body",
      type: "array",
      of: [
        { type: "block" },
        { type: "imageWithAlt" },
        { type: "object", name: "pullQuote", fields: [defineField({ name: "text", type: "text" }), defineField({ name: "attribution", type: "string" })] },
      ],
    }),
  ],
  preview: { select: { title: "title", media: "heroImage" } },
});
