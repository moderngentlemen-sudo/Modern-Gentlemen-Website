import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import {
  MG_SIGNATURE_SECTIONS,
  SIGNATURE_DEFAULTS,
  signatureType,
  type SignatureType,
} from "../mgSignatureSections";
import type { BlockManifest } from "../types";

export const signatureSectionManifests = Object.fromEntries(
  MG_SIGNATURE_SECTIONS.map((section) => [
    signatureType(section.id),
    defineBlock({
      type: signatureType(section.id),
      label: `MG · ${section.name}`,
      category: section.category,
      description: `${section.group}. ${section.description} Signature collection.`,
      fields: {
        title: field.textarea({ label: "Heading", required: true }),
        eyebrow: field.text({ label: "Eyebrow" }),
        intro: field.textarea({ label: "Introduction" }),
        image: field.image({ label: "Feature image" }),
        imageAlt: field.text({ label: "Feature image description" }),
        caption: field.text({ label: "Image caption / credit" }),
        items: field.list({
          label: "Entries",
          itemLabel: "entry",
          max: 12,
          of: {
            title: field.text({ label: "Heading / question", required: true }),
            text: field.textarea({ label: "Description / answer" }),
            meta: field.text({ label: "Category / time / key quality" }),
            detail: field.textarea({ label: "Additional detail / date / comparison note" }),
            image: field.image({ label: "Image" }),
            alt: field.text({ label: "Image description" }),
            href: field.url({ label: "Link destination" }),
          },
        }),
        cta: field.link({
          label: "Section action",
          help: "Add a real destination to show this action.",
        }),
        tone: field.select({
          label: "Color treatment",
          default: SIGNATURE_DEFAULTS[section.id].tone ?? "theme",
          options: [
            { value: "theme", label: "Follow site theme" },
            { value: "dark", label: "Always dark" },
          ],
        }),
        spacing: field.select({
          label: "Section spacing",
          default: "comfortable",
          options: [
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
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
        ...(section.id === "brandPerspective"
          ? {
              disclosure: field.text({
                label: "Partnership disclosure",
                required: true,
                default: "Partner story",
                help: "Keep the commercial relationship visible to readers.",
              }),
            }
          : {}),
      },
      insertDefaults: { ...SIGNATURE_DEFAULTS[section.id] },
    }),
  ])
) as Record<SignatureType, BlockManifest>;
