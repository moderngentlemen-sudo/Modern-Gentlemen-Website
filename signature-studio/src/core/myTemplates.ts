/**
 * Your own templates: any signature's design saved for reuse — layout,
 * colours, fonts, blocks, add-ons, logo and Canva design — without the
 * personal parts (details, social links, photo), which come from your saved
 * profile when you use it.
 */
import { uid } from "../lib/id";
import { emptyDetails } from "./defaults";
import type { SignatureDoc } from "./types";

export interface SavedTemplate {
  id: string;
  name: string;
  createdAt: number;
  doc: SignatureDoc;
}

export function templateFromDoc(doc: SignatureDoc, name: string): SavedTemplate {
  const snap = structuredClone(doc);
  const photo = snap.images.photo.assetId;
  snap.details = emptyDetails();
  snap.socials = [];
  snap.images.photo = { ...snap.images.photo, assetId: undefined };
  if (photo && photo !== snap.images.logo.assetId) delete snap.assets[photo];
  snap.published = {};
  delete snap.digitalCardUrl;
  delete snap.cardSlug;
  delete snap.cardImages;
  return { id: uid("t"), name: name.trim() || "My template", createdAt: Date.now(), doc: snap };
}

/** A fresh signature from a saved template (personal details still to be applied). */
export function docFromTemplate(t: SavedTemplate): SignatureDoc {
  const doc = structuredClone(t.doc);
  const now = Date.now();
  return {
    ...doc,
    id: uid("sig"),
    name: t.name,
    createdAt: now,
    updatedAt: now,
    published: {},
    digitalCardUrl: undefined,
    cardSlug: undefined,
    cardImages: undefined,
    useProfile: true,
  };
}
