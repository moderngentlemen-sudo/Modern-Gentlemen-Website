import { defineType, defineField } from "sanity";

export const timeline = defineType({
  name: "timeline",
  title: "Timeline — a brief history",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string" }),
    defineField({
      name: "entries",
      type: "array",
      of: [{ type: "object", fields: [defineField({ name: "year", type: "string", validation: (r) => r.required() }), defineField({ name: "title", type: "string", validation: (r) => r.required() }), defineField({ name: "body", type: "text", rows: 2 })], preview: { select: { title: "title", subtitle: "year" } } }],
      validation: (r) => r.min(1),
    }),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title || "Timeline", subtitle: "History" }) },
});
