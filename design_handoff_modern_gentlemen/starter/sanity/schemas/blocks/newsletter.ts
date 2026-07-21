import { defineType, defineField } from "sanity";

export const newsletter = defineType({
  name: "newsletter",
  title: "Newsletter capture band",
  type: "object",
  fields: [
    defineField({ name: "heading", type: "string", validation: (r) => r.required() }),
    defineField({ name: "sub", type: "text", rows: 2 }),
    defineField({ name: "buttonLabel", type: "string", initialValue: "Subscribe" }),
    defineField({ name: "placeholder", type: "string", initialValue: "Your email address" }),
  ],
  preview: {
    select: { title: "heading" },
    prepare: ({ title }) => ({ title: title || "Newsletter", subtitle: "Capture band" }),
  },
});
