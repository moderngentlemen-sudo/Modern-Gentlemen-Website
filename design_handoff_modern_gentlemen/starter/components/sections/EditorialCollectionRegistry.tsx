import type { ComponentType } from "react";
import {
  EDITORIAL_COLLECTION,
  collectionType,
  type EditorialCollectionType,
} from "@/lib/domain/editorialCollection";
import { EditorialCollection, type CollectionProps } from "./EditorialCollection";

// Keep the registry outside the client boundary. The public server renderer must
// enumerate ordinary component entries, not spread a client module reference.
export const editorialCollectionRegistry = Object.fromEntries(
  EDITORIAL_COLLECTION.map((concept) => {
    function CollectionBlock(props: CollectionProps) {
      return <EditorialCollection id={concept.id} {...props} />;
    }
    CollectionBlock.displayName = `MGCollection${concept.id}`;
    return [collectionType(concept.id), CollectionBlock];
  })
) as Record<EditorialCollectionType, ComponentType<CollectionProps>>;
