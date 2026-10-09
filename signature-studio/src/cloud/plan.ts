/**
 * Sync planning — pure, so every case is unit-tested.
 *
 * For each signature we know three things: the local copy (as a content
 * hash), the cloud row (revision + deleted flag) and what both looked like at
 * the last successful sync (`base`). Comparing local with the base says
 * whether this device changed it; comparing the cloud revision with the base
 * says whether another device did. Both changed = conflict, which is never
 * resolved by throwing work away (see `sync.ts`).
 */
import type { SignatureDoc } from "../core/types";
import type { RemoteMeta } from "./api";

export interface Base {
  revision: number;
  hash: string;
}

export type Action =
  | { kind: "push-new"; id: string }
  | { kind: "push"; id: string; expected: number }
  | { kind: "pull"; id: string }
  | { kind: "delete-remote"; id: string; expected: number }
  | { kind: "delete-local"; id: string }
  | { kind: "forget"; id: string }
  | { kind: "conflict"; id: string };

export function planSync(local: Map<string, string>, remote: RemoteMeta[], base: Record<string, Base>): Action[] {
  const out: Action[] = [];
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const ids = new Set([...local.keys(), ...remoteById.keys(), ...Object.keys(base)]);
  for (const id of ids) {
    const L = local.get(id);
    const R = remoteById.get(id);
    const B = base[id];
    if (!R) {
      // Not in the cloud (never uploaded, or removed there entirely): upload rather than lose it.
      if (L !== undefined) out.push({ kind: "push-new", id });
      else if (B) out.push({ kind: "forget", id });
      continue;
    }
    if (R.deleted) {
      if (L === undefined) {
        if (B) out.push({ kind: "forget", id });
      } else if (B && B.hash === L && B.revision !== R.revision) {
        // Deleted on another device, untouched here: delete here too.
        out.push({ kind: "delete-local", id });
      } else {
        // Edited here (or brought back): keep it, and undelete it in the cloud.
        out.push({ kind: "push", id, expected: R.revision });
      }
      continue;
    }
    if (L === undefined) {
      // Deleted here. An edit made elsewhere since the last sync wins over the delete.
      if (B && B.revision === R.revision) out.push({ kind: "delete-remote", id, expected: R.revision });
      else out.push({ kind: "pull", id });
      continue;
    }
    if (!B) {
      out.push({ kind: "conflict", id });
      continue;
    }
    const localChanged = B.hash !== L;
    const remoteChanged = B.revision !== R.revision;
    if (localChanged && remoteChanged) out.push({ kind: "conflict", id });
    else if (localChanged) out.push({ kind: "push", id, expected: R.revision });
    else if (remoteChanged) out.push({ kind: "pull", id });
  }
  return out;
}

/** JSON with sorted keys, so equal content always hashes the same. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Content hash of a signature, ignoring the save timestamp. Small and fast (FNV-1a, 2 × 32 bit). */
export function docHash(doc: SignatureDoc): string {
  return quickHash(stableStringify({ ...doc, updatedAt: 0 }));
}

export function quickHash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

/** Preferences that follow the account. Image-host settings stay on the device (they can hold a key). */
export const SYNCED_PREFS = ["profile", "brand", "myTemplates", "favorites"] as const;
