/**
 * Runs one sync between this device and the account, following `planSync`.
 * Storage is passed in (`LocalSide`), so the whole thing is tested against
 * the in-memory cloud without a browser database.
 *
 * Images travel too: each asset a signature uses is uploaded once, by content
 * hash, to the user's own folder (`o/<sha256>`), and downloaded on devices
 * that don't have it yet.
 */
import type { SignatureDoc } from "../core/types";
import { uid } from "../lib/id";
import type { CloudApi } from "./api";
import { docHash, planSync, quickHash, stableStringify, SYNCED_PREFS, type Base } from "./plan";

export interface SyncState {
  docs: Record<string, Base>;
  /** Hash of each synced preference at the last sync. */
  prefs?: Record<string, string>;
  /** Asset hashes already uploaded. */
  files: string[];
}

export const emptySyncState = (): SyncState => ({ docs: {}, files: [] });

export interface LocalSide {
  listDocs(): Promise<SignatureDoc[]>;
  putDoc(doc: SignatureDoc): Promise<void>;
  removeDoc(id: string): Promise<void>;
  getAsset(id: string): Promise<Blob | null>;
  putAsset(id: string, blob: Blob): Promise<void>;
  getState(): Promise<SyncState>;
  putState(s: SyncState): Promise<void>;
  getPrefs(): Record<string, unknown>;
  setPrefs(p: Record<string, unknown>): void;
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  deleted: number;
  /** Names of copies made to keep both sides of a conflict. */
  conflicts: string[];
  /** Signatures written locally (new or changed) — the caller refreshes the UI. */
  changed: SignatureDoc[];
  removed: string[];
}

const ASSET_MIME = ["image/png", "image/jpeg", "image/gif"];

export async function runSync(api: CloudApi, local: LocalSide): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, deleted: 0, conflicts: [], changed: [], removed: [] };
  const state = await local.getState();
  const docs = await local.listDocs();
  const byId = new Map(docs.map((d) => [d.id, d]));
  const hashes = new Map(docs.map((d) => [d.id, docHash(d)]));
  const remote = await api.listMeta();
  const actions = planSync(hashes, remote, state.docs);

  const uploadAssets = async (doc: SignatureDoc) => {
    for (const a of Object.values(doc.assets)) {
      if (state.files.includes(a.hash) || !ASSET_MIME.includes(a.mime)) continue;
      const blob = await local.getAsset(a.id);
      if (!blob) continue;
      await api.upload(`o/${a.hash}`, blob, a.mime);
      state.files.push(a.hash);
    }
  };
  const downloadAssets = async (doc: SignatureDoc) => {
    for (const a of Object.values(doc.assets)) {
      if (await local.getAsset(a.id)) continue;
      const blob = await api.download(`o/${a.hash}`);
      if (blob) await local.putAsset(a.id, blob);
    }
  };
  const save = async (doc: SignatureDoc, revision: number) => {
    await downloadAssets(doc);
    await local.putDoc(doc);
    state.docs[doc.id] = { revision, hash: docHash(doc) };
    report.changed.push(doc);
  };

  // Download everything we need in one request.
  const needRemote = actions.filter((a) => a.kind === "pull" || a.kind === "conflict").map((a) => a.id);
  const fetched = new Map((await api.fetchDocs(needRemote)).map((r) => [r.id, r]));

  for (const a of actions) {
    const doc = byId.get(a.id);
    switch (a.kind) {
      case "push-new": {
        await uploadAssets(doc!);
        const r = await api.insertDoc(doc!);
        if (r.ok) {
          state.docs[a.id] = { revision: r.revision, hash: hashes.get(a.id)! };
          report.pushed++;
        }
        break;
      }
      case "push": {
        await uploadAssets(doc!);
        const r = await api.updateDoc(a.id, a.expected, doc!, false);
        // A stale revision means someone wrote in between: the next sync sees a conflict.
        if (r.ok) {
          state.docs[a.id] = { revision: r.revision, hash: hashes.get(a.id)! };
          report.pushed++;
        }
        break;
      }
      case "pull": {
        const r = fetched.get(a.id);
        if (r && !r.deleted) {
          await save(r.doc, r.revision);
          report.pulled++;
        }
        break;
      }
      case "delete-remote": {
        const r = await api.updateDoc(a.id, a.expected, null, true);
        if (r.ok) {
          delete state.docs[a.id];
          report.deleted++;
        }
        break;
      }
      case "delete-local":
        await local.removeDoc(a.id);
        delete state.docs[a.id];
        report.removed.push(a.id);
        report.deleted++;
        break;
      case "forget":
        delete state.docs[a.id];
        break;
      case "conflict": {
        const r = fetched.get(a.id);
        if (!r) break;
        if (docHash(r.doc) === hashes.get(a.id)) {
          state.docs[a.id] = { revision: r.revision, hash: hashes.get(a.id)! };
          break;
        }
        // Keep both: this device's version becomes a copy, the cloud version takes the original's place.
        const copy: SignatureDoc = {
          ...doc!,
          id: uid("sig"),
          name: `${doc!.name} (this device)`,
          updatedAt: Date.now(),
          cardSlug: undefined,
          digitalCardUrl: undefined,
        };
        await local.putDoc(copy);
        await uploadAssets(copy);
        const ins = await api.insertDoc(copy);
        if (ins.ok) state.docs[copy.id] = { revision: ins.revision, hash: docHash(copy) };
        report.changed.push(copy);
        report.conflicts.push(copy.name);
        if (r.deleted) {
          await local.removeDoc(a.id);
          delete state.docs[a.id];
          report.removed.push(a.id);
        } else await save(r.doc, r.revision);
        break;
      }
    }
  }

  await syncPrefs(api, local, state);
  await local.putState(state);
  return report;
}

/**
 * Preferences merge key by key (profile, brand kit, my templates, favourites):
 * whichever side changed a key since the last sync wins it; if both did, this
 * device wins. The first sync takes the cloud's value where it has one.
 */
async function syncPrefs(api: CloudApi, local: LocalSide, state: SyncState) {
  const mine = local.getPrefs();
  const theirs = await api.getPrefs();
  const h = (v: unknown) => (v === undefined ? "" : quickHash(stableStringify(v)));
  const base = state.prefs ?? {};
  const result: Record<string, unknown> = {};
  for (const k of SYNCED_PREFS) {
    const localChanged = h(mine[k]) !== (base[k] ?? "");
    const remoteChanged = h(theirs[k]) !== (base[k] ?? "");
    const first = state.prefs === undefined;
    const v = first ? (theirs[k] ?? mine[k]) : localChanged ? mine[k] : remoteChanged ? theirs[k] : mine[k];
    if (v !== undefined) result[k] = v;
  }
  const same = (p: Record<string, unknown>) => SYNCED_PREFS.every((k) => h(p[k]) === h(result[k]));
  if (!same(theirs)) {
    // Keep any keys a newer app version stores, but take ours for the synced ones (removals included).
    const out = Object.fromEntries(Object.entries(theirs).filter(([k]) => !(SYNCED_PREFS as readonly string[]).includes(k)));
    await api.putPrefs({ ...out, ...result });
  }
  if (!same(mine)) local.setPrefs(result);
  state.prefs = Object.fromEntries(SYNCED_PREFS.map((k) => [k, h(result[k])]));
}
