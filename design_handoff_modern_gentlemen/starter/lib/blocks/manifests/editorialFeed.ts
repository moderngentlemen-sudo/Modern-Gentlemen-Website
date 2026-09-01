import { defineBlock } from "../defineBlock";
import { field } from "../fields";

const variants = [
  ["horizontal-1", "Horizontal 1 — alternating"],
  ["horizontal-2", "Horizontal 2 — image right"],
  ["horizontal-3", "Horizontal 3 — compact media list"],
  ["horizontal-4", "Horizontal 4 — lead and list"],
  ["horizontal-5", "Horizontal 5 — numbered index"],
  ["standard-1", "Standard 1 — three columns"],
  ["standard-2", "Standard 2 — two columns"],
  ["standard-3", "Standard 3 — feature and grid"],
  ["standard-4", "Standard 4 — minimal two-column list"],
  ["tile-1", "Tile 1 — overlay grid"],
  ["tile-2", "Tile 2 — feature mosaic"],
] as const;

const select = (
  label: string,
  values: readonly (readonly [string, string])[],
  defaultValue: string
) =>
  field.select({
    label,
    options: values.map(([value, optionLabel]) => ({ value, label: optionLabel })),
    default: defaultValue,
  });

export const editorialFeed = defineBlock({
  type: "editorialFeed",
  label: "Editorial feed",
  category: "editorial",
  description:
    "A dynamic article feed with eleven horizontal, standard, and tile compositions plus independent content and card controls.",
  fields: {
    eyebrow: field.text({ label: "Eyebrow" }),
    heading: field.text({ label: "Heading", default: "Latest stories" }),
    introduction: field.textarea({ label: "Introduction" }),
    variant: select("Layout", variants, "standard-1"),
    items: field.list({
      label: "Stories",
      required: true,
      itemLabel: "story",
      min: 1,
      max: 24,
      of: {
        tag: field.text({ label: "Category / tag" }),
        title: field.text({ label: "Title", required: true }),
        dek: field.textarea({ label: "Excerpt" }),
        author: field.text({ label: "Author" }),
        read: field.text({ label: "Reading time" }),
        image: field.image({ label: "Image" }),
        href: field.url({ label: "Link", required: true }),
      },
    }),
    showImages: field.boolean({ label: "Show images", default: true }),
    showTags: field.boolean({ label: "Show categories / tags", default: true }),
    showExcerpts: field.boolean({ label: "Show excerpts", default: true }),
    showAuthors: field.boolean({ label: "Show authors", default: false }),
    showReadingTime: field.boolean({ label: "Show reading time", default: true }),
    imageRatio: select(
      "Image ratio",
      [
        ["landscape", "Landscape"],
        ["portrait", "Portrait"],
        ["square", "Square"],
      ],
      "landscape"
    ),
    cardStyle: select(
      "Card treatment",
      [
        ["plain", "Plain"],
        ["bordered", "Bordered"],
        ["elevated", "Elevated"],
      ],
      "plain"
    ),
    titleSize: select(
      "Title size",
      [
        ["compact", "Compact"],
        ["standard", "Standard"],
        ["large", "Large"],
      ],
      "standard"
    ),
    loadMoreLabel: field.text({ label: "More-stories label" }),
    loadMoreHref: field.url({
      label: "More-stories link",
      help: "The button appears only when both label and link are set.",
    }),
  },
  insertDefaults: {
    heading: "Latest stories",
    items: [
      {
        tag: "STYLE · 040",
        title: "A considered approach to modern style",
        dek: "A concise introduction to the story and the idea behind it.",
        author: "Modern Gentlemen",
        read: "6 MIN",
        image: "/images/style-mono.jpg",
        href: "/",
      },
      {
        tag: "CULTURE · 039",
        title: "The people shaping what comes next",
        dek: "An editorial description gives the layout room to breathe.",
        author: "Modern Gentlemen",
        read: "5 MIN",
        image: "/images/film-tailor.jpg",
        href: "/",
      },
      {
        tag: "WATCHES · 038",
        title: "Objects designed to endure",
        dek: "Use literal stories or switch this list to Dynamic content.",
        author: "Modern Gentlemen",
        read: "4 MIN",
        image: "/images/watch-gear.jpg",
        href: "/",
      },
    ],
  },
  bindable: ["items"],
});
