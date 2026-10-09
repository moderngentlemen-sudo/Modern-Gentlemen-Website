/** Local persistence (IndexedDB): signatures, uploaded images, preferences. */
import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { BrandKit, SignatureDoc } from "../core/types";
import type { Profile } from "../core/profile";
import type { SavedTemplate } from "../core/myTemplates";
import type { Version } from "../core/versions";

let stores: { docs: UseStore; assets: UseStore; prefs: UseStore; versions: UseStore } | null = null;
const db = () =>
  (stores ??= {
    docs: createStore("ss3-docs", "docs"),
    assets: createStore("ss3-assets", "assets"),
    prefs: createStore("ss3-prefs", "prefs"),
    versions: createStore("ss3-versions", "versions"),
  });

export const docStore = {
  async list(): Promise<SignatureDoc[]> {
    return (await entries<string, SignatureDoc>(db().docs)).map(([, d]) => d).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get: (id: string) => get<SignatureDoc>(id, db().docs).then((d) => d ?? null),
  put: (doc: SignatureDoc) => set(doc.id, doc, db().docs),
  remove: (id: string) => del(id, db().docs),
};

/** Version history, one list per signature (newest first). */
export const versionStore = {
  list: (docId: string) => get<Version[]>(docId, db().versions).then((v) => v ?? []),
  put: (docId: string, list: Version[]) => set(docId, list, db().versions),
  remove: (docId: string) => del(docId, db().versions),
};

export const assetStore = {
  put: (id: string, blob: Blob) => set(id, blob, db().assets),
  get: (id: string) => get<Blob>(id, db().assets).then((b) => b ?? null),
};

export interface Prefs {
  host?: { endpoint: string; token?: string };
  publishConsent: boolean;
  favorites: string[];
  lastDocId?: string;
  brand?: BrandKit;
  /** Saved contact information shared by linked signatures. */
  profile?: Profile;
  /** Designs saved for reuse. */
  myTemplates?: SavedTemplate[];
}

export const DEFAULT_PREFS: Prefs = { publishConsent: false, favorites: [] };

export const prefStore = {
  async get(): Promise<Prefs> {
    return { ...DEFAULT_PREFS, ...((await get<Prefs>("prefs", db().prefs)) ?? {}) };
  },
  put: (p: Prefs) => set("prefs", p, db().prefs),
};
