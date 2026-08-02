/**
 * Revision history — reading it, and comparing two points in it.
 *
 * Writing history is not here: the revisions that accompany a publish, a
 * snapshot or a restore are written inside `0010`'s transactional functions, in
 * the same transaction as the change they record.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/revisions";
import * as documents from "@/lib/db/repositories/documents";
import type { Json } from "@/lib/db/database.types";
import { diffBlockTrees, summariseDiff, type BlockTreeDiff } from "@/lib/blocks/diff";
import type { BlockNode } from "@/lib/blocks/types";
import type { DocumentType } from "@/lib/domain/documents";
import { requirePermission } from "./auth";
import { blockTreesOf } from "./documents";

export type { RevisionSummary, PublishEventRow } from "@/lib/db/repositories/revisions";

export async function listHistory(type: DocumentType, id: string, limit = 50) {
  await requirePermission("revision.read");
  const db = await createClient();
  return repo.listRevisions(db, type, id, limit);
}

export async function getRevision(type: DocumentType, id: string, version: number) {
  await requirePermission("revision.read");
  const db = await createClient();
  return repo.getRevision(db, type, id, version);
}

/** The publish/unpublish/rollback trail — "who changed the homepage on Friday?". */
export async function listPublishEvents(type: DocumentType, id: string, limit = 50) {
  await requirePermission("revision.read");
  const db = await createClient();
  return repo.listPublishEvents(db, type, id, limit);
}

export interface VersionComparison {
  /** One entry per block tree in the payload — several for a template's areas. */
  trees: { path: string; diff: BlockTreeDiff; summary: string }[];
  summary: string;
}

/**
 * Compares two versions block by block.
 *
 * `to` defaults to the live draft, because "what have I changed since the last
 * publish?" is the question asked far more often than any comparison between
 * two historical versions.
 */
export async function compareVersions(
  type: DocumentType,
  id: string,
  fromVersion: number,
  toVersion?: number
): Promise<VersionComparison> {
  await requirePermission("revision.read");
  const db = await createClient();

  const before = await repo.getRevision(db, type, id, fromVersion);
  if (!before) throw new Error(`No revision ${fromVersion} for ${type} ${id}`);

  const after = await loadPayload(db, type, id, toVersion);

  const beforeTrees = new Map(blockTreesOf(type, before.data).map((t) => [t.path, t.tree]));
  const afterTrees = new Map(blockTreesOf(type, after).map((t) => [t.path, t.tree]));

  const paths = [...new Set([...beforeTrees.keys(), ...afterTrees.keys()])].sort();

  const trees = paths.map((path) => {
    const diff = diffBlockTrees(beforeTrees.get(path), afterTrees.get(path));
    return { path, diff, summary: summariseDiff(diff) };
  });

  const total: BlockTreeDiff = {
    added: trees.flatMap((t) => t.diff.added),
    removed: trees.flatMap((t) => t.diff.removed),
    changed: trees.flatMap((t) => t.diff.changed),
    moved: trees.flatMap((t) => t.diff.moved),
    unchanged: trees.flatMap((t) => t.diff.unchanged),
  };

  return { trees, summary: summariseDiff(total) };
}

async function loadPayload(
  db: Awaited<ReturnType<typeof createClient>>,
  type: DocumentType,
  id: string,
  version?: number
): Promise<Json> {
  if (version === undefined) {
    const current = await documents.getDocument(db, type, id);
    if (!current) throw new Error(`No such ${type}: ${id}`);
    return current.draft_data;
  }

  const revision = await repo.getRevision(db, type, id, version);
  if (!revision) throw new Error(`No revision ${version} for ${type} ${id}`);
  return revision.data;
}

/** Convenience for a history list: how each revision differs from the one before it. */
export function diffTrees(
  before: BlockNode[] | undefined,
  after: BlockNode[] | undefined
): BlockTreeDiff {
  return diffBlockTrees(before, after);
}
