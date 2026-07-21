import { defineType, defineField } from "sanity";

export const statsBand = defineType({
  name: "statsBand",
  title: "By the Numbers — stats",
  type: "object",
  fields: [
    defineField({ name: "eyebrow", type: "string" }),
    defineField({
      name: "stats",
      type: "array",
      of: [{ type: "object", fields: [defineField({ name: "value", type: "string", validation: (r) => r.required() }), defineField({ name: "label", type: "string", validation: (r) => r.required() })], preview: { select: { title: "value", subtitle: "label" } } }],
      validation: (r) => r.min(2).max(4),
    }),
  ],
  preview: { prepare: () => ({ title: "By the Numbers" }) },
});
