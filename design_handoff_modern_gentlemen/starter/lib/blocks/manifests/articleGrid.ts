import { defineBlock } from "../defineBlock";
import { field } from "../fields";

/** Transcribed from `components/sections/ArticleGrid.tsx`. */
export const articleGrid = defineBlock({
  type: "articleGrid",
  label: "Article grid",
  category: "editorial",
  description:
    "Three-up article cards under a rail label, with a load-more control. Two-up below 1024px, one-up below 680px.",
  fields: {
    label: field.text({ label: "Rail label", required: true }),
    items: field.list({
      label: "Cards",
      required: true,
      itemLabel: "card",
      of: {
        tag: field.text({ label: "Tag", required: true }),
        title: field.text({ label: "Title", required: true }),
        read: field.text({ label: "Reading time", required: true }),
        image: field.image({ label: "Image", required: true }),
        href: field.url({ label: "Link", required: true }),
      },
    }),
    loadMoreLabel: field.text({ label: "Load-more label", default: "LOAD MORE STORIES" }),
    loadMoreHref: field.url({
      label: "Load-more destination",
      default: "/articles",
      help: "Clear this field to reproduce the original decorative, non-clickable treatment.",
    }),
  },
  insertDefaults: {
    label: "MORE STORIES",
    items: [
      {
        tag: "STYLE",
        title: "Story title",
        read: "6 MIN",
        image: "/images/style-mono.jpg",
        href: "/",
      },
    ],
  },
  bindable: ["items"],
});
