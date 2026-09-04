import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import { SECTION_STUDIES, sectionStudyType, type SectionStudyType } from "../sectionStudies";
import type { BlockManifest } from "../types";

/** Shared editorial contracts, separate identities for search, insertion and preview. */
export const sectionStudyManifests = Object.fromEntries(
  SECTION_STUDIES.map(([id, name, layout, tone]) => [
    sectionStudyType(id),
    defineBlock({
      type: sectionStudyType(id),
      label: `MG Study ${id} · ${name}`,
      category: "editorial",
      hidden: true,
      description: `Mockup ${id}: ${name}. Editable ${layout} composition for pages and templates. Replace illustrative copy and select your own media before publishing.`,
      fields: {
        title: field.textarea({ label: "Heading", required: true }),
        eyebrow: field.text({ label: "Editorial eyebrow" }),
        intro: field.textarea({ label: "Introduction" }),
        image: field.image({ label: "Primary image" }),
        imageAlt: field.text({ label: "Primary image description" }),
        ...(layout !== "correspondence"
          ? {
              items: field.list({
                label: "Stories, images or details",
                itemLabel: "entry",
                max: 12,
                of: {
                  title: field.text({ label: "Heading", required: true }),
                  text: field.textarea({ label: "Description" }),
                  meta: field.text({ label: "Category or label" }),
                  image: field.image({ label: "Image" }),
                  alt: field.text({ label: "Image description" }),
                  href: field.url({ label: "Destination" }),
                },
              }),
            }
          : {}),
        cta: field.link({ label: "Primary action" }),
        tone: field.select({
          label: "Color treatment",
          default: tone,
          options: [
            { value: "light", label: "Theme-aware light" },
            { value: "dark", label: "Always dark" },
            { value: "accent", label: "Racing red" },
          ],
        }),
        mobileOrder: field.select({
          label: "Mobile reading order",
          default: "textFirst",
          options: [
            { value: "textFirst", label: "Heading and copy first" },
            { value: "imageFirst", label: "Primary image first" },
          ],
        }),
        imagePosition: field.select({
          label: "Image focal point",
          default: "center",
          options: [
            { value: "center", label: "Center" },
            { value: "top", label: "Top" },
            { value: "bottom", label: "Bottom" },
          ],
        }),
        ...(layout === "correspondence"
          ? { buttonLabel: field.text({ label: "Signup button", default: "Subscribe" }) }
          : {}),
      },
      insertDefaults: {
        title: name,
        eyebrow: "Modern Gentlemen",
        intro: "Replace this introduction with your editorial copy.",
        // No generated photographs, invented destinations, prices or partner claims publish by default.
        ...(layout !== "correspondence"
          ? {
              items: Array.from(
                { length: ["path", "wardrobe", "shelf"].includes(layout) ? 4 : 3 },
                (_, index) => ({
                  title: `Entry ${index + 1}`,
                  text: "Add your description and select an image.",
                })
              ),
            }
          : {}),
      },
      bindable: layout === "correspondence" ? [] : ["items"],
    }),
  ])
) as Record<SectionStudyType, BlockManifest>;

/** New insertions use one studio; legacy identities remain valid forever. */
export const mgDesignStudio = defineBlock({
  type: "mgDesignStudio",
  label: "MG design studio",
  category: "editorial",
  description:
    "36 numbered mockup designs: " +
    SECTION_STUDIES.map(([id, name]) => `${id} ${name}`).join("; "),
  fields: {
    variant: field.select({
      label: "Studio design",
      default: "01",
      options: SECTION_STUDIES.map(([value, label]) => ({
        value,
        label: `MG ${value} · ${label}`,
      })),
    }),
    ...sectionStudyManifests.mgStudy01.fields,
    tone: field.select({
      label: "Color treatment",
      default: "preset",
      options: [
        { value: "preset", label: "Design default" },
        { value: "light", label: "Theme-aware light" },
        { value: "dark", label: "Always dark" },
        { value: "accent", label: "Racing red" },
      ],
    }),
    buttonLabel: field.text({
      label: "Newsletter signup button (design 31)",
      default: "Subscribe",
    }),
  },
  insertDefaults: {
    ...sectionStudyManifests.mgStudy01.insertDefaults,
    variant: "01",
    tone: "preset",
  },
  bindable: ["items"],
});
