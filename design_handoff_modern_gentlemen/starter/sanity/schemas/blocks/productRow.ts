import { defineType, defineField } from "sanity";

export const productRow = defineType({
  name: "productRow",
  title: "Store — product row",
  type: "object",
  description: "Pulls from the catalog/Shopify. Filter by group or curate by slug.",
  fields: [
    defineField({ name: "eyebrow", type: "string" }),
    defineField({ name: "heading", type: "string", initialValue: "The Store" }),
    defineField({ name: "group", type: "string", options: { list: ["All", "Style", "Watches", "Grooming", "Accessories"] }, initialValue: "All" }),
    defineField({ name: "slugs", title: "Curated slugs (optional)", type: "array", of: [{ type: "string" }], description: "If set, overrides group filter" }),
    defineField({ name: "href", type: "string", initialValue: "/shop" }),
  ],
  preview: { select: { title: "heading", subtitle: "group" } },
});
