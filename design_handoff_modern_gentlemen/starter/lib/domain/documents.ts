/**
 * The document model — pure vocabulary and rules, no I/O.
 *
 * A "document" is any entity carrying the versioning convention introduced in
 * `0003_content_spine.sql`: `draft_data` / `published_data` / `version` /
 * `status`. Pages, templates, patterns and articles all do, which is why one
 * polymorphic `revisions` table serves all four and this logic is written once.
 *
 * Everything here mirrors a constraint that actually exists in the database.
 * Where the two could drift, the database wins — these are a fast, typed
 * pre-check that produces a good error message, not the enforcement.
 */

export const DOCUMENT_TYPES = ["page", "template", "pattern", "article"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = ["draft", "published", "scheduled", "archived"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** `revisions.reason` — the CHECK constraint in `0008_versioning_and_preview.sql`. */
export const REVISION_REASONS = ["autosave", "publish", "snapshot", "restore"] as const;
export type RevisionReason = (typeof REVISION_REASONS)[number];

/** `publish_events.action` — same migration. */
export const PUBLISH_ACTIONS = ["publish", "unpublish", "schedule", "rollback", "restore"] as const;
export type PublishAction = (typeof PUBLISH_ACTIONS)[number];

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Scheduling needs both a `scheduled_for` column and a 'scheduled' status.
 * Only pages and articles have them — mirrors `schedulable_document_table()`.
 */
export const SCHEDULABLE_TYPES = ["page", "article"] as const satisfies readonly DocumentType[];

export function isSchedulable(type: DocumentType): boolean {
  return (SCHEDULABLE_TYPES as readonly DocumentType[]).includes(type);
}

/**
 * `patterns.status` is checked against ('draft','published','archived') — it has
 * no 'scheduled'. Offering it in a UI would produce a constraint violation on
 * save rather than a clear refusal.
 */
export function statusesFor(type: DocumentType): DocumentStatus[] {
  return DOCUMENT_STATUSES.filter((status) => status !== "scheduled" || isSchedulable(type));
}

/**
 * Where a type's payload keeps its ordered block tree.
 *
 * Deliberately a key rather than an extractor: `lib/domain` is a leaf and does
 * not know about `BlockNode`. Callers that hold both do the extraction.
 * Templates are `null` because they keep named areas
 * (`{ areas: Record<string, BlockNode[]> }`), not one ordered list.
 */
export const BLOCK_TREE_KEY = {
  page: "sections",
  article: "sections",
  pattern: "blocks",
  template: null,
} as const satisfies Record<DocumentType, string | null>;

/**
 * Legal status moves.
 *
 * `archived` deliberately cannot go straight to `published`: bringing something
 * back means reopening it as a draft and looking at it first. A same-to-same
 * move is legal — re-publishing a published page is the ordinary way to ship an
 * edit.
 */
const TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["draft", "published", "scheduled", "archived"],
  published: ["published", "draft", "scheduled", "archived"],
  scheduled: ["scheduled", "published", "draft", "archived"],
  archived: ["archived", "draft"],
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Thrown by services before they reach the database, so the error names both ends. */
export class InvalidTransitionError extends Error {
  constructor(
    readonly from: DocumentStatus,
    readonly to: DocumentStatus
  ) {
    super(`A ${from} document cannot become ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

/**
 * One counter, advanced by every operation that writes a revision — publish,
 * snapshot and restore. `revisions` is unique on (entity_type, entity_id,
 * version), so an operation that wrote history without advancing it would
 * collide with whatever already claimed that number. See the `0010` header.
 */
export function nextVersion(current: number): number {
  if (!Number.isInteger(current) || current < 0) {
    throw new RangeError(`Version must be a non-negative integer, received ${current}`);
  }
  return current + 1;
}

/** A document that has never been published has version 0 and no published payload. */
export function isPublished(status: DocumentStatus, publishedData: unknown): boolean {
  return status === "published" && publishedData !== null && publishedData !== undefined;
}

export const AUTOSAVE_REVISION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Whether a draft save should also write an `autosave` revision.
 *
 * Every keystroke writing history would bury the publishes an editor actually
 * cares about under thousands of rows. Throttling by age keeps autosave history
 * useful — roughly one checkpoint per five minutes of active editing — and the
 * first save on a document with no history always takes one.
 */
export function shouldWriteAutosaveRevision(
  lastRevisionAt: Date | null,
  now: Date,
  intervalMs: number = AUTOSAVE_REVISION_INTERVAL_MS
): boolean {
  if (lastRevisionAt === null) return true;
  return now.getTime() - lastRevisionAt.getTime() >= intervalMs;
}
