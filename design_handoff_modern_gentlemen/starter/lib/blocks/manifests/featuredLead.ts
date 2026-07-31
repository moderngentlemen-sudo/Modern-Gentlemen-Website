import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/FeaturedLead.tsx`. */
export const featuredLead = defineBlock({
  type: "featuredLead",
  label: "Category — featured lead",
  category: "editorial",
  description:
    "One large featured-article card — cover image meeting an editorial column. The whole card is the link.",
  fields: {
    label: field.text({ label: "Rail label", default: "THE LEAD" }),
    article: field.group({
      label: "Article",
      required: true,
      fields: {
        kicker: field.text({ label: "Kicker", required: true, help: 'e.g. "STYLE · 041"' }),
        title: field.text({ label: "Title", required: true }),
        dek: field.textarea({ label: "Dek" }),
        author: field.text({ label: "Author" }),
        read: field.text({ label: "Reading time" }),
        image: field.image({ label: "Cover image", required: true }),
        href: field.url({ label: "Link", required: true }),
      },
    }),
  },
  insertDefaults: {
    article: {
      kicker: "SECTION · 001",
      title: "The lead story",
      image: "/images/style-mono.jpg",
      href: "/",
    },
  },
  bindable: ["article"],
});
