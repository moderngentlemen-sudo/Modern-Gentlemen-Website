import { defineType, defineField } from "sanity";

/**
 * OPTIONAL. If you go headless-Shopify (recommended), products live in Shopify
 * and this schema is only for editorial overrides (story copy, extra imagery).
 * If you keep the local catalog (lib/catalog.ts), you can skip this doc entirely.
 */
export const product = defineType({
  name: "product",
  title: "Product (editorial overlay)",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "name" }, validation: (r) => r.required() }),
    defineField({ name: "shopifyId", type: "string", description: "Storefront product id, if using Shopify" }),
    defineField({ name: "cat", type: "string", options: { list: ["Style", "Watches", "Grooming", "Accessories"] } }),
    defineField({ name: "price", type: "number", description: "GBP integer (mirror of Shopify for display only)" }),
    defineField({ name: "tag", type: "string", options: { list: ["NEW", "BESTSELLER", "LIMITED"] } }),
    defineField({ name: "material", type: "string" }),
    defineField({ name: "blurb", type: "text", rows: 2 }),
    defineField({ name: "story", type: "array", of: [{ type: "block" }] }),
    defineField({
      name: "specs",
      type: "array",
      of: [{ type: "object", fields: [defineField({ name: "key", type: "string" }), defineField({ name: "value", type: "string" })] }],
    }),
    defineField({ name: "images", type: "array", of: [{ type: "imageWithAlt" }] }),
  ],
  preview: { select: { title: "name", subtitle: "cat", media: "images.0" } },
});
