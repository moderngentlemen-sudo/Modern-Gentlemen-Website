/**
 * Document service — reading and saving drafts.
 *
 * Every entry point calls `requirePermission()` first. RLS refuses the write
 * anyway; this layer exists so the admin can show "you cannot edit templates"
 * instead of an opaque Postgres denial, and so the intent is visible in the
 * code rather than only in a policy.
 *
 * Writes go through `lib/db/server.ts` — the editor's own session — never the
 * service-role client.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/documents";
import { autosaveDocument, latestRevision } from "@/lib/db/repositories/revisions";
import { createPage as createPageRow, EMPTY_PAGE_PAYLOAD } from "@/lib/db/repositories/pages";
import type { Json } from "@/lib/db/database.types";
import { validateTree, type BlockIssue } from "@/lib/blocks/validate";
import type { BlockNode } from "@/lib/blocks/types";
import {
  BLOCK_TREE_KEY,
  shouldWriteAutosaveRevision,
  type DocumentType,
} from "@/lib/domain/documents";
import type { Permission } from "@/lib/domain/permissions";
import { requirePermission } from "./auth";

export type DocumentAction = "read" | "write" | "publish" | "delete";

/**
 * `page.read`, `template.publish`, and so on. The permission vocabulary in
 * `lib/domain/permissions.ts` uses exactly this `resource.action` shape, so the
 * template literal lands inside the `Permission` union rather than needing a
 * cast.
 */
export function permissionFor(type: DocumentType, action: DocumentAction): Permission {
  return `${type}.${action}`;
}

/**
 * Every block tree inside a payload, with the path it sits at.
 *
 * Pages and articles keep one ordered list under `sections`; patterns keep
 * theirs under `blocks`. Templates are the odd one out — named areas, each its
 * own tree — so returning a list rather than a single tree is what lets
 * validation cover them without a special case at every call site.
 */
export function blockTreesOf(
  type: DocumentType,
  payload: Json
): { path: string; tree: BlockNode[] }[] {
  const root = (payload ?? {}) as Record<string, unknown>;

  const key = BLOCK_TREE_KEY[type];
  if (key) {
    const value = root[key];
    return Array.isArray(value) ? [{ path: key, tree: value as BlockNode[] }] : [];
  }

  // Templates: { areas: { header: BlockNode[], main: BlockNode[], ... } }
  const areas = root.areas;
  if (!areas || typeof areas !== "object") return [];

  return Object.entries(areas as Record<string, unknown>)
    .filter(([, tree]) => Array.isArray(tree))
    .map(([name, tree]) => ({ path: `areas.${name}`, tree: tree as BlockNode[] }));
}

export interface DocumentValidation {
  ok: boolean;
  issues: (BlockIssue & { path: string })[];
}

/**
 * Runs Phase 2's block validation over every tree in a payload.
 *
 * This is what publish validation is for: a page whose hero has lost its
 * headline should be refused at publish time, while the editor is still looking
 * at it, rather than rendering a gap on the live site.
 */
export function validateDocumentPayload(type: DocumentType, payload: Json): DocumentValidation {
  const issues: (BlockIssue & { path: string })[] = [];

  for (const { path, tree } of blockTreesOf(type, payload)) {
    for (const issue of validateTree(tree).issues) {
      issues.push({ ...issue, path: issue.path ? `${path}.${issue.path}` : path });
    }
  }

  return { ok: issues.length === 0, issues };
}

/** Raised when a caller tries to publish a payload that fails its own manifests. */
export class InvalidDocumentError extends Error {
  constructor(readonly issues: (BlockIssue & { path: string })[]) {
    super(
      `Document has ${issues.length} validation ${issues.length === 1 ? "issue" : "issues"}: ` +
        issues.map((i) => `${i.path} — ${i.message}`).join("; ")
    );
    this.name = "InvalidDocumentError";
  }
}

export async function getDocument(type: DocumentType, id: string) {
  await requirePermission(permissionFor(type, "read"));
  const db = await createClient();
  return repo.getDocument(db, type, id);
}

export async function getDocumentBySlug(type: DocumentType, slug: string) {
  await requirePermission(permissionFor(type, "read"));
  const db = await createClient();
  return repo.getDocumentBySlug(db, type, slug);
}

export async function listDocuments(type: DocumentType, options: repo.ListOptions = {}) {
  await requirePermission(permissionFor(type, "read"));
  const db = await createClient();
  return repo.listDocuments(db, type, options);
}

/**
 * Saves the draft payload, and takes an autosave checkpoint when the last
 * revision is old enough.
 *
 * A draft save deliberately does **not** validate. An editor mid-edit is
 * routinely holding an incomplete block, and refusing to save their work
 * because of it would lose that work. Validation belongs at publish.
 */
export async function saveDraft(
  type: DocumentType,
  id: string,
  payload: Json,
  { now = new Date() }: { now?: Date } = {}
): Promise<void> {
  const user = await requirePermission(permissionFor(type, "write"));
  const db = await createClient();

  const current = await repo.getDocument(db, type, id);
  if (!current) throw new Error(`No such ${type}: ${id}`);

  const previous = await latestRevision(db, type, id);
  const lastAt = previous ? new Date(previous.created_at) : null;

  if (shouldWriteAutosaveRevision(lastAt, now)) {
    // Checkpoints what is being replaced, not what is arriving: the incoming
    // payload will be captured by the next checkpoint or by the publish. Must
    // run before the write below, since it reads the draft it is preserving.
    await autosaveDocument(db, type, id);
  }

  await repo.saveDraft(db, type, id, payload, user.id);
}

export async function createPage(input: { slug: string; title: string; templateId?: string }) {
  const user = await requirePermission("page.write");
  const db = await createClient();

  return createPageRow(db, {
    slug: input.slug,
    title: input.title,
    templateId: input.templateId ?? null,
    draftData: EMPTY_PAGE_PAYLOAD,
    createdBy: user.id,
  });
}

export async function deleteDocument(type: DocumentType, id: string): Promise<void> {
  await requirePermission(permissionFor(type, "delete"));
  const db = await createClient();
  // `is_system` pages are additionally protected by their RLS delete policy.
  await repo.deleteDocument(db, type, id);
}
