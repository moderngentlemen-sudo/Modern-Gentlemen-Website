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
    "A dynamic article archive with eleven compositions, responsive layout controls, and accessible pagination.",
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
        ["wide", "Wide · 16:9"],
        ["landscape", "Landscape"],
        ["portrait", "Portrait"],
        ["square", "Square"],
        ["tall", "Tall · 2:3"],
        ["cinema", "Cinema · 21:9"],
      ],
      "landscape"
    ),
    imageWidth: select(
      "Horizontal image width",
      [
        ["oneThird", "One third"],
        ["half", "Half"],
        ["twoThird", "Two thirds"],
      ],
      "half"
    ),
    imagePosition: select(
      "Horizontal image position",
      [
        ["preset", "Use layout preset"],
        ["left", "Left"],
        ["right", "Right"],
        ["alternate", "Alternate"],
      ],
      "preset"
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
    columnsDesktop: select(
      "Desktop columns",
      [
        ["auto", "Use layout preset"],
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
        ["4", "4"],
      ],
      "auto"
    ),
    columnsTablet: select(
      "Tablet columns",
      [
        ["auto", "Use layout preset"],
        ["1", "1"],
        ["2", "2"],
        ["3", "3"],
      ],
      "auto"
    ),
    columnsMobile: select(
      "Mobile columns",
      [
        ["auto", "Use layout preset"],
        ["1", "1"],
        ["2", "2"],
      ],
      "auto"
    ),
    rowGap: select(
      "Row gap",
      [
        ["preset", "Use layout preset"],
        ["0", "0 px"],
        ["8", "8 px"],
        ["16", "16 px"],
        ["24", "24 px"],
        ["32", "32 px"],
        ["48", "48 px"],
        ["64", "64 px"],
      ],
      "preset"
    ),
    columnGap: select(
      "Column gap",
      [
        ["preset", "Use layout preset"],
        ["0", "0 px"],
        ["8", "8 px"],
        ["16", "16 px"],
        ["24", "24 px"],
        ["32", "32 px"],
        ["48", "48 px"],
        ["64", "64 px"],
      ],
      "preset"
    ),
    showSeparators: field.boolean({ label: "Show row separators", default: false }),
    readMoreLabel: field.text({ label: "Per-story read-more label" }),
    emptyMessage: field.text({
      label: "Empty-feed message",
      default: "No stories match this feed yet.",
    }),
    pagination: select(
      "Pagination",
      [
        ["none", "Show all"],
        ["pages", "Numbered pages"],
        ["loadMore", "Load more"],
        ["infinite", "Infinite reveal + fallback"],
      ],
      "none"
    ),
    pageSize: field.number({
      label: "Stories per page",
      default: 6,
      min: 1,
      max: 12,
      integer: true,
    }),
    paginationLabel: field.text({
      label: "Pagination accessibility label",
      default: "Stories pagination",
    }),
    previousLabel: field.text({ label: "Previous-page label", default: "Previous" }),
    nextLabel: field.text({ label: "Next-page label", default: "Next" }),
    paginationButtonLabel: field.text({ label: "Load-more button label", default: "Load more" }),
    infiniteFallbackLabel: field.text({
      label: "Infinite-scroll fallback label",
      default: "Show more now",
    }),
    loadMoreLabel: field.text({ label: "View-all label" }),
    loadMoreHref: field.url({
      label: "View-all link",
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
