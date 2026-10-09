/** Local persistence (IndexedDB): signatures, uploaded images, preferences. */
import { createStore, del, entries, get, set, type UseStore } from "idb-keyval";
import type { SignatureDoc } from "../core/types";

let stores: { docs: UseStore; assets: UseStore; prefs: UseStore } | null = null;
const db = () =>
  (stores ??= {
    docs: createStore("ss3-docs", "docs"),
    assets: createStore("ss3-assets", "assets"),
    prefs: createStore("ss3-prefs", "prefs"),
  });

export const docStore = {
  async list(): Promise<SignatureDoc[]> {
    return (await entries<string, SignatureDoc>(db().docs)).map(([, d]) => d).sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get: (id: string) => get<SignatureDoc>(id, db().docs).then((d) => d ?? null),
  put: (doc: SignatureDoc) => set(doc.id, doc, db().docs),
  remove: (id: string) => del(id, db().docs),
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
}

export const DEFAULT_PREFS: Prefs = { publishConsent: false, favorites: [] };

export const prefStore = {
  async get(): Promise<Prefs> {
    return { ...DEFAULT_PREFS, ...((await get<Prefs>("prefs", db().prefs)) ?? {}) };
  },
  put: (p: Prefs) => set("prefs", p, db().prefs),
};
