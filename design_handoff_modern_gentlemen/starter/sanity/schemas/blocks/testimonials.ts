import { defineType, defineField } from "sanity";

export const testimonials = defineType({
  name: "testimonials",
  title: "Member Voices — testimonials",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string" }),
    defineField({
      name: "quotes",
      type: "array",
      of: [{ type: "object", fields: [defineField({ name: "text", type: "text", rows: 3, validation: (r) => r.required() }), defineField({ name: "name", type: "string", validation: (r) => r.required() }), defineField({ name: "detail", type: "string" })], preview: { select: { title: "name", subtitle: "text" } } }],
      validation: (r) => r.min(1),
    }),
  ],
  preview: { select: { title: "heading" }, prepare: ({ title }) => ({ title: title || "Member Voices", subtitle: "Testimonials" }) },
});
