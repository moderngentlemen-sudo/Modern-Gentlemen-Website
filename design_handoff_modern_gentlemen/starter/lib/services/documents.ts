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
import { RepositoryError } from "@/lib/db/repositories/errors";
import type { Json } from "@/lib/db/database.types";
import { validateTree, type BlockIssue } from "@/lib/blocks/validate";
import { AREAS_KEY, readAreas } from "@/lib/blocks/areas";
import {
  collectContentMarkers,
  DOCUMENT_CONTENT_TYPE,
  TEMPLATE_SEED_AREA,
} from "@/lib/blocks/templateContent";
import type { BlockNode } from "@/lib/blocks/types";
import {
  BLOCK_TREE_KEY,
  canTransition,
  InvalidTransitionError,
  shouldWriteAutosaveRevision,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/domain/documents";
import type { Permission } from "@/lib/domain/permissions";
import { requirePermission } from "./auth";
import { clearEntityMedia, reconcileEntityMedia } from "./media";

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

  if (type === "template") issues.push(...validateTemplateAreas(payload));

  return { ok: issues.length === 0, issues };
}

/**
 * A template needs exactly one `documentContent` marker, anywhere in it.
 *
 * Both failures are silent at authoring time and destructive at render time,
 * which is precisely the class publish validation exists to catch:
 *
 *   * **No marker** — the template frames nothing, so every page assigned to it
 *     loses its own sections. `applyTemplate` refuses to do that (it returns
 *     the document's sections when there is no marker), so what an editor would
 *     actually see is a template that appears to do nothing at all — harder to
 *     diagnose than a failure.
 *   * **Two markers** — the page's sections render twice, and with more than
 *     one area holding one, *which* area renders becomes arbitrary.
 *
 * ⚠️ **There is deliberately no rule about *which* area holds it.** An earlier
 * version required `main`, and the templates E2E found the flaw immediately: it
 * renames the only area to `body`, and a name-based rule turned that ordinary
 * edit into an unpublishable document. `findContentArea` keys the renderer on
 * the marker instead, so area names are cosmetic and a rename is harmless.
 *
 * It reads the payload directly rather than through `blockTreesOf`, because the
 * marker's *area* is what the count has to span and `blockTreesOf` has already
 * flattened that into a path string by the time a caller sees it.
 */
function validateTemplateAreas(payload: Json): (BlockIssue & { path: string })[] {
  const areas = readAreas(payload);
  const markers = Object.entries(areas).flatMap(([name, tree]) =>
    collectContentMarkers(tree).map((key) => ({ area: name, key }))
  );

  if (markers.length === 0) {
    return [
      {
        key: "",
        type: DOCUMENT_CONTENT_TYPE,
        path: `${AREAS_KEY}.${TEMPLATE_SEED_AREA}`,
        message:
          "A template needs a Page content block — without one, every page using " +
          "it would lose its own sections.",
      },
    ];
  }

  if (markers.length > 1) {
    return [
      {
        key: markers[1].key,
        type: DOCUMENT_CONTENT_TYPE,
        path: `${AREAS_KEY}.${markers[1].area}`,
        message: `A template needs exactly one Page content block; this one has ${markers.length}.`,
      },
    ];
  }

  return [];
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

  // Usage tracking is derived data, and it must never be what loses an editor
  // their work. A save that succeeded has succeeded; if reconciliation fails,
  // the previous rows stay, the library is briefly over-cautious about deleting
  // an asset, and the next save corrects it. The same reasoning as the
  // insert-before-delete ordering in the repository — every failure mode here
  // is arranged to leave a stale reference rather than a missing one.
  try {
    await reconcileEntityMedia(type, id, blockTreesOf(type, payload));
  } catch (error) {
    console.error(`Media usage reconciliation failed for ${type} ${id}:`, error);
  }
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

  // `media_usages.entity_id` has no foreign key — it is polymorphic by design
  // (0002) — so nothing in the database notices that this document is gone.
  // Left behind, its usage rows would keep every asset it referenced
  // permanently undeletable, blocked by a page that no longer exists. Ordered
  // after the delete so a refused delete leaves the records intact.
  try {
    await clearEntityMedia(type, id);
  } catch (error) {
    console.error(`Could not clear media usages for the deleted ${type} ${id}:`, error);
  }
}

/**
 * Rename a page, or move it to a new slug.
 *
 * `slug` is unique, so a collision comes back from Postgres as 23505. Left
 * alone that reaches an editor as a raw constraint string; translated here it
 * reads as the thing they actually did.
 */
export async function renamePage(
  id: string,
  input: { slug?: string; title?: string }
): Promise<void> {
  await renameDocument("page", id, input);
}

/**
 * Rename any document — title, slug, or both.
 *
 * The generic form `renamePage` should always have been. A pattern's name and
 * key were fixed at creation because this did not exist and the page-specific
 * version could not be pointed at another table; getting one wrong meant delete
 * and recreate, losing the revision history with it.
 *
 * Two things it deliberately keeps from the page version:
 *
 *   * **the permission is `<type>.write`**, resolved through `permissionFor`
 *     like every other generic operation here, so a rename is exactly as
 *     privileged as an edit;
 *   * **`23505` is translated.** Every document table has a unique slug column,
 *     so a collision arrives as a raw Postgres constraint string. Named here, it
 *     reads as the thing the editor actually did — and it names the *slug's own
 *     word*, because a pattern has a key rather than a slug and being told "that
 *     slug is taken" about a field labelled Key is its own small confusion.
 */
const SLUG_NOUN: Record<DocumentType, string> = {
  page: "slug",
  article: "slug",
  product: "slug",
  category: "slug",
  template: "key",
  pattern: "key",
};

export async function renameDocument(
  type: DocumentType,
  id: string,
  input: { slug?: string; title?: string }
): Promise<void> {
  const user = await requirePermission(permissionFor(type, "write"));
  const db = await createClient();

  try {
    await repo.renameDocument(db, type, id, { ...input, updatedBy: user.id });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "23505") {
      const noun = SLUG_NOUN[type];
      throw new Error(`The ${noun} "${input.slug}" is already in use by another ${type}.`);
    }
    throw error;
  }
}

/**
 * Move a document between statuses that publishing does not own.
 *
 * Publishing, unpublishing and scheduling all go through the SQL functions in
 * `lib/services/publishing.ts`, which write a revision and an audit event in the
 * same transaction. This is for the rest — archiving, and bringing an archived
 * document back to draft — and it enforces `canTransition` so the status field
 * cannot be walked into a state the domain does not allow.
 */
export async function setDocumentStatus(
  type: DocumentType,
  id: string,
  status: DocumentStatus
): Promise<void> {
  const user = await requirePermission(permissionFor(type, "write"));
  const db = await createClient();

  const current = await repo.getDocument(db, type, id);
  if (!current) throw new Error(`No such ${type}: ${id}`);

  if (!canTransition(current.status, status)) {
    throw new InvalidTransitionError(current.status, status);
  }

  await repo.setStatus(db, type, id, status, user.id);
}
