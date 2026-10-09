/**
 * Your saved contact information: details, social links and photo, entered
 * once and shared by every signature that is linked to it (the default).
 * Editing them in any linked signature updates all the others.
 */
import { SAMPLE_DETAILS } from "./defaults";
import type { AssetMeta, Details, ImageSlot, SignatureDoc, SocialLink } from "./types";

export interface Profile {
  details: Details;
  socials: SocialLink[];
  photo?: { meta: AssetMeta; crop: ImageSlot["crop"]; shape: ImageSlot["shape"] };
  updatedAt: number;
}

export const isLinked = (doc: SignatureDoc) => doc.useProfile !== false;

export function profileFromDoc(doc: SignatureDoc): Profile {
  const id = doc.images.photo.assetId;
  const meta = id ? doc.assets[id] : undefined;
  return {
    details: structuredClone(doc.details),
    socials: structuredClone(doc.socials),
    photo: meta ? { meta, crop: { ...doc.images.photo.crop }, shape: doc.images.photo.shape } : undefined,
    updatedAt: Date.now(),
  };
}

const key = (p: Pick<Profile, "details" | "socials" | "photo">) =>
  JSON.stringify([p.details, p.socials.map((s) => [s.platform, s.url]), p.photo ? [p.photo.meta.id, p.photo.crop, p.photo.shape] : null]);

export const sameProfile = (a: Pick<Profile, "details" | "socials" | "photo">, b: Pick<Profile, "details" | "socials" | "photo">) => key(a) === key(b);

/** Untouched sample content isn't the user's — never save it as their profile. */
export function isSampleOnly(p: Pick<Profile, "details" | "photo">): boolean {
  const d = p.details;
  return !p.photo && d.name === SAMPLE_DETAILS.name && d.email === SAMPLE_DETAILS.email && d.phone === SAMPLE_DETAILS.phone;
}

/** Copy the profile into a signature (mutates; use on a draft or a fresh copy). */
export function applyProfile(doc: SignatureDoc, p: Profile): void {
  doc.details = structuredClone(p.details);
  doc.socials = structuredClone(p.socials);
  if (p.photo) {
    doc.assets[p.photo.meta.id] = p.photo.meta;
    doc.images.photo = { ...doc.images.photo, assetId: p.photo.meta.id, crop: { ...p.photo.crop }, shape: p.photo.shape };
  } else {
    doc.images.photo = { ...doc.images.photo, assetId: undefined };
  }
}
