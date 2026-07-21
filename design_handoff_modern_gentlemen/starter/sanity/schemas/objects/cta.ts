import { defineType, defineField } from "sanity";

export const cta = defineType({
  name: "cta",
  title: "Call to action",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string", validation: (r) => r.required() }),
    defineField({ name: "href", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "style",
      type: "string",
      options: { list: ["solid", "outline"], layout: "radio" },
      initialValue: "solid",
    }),
  ],
});
