import { defineType, defineField } from "sanity";

export const interview = defineType({
  name: "interview",
  title: "The Interview — Q&A",
  type: "object",
  fields: [
    defineField({ name: "eyebrow", type: "string" }),
    defineField({ name: "headline", type: "string", validation: (r) => r.required() }),
    defineField({ name: "subject", type: "string", description: "e.g. name / role" }),
    defineField({
      name: "qa",
      title: "Questions & answers",
      type: "array",
      of: [{ type: "object", fields: [defineField({ name: "q", title: "Question", type: "string" }), defineField({ name: "a", title: "Answer", type: "text", rows: 3 })], preview: { select: { title: "q" } } }],
      validation: (r) => r.min(1),
    }),
  ],
  preview: { select: { title: "headline" }, prepare: ({ title }) => ({ title: title || "The Interview", subtitle: "Q&A" }) },
});
