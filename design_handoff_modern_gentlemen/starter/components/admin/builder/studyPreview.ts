import { SECTION_STUDIES, sectionStudyType } from "@/lib/blocks/sectionStudies";

/** Picker-only media: never included in newBlockNode, saved documents or public rendering. */
export function studyPreview(type: string, variant = "01"): Record<string, unknown> {
  const study = SECTION_STUDIES.find(([id]) =>
    type === "mgDesignStudio" ? id === variant : sectionStudyType(id) === type
  );
  if (!study) return {};
  const [id, name, layout] = study;
  const images = [
    "/images/style-mono.jpg",
    "/images/watch-gear.jpg",
    "/images/film-workshop.jpg",
    "/images/film-tailor.jpg",
  ];
  const primary = ["anatomy", "collection", "shelf"].includes(layout) ? images[1] : images[0];
  return {
    title: name,
    eyebrow: `MG Study ${id}`,
    intro: "Illustrative preview — choose your own copy and media.",
    ...(![
      "statement",
      "collection",
      "path",
      "ritual",
      "comparison",
      "shelf",
      "process",
      "triptych",
      "manifesto",
      "next",
    ].includes(layout)
      ? { image: primary, imageAlt: "Illustrative editorial image" }
      : {}),
    ...(layout !== "correspondence"
      ? {
          items: Array.from(
            {
              length: ["path", "wardrobe", "shelf"].includes(layout)
                ? 4
                : layout === "diptych"
                  ? 1
                  : layout === "comparison" || layout === "next"
                    ? 2
                    : 3,
            },
            (_, index) => ({
              title: [
                "A considered perspective",
                "The details that matter",
                "A different point of view",
                "Something worth keeping",
              ][index],
              text: "Your editorial description.",
              ...(![
                "statement",
                "manifesto",
                "letter",
                "brief",
                "index",
                "portrait",
                "invitation",
                "gathering",
              ].includes(layout)
                ? { image: images[index % images.length], alt: "Illustrative editorial image" }
                : {}),
            })
          ),
        }
      : {}),
  };
}
