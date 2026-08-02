import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/**
 * Transcribed from `components/sections/ProductRow.tsx`.
 *
 * The block references products by slug and reads price and imagery from the
 * catalog at render time. It therefore holds no money of its own — nothing here
 * can drift from `lib/domain/money.ts`, which is the point.
 */
export const productRow = defineBlock({
  type: "productRow",
  label: "Store — product row",
  category: "commerce",
  description:
    "Four-up product row with add-to-bag. Filter by catalog group, or curate an explicit list of slugs.",
  fields: {
    heading: field.text({ label: "Heading", default: "The Store" }),
    eyebrow: field.text({ label: "Eyebrow" }),
    group: field.text({
      label: "Catalog group",
      help: 'Filters the catalog. Ignored when slugs are set. Defaults to "All".',
    }),
    slugs: field.list({
      label: "Curated products",
      itemLabel: "product",
      help: "Explicit product slugs, in order. Takes precedence over the group filter.",
      of: field.text({ label: "Product slug", required: true }),
    }),
    href: field.url({ label: "Store-all link", default: "/shop" }),
  },
  bindable: ["slugs"],
});
