import { defineBlock } from "../defineBlock";
import { field } from "../fields";
import { COMING_SOON_DESIGNS } from "../comingSoon";

export const comingSoonStudio = defineBlock({
  type: "comingSoonStudio",
  label: "Coming soon studio",
  category: "hero",
  description:
    "CS01–CS20 coming-soon page designs. Switch composition without replacing your copy or media. Signup is optional and uses the newsletter connection.",
  onlyIn: ["page", "template"],
  fields: {
    variant: field.select({
      label: "Coming soon design",
      default: "01",
      options: COMING_SOON_DESIGNS.map(([value, label]) => ({
        value,
        label: `CS${value} · ${label}`,
      })),
    }),
    brand: field.text({ label: "Masthead", default: "Modern Gentlemen" }),
    eyebrow: field.text({ label: "Eyebrow" }),
    title: field.textarea({ label: "Headline", required: true, default: "Coming soon" }),
    intro: field.textarea({ label: "Supporting copy" }),
    image: field.image({ label: "Primary image" }),
    imageAlt: field.text({ label: "Primary image description" }),
    images: field.list({
      label: "Contact sheet or collage images",
      itemLabel: "image",
      max: 6,
      of: {
        image: field.image({ label: "Image", required: true }),
        alt: field.text({ label: "Image description" }),
      },
    }),
    details: field.list({
      label: "Notes or index entries",
      itemLabel: "note",
      max: 6,
      of: {
        title: field.text({ label: "Heading", required: true }),
        text: field.textarea({ label: "Description" }),
      },
    }),
    signature: field.text({ label: "Sign-off or footer note" }),
    cta: field.link({ label: "Optional destination" }),
    showSignup: field.boolean({
      label: "Show newsletter signup",
      default: false,
      help: "Uses the existing newsletter service. Enable when you want to accept subscribers.",
    }),
    buttonLabel: field.text({ label: "Signup button", default: "Notify me" }),
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
    mobileOrder: field.select({
      label: "Mobile reading order",
      default: "textFirst",
      options: [
        { value: "textFirst", label: "Copy first" },
        { value: "imageFirst", label: "Image first" },
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
    height: field.select({
      label: "Page height",
      default: "screen",
      options: [
        { value: "screen", label: "At least one screen" },
        { value: "content", label: "Fit content" },
      ],
    }),
  },
});
