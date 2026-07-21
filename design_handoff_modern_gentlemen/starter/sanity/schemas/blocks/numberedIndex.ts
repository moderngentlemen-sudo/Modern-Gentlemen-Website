import { defineType, defineField } from "sanity";

const item = {
  type: "object",
  fields: [
    defineField({ name: "num", type: "string", description: "Optional; auto-numbered if blank" }),
    defineField({ name: "title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "meta", type: "string" }),
    defineField({ name: "href", type: "string" }),
  ],
  preview: { select: { title: "title", subtitle: "meta" } },
};

export const numberedIndex = defineType({
  name: "numberedIndex",
  title: "The Index — numbered list",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string" }),
    defineField({ name: "items", type: "array", of: [item], validation: (r) => r.min(1) }),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title || "The Index", subtitle: "Numbered list" }) },
});
