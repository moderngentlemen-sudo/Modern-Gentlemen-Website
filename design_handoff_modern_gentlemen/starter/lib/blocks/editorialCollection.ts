import { collectionType, editorialConcept } from "@/lib/domain/editorialCollection";
import { editorialCollectionManifests } from "./manifests/editorialCollection";
import type { BlockTree } from "./types";

/** A complete starter saved atomically with creation. References and illustrative media stay out. */
export function collectionDraft(id: string, kind: "page" | "article", title: string, slug: string) {
  const concept = editorialConcept(id);
  if (!concept || (concept.kind === "article" ? "article" : "page") !== kind)
    throw new Error("Choose a design for this document type.");
  const type = collectionType(concept.id);
  const settings = JSON.parse(JSON.stringify(editorialCollectionManifests[type].insertDefaults));
  if (kind === "page") settings.title = title;
  const sections: BlockTree = [
    {
      _key: `collection_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      _type: type,
      settings,
    },
  ];
  return {
    sections,
    seo: {},
    ...(kind === "article"
      ? {
          body: {},
          hero: {
            editorial: { title, slug },
            presentation: {
              headerMode: "template",
              appearance: "template",
              design: { preset: `collection-${concept.id}` },
            },
          },
        }
      : {}),
  };
}
