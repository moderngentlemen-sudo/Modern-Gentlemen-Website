/**
 * Version history: named snapshots of one signature. Pure list operations;
 * storage lives in `storage/db.ts`.
 */
import type { SignatureDoc } from "./types";

export interface Version {
  id: string;
  name: string;
  at: number;
  /** Taken automatically (e.g. before a restore) rather than by the user. */
  auto?: boolean;
  doc: SignatureDoc;
}

/** Most kept per signature. Automatic snapshots are dropped first. */
export const MAX_VERSIONS = 30;

/** Add a snapshot (newest first), pruning the oldest automatic ones, then the oldest of any kind. */
export function addVersion(list: Version[], v: Version, max = MAX_VERSIONS): Version[] {
  const next = [v, ...list];
  while (next.length > max) {
    const autoIdx = next.map((x) => !!x.auto).lastIndexOf(true);
    next.splice(autoIdx > 0 ? autoIdx : next.length - 1, 1);
  }
  return next;
}

/** Fields a restore never brings back: identity and what's live in people's inboxes. */
const KEEP: (keyof SignatureDoc)[] = ["id", "createdAt", "published", "digitalCardUrl"];

/** Make `target` (an Immer draft) match the snapshot, keeping identity and publishing state. */
export function restoreInto(target: SignatureDoc, snap: SignatureDoc) {
  const t = target as unknown as Record<string, unknown>;
  const s = snap as unknown as Record<string, unknown>;
  for (const k of Object.keys(t)) if (!(k in s) && !KEEP.includes(k as keyof SignatureDoc)) delete t[k];
  for (const [k, v] of Object.entries(s)) if (!KEEP.includes(k as keyof SignatureDoc)) t[k] = structuredClone(v);
}

/** A default name like "Version 3 · 9 Oct, 14:05". */
export function defaultVersionName(count: number, at = Date.now()): string {
  const when = new Date(at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `Version ${count + 1} · ${when}`;
}
