/**
 * Sources, mappings, import runs and their staged items.
 *
 * Four tables that `0005` and `0006` built two phases before anything wrote to
 * them. Nothing here is a document — an import run has no draft, no version and
 * no revision history, and it is not on `document_table()`'s allowlist — so this
 * file talks to PostgREST directly rather than through the publishing RPCs. The
 * run *log* is the history, which is what `import_jobs` is for.
 *
 * Client-first like every other repository, so the caller decides whether RLS
 * applies. In practice the caller is always `lib/services/ingestion.ts` passing
 * the editor's own session: an import writes products, and the standing rule
 * that admin writes go through the editor's session against RLS applies to a
 * write made on their behalf by a feed exactly as it does to one they typed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ImportItemAction,
  ImportItemStatus,
  ImportJobStatus,
  ImportTrigger,
  ProductSourceKind,
  SourceSyncStatus,
} from "@/lib/domain/ingestion";
import type { Database, Json } from "../database.types";
import { unwrap } from "./errors";

type Db = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export interface ProductSourceRow {
  id: string;
  kind: ProductSourceKind;
  name: string;
  enabled: boolean;
  config: Json;
  credentials_ref: string | null;
  sync_schedule: string | null;
  last_synced_at: string | null;
  last_status: SourceSyncStatus | null;
  created_at: string;
  updated_at: string;
}

const SOURCE_COLUMNS =
  "id, kind, name, enabled, config, credentials_ref, sync_schedule, " +
  "last_synced_at, last_status, created_at, updated_at";

/**
 * The three list queries here go through `unknown` on their way to a row type,
 * which the other repositories do not need to do.
 *
 * The reason is a limit in `@supabase/postgrest-js`, not a looser standard: it
 * parses the select string *in the type system*, and past roughly a dozen
 * columns the parse gives up and widens the result to `GenericStringError[]`.
 * A single-row `.maybeSingle()` on the same string is unaffected, which is why
 * `getSource` below reads normally. The column lists are still checked against
 * the schema at run time by PostgREST itself.
 */
export async function listSources(db: Db): Promise<ProductSourceRow[]> {
  return (unwrap(
    "listSources",
    await db.from("product_sources").select(SOURCE_COLUMNS).order("name")
  ) ?? []) as unknown as ProductSourceRow[];
}

export async function getSource(db: Db, id: string): Promise<ProductSourceRow | null> {
  return unwrap(
    "getSource",
    await db.from("product_sources").select(SOURCE_COLUMNS).eq("id", id).maybeSingle()
  ) as ProductSourceRow | null;
}

export async function createSource(
  db: Db,
  input: { kind: ProductSourceKind; name: string; config: Json; credentialsRef?: string | null }
): Promise<{ id: string }> {
  return unwrap(
    "createSource",
    await db
      .from("product_sources")
      .insert({
        kind: input.kind,
        name: input.name,
        config: input.config as never,
        credentials_ref: input.credentialsRef ?? null,
      })
      .select("id")
      .single()
  ) as { id: string };
}

export interface SourcePatch {
  name?: string;
  enabled?: boolean;
  config?: Json;
  credentialsRef?: string | null;
  syncSchedule?: string | null;
}

/** Only the keys the caller supplied — the patch rule every repository here follows. */
export async function updateSource(db: Db, id: string, patch: SourcePatch): Promise<void> {
  const update: Database["public"]["Tables"]["product_sources"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) update.name = patch.name;
  if (patch.enabled !== undefined) update.enabled = patch.enabled;
  if (patch.config !== undefined) update.config = patch.config as never;
  if (patch.credentialsRef !== undefined) update.credentials_ref = patch.credentialsRef;
  if (patch.syncSchedule !== undefined) update.sync_schedule = patch.syncSchedule;

  unwrap("updateSource", await db.from("product_sources").update(update).eq("id", id));
}

/**
 * The run's own footprint on the source row.
 *
 * Separate from `updateSource` because it is written by the pipeline rather than
 * by a form, and because it must not be reachable from the source editor: a
 * `last_status` an operator can type is a `last_status` that stops meaning
 * anything.
 */
export async function recordSyncOutcome(
  db: Db,
  id: string,
  outcome: { status: SourceSyncStatus; at: string }
): Promise<void> {
  unwrap(
    "recordSyncOutcome",
    await db
      .from("product_sources")
      .update({ last_status: outcome.status, last_synced_at: outcome.at, updated_at: outcome.at })
      .eq("id", id)
  );
}

/**
 * Deleting a source cascades to its mappings, its jobs and their items
 * (`on delete cascade` in 0006), and *nulls* `products.source_id` (`on delete
 * set null` in 0005). That asymmetry is deliberate in the schema and worth
 * restating where someone might expect a product to go with it: removing a feed
 * removes the plumbing, not the catalogue it filled.
 */
export async function deleteSource(db: Db, id: string): Promise<void> {
  unwrap("deleteSource", await db.from("product_sources").delete().eq("id", id));
}

/** Products this source owns, as the change detector needs them. */
export interface ExistingProductRow {
  id: string;
  external_id: string | null;
  slug: string;
  content_hash: string | null;
}

export async function listSourceProducts(db: Db, sourceId: string): Promise<ExistingProductRow[]> {
  return (unwrap(
    "listSourceProducts",
    await db
      .from("products")
      .select("id, external_id, slug, content_hash")
      .eq("source_id", sourceId)
      .not("external_id", "is", null)
  ) ?? []) as ExistingProductRow[];
}

/**
 * The current values of the columns an update would write, for the diff.
 *
 * Fetched per item rather than for the whole catalogue: only records that
 * actually changed need a diff, and on a steady feed that is a handful of rows
 * out of thousands.
 */
export async function getProductForDiff(
  db: Db,
  id: string
): Promise<Record<string, unknown> | null> {
  return unwrap(
    "getProductForDiff",
    await db
      .from("products")
      .select(
        "name, slug, sku, cat, cat_label, blurb, story, material, price_pence, " +
          "compare_at_pence, stock, availability, badges, affiliate"
      )
      .eq("id", id)
      .maybeSingle()
  ) as Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Field mappings
// ---------------------------------------------------------------------------

export interface FeedFieldMappingRow {
  id: string;
  source_id: string;
  target_field: string;
  source_path: string;
  transform: string | null;
  fallback: string | null;
  is_required: boolean;
}

const MAPPING_COLUMNS =
  "id, source_id, target_field, source_path, transform, fallback, is_required";

export async function listMappings(db: Db, sourceId: string): Promise<FeedFieldMappingRow[]> {
  return (unwrap(
    "listMappings",
    await db
      .from("feed_field_mappings")
      .select(MAPPING_COLUMNS)
      .eq("source_id", sourceId)
      .order("target_field")
  ) ?? []) as FeedFieldMappingRow[];
}

export interface MappingInput {
  target_field: string;
  source_path: string;
  transform: string | null;
  fallback: string | null;
  is_required: boolean;
}

/**
 * Replace a source's whole mapping set.
 *
 * Delete-then-insert rather than a diff, because the editor sends the complete
 * set and `(source_id, target_field)` is unique — reconciling row by row would
 * mean an upsert plus a delete of the difference, which is the same two
 * statements with more ways to leave a stale row behind. Not a transaction:
 * `feed_field_mappings` is configuration, a half-written set is visible only to
 * the operator editing it, and the failure mode is "save again", not a corrupt
 * catalogue.
 */
export async function replaceMappings(
  db: Db,
  sourceId: string,
  mappings: readonly MappingInput[]
): Promise<void> {
  unwrap(
    "replaceMappings.clear",
    await db.from("feed_field_mappings").delete().eq("source_id", sourceId)
  );

  if (mappings.length === 0) return;

  unwrap(
    "replaceMappings.insert",
    await db.from("feed_field_mappings").insert(
      mappings.map((mapping) => ({
        source_id: sourceId,
        target_field: mapping.target_field,
        source_path: mapping.source_path,
        transform: mapping.transform,
        fallback: mapping.fallback,
        is_required: mapping.is_required,
      }))
    )
  );
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export interface ImportJobRow {
  id: string;
  source_id: string;
  trigger: ImportTrigger;
  status: ImportJobStatus;
  total_count: number;
  created_count: number;
  updated_count: number;
  unchanged_count: number;
  failed_count: number;
  error_summary: string | null;
  started_at: string | null;
  finished_at: string | null;
  requested_by: string | null;
  created_at: string;
}

const JOB_COLUMNS =
  "id, source_id, trigger, status, total_count, created_count, updated_count, " +
  "unchanged_count, failed_count, error_summary, started_at, finished_at, requested_by, created_at";

export async function createJob(
  db: Db,
  input: { sourceId: string; trigger: ImportTrigger; requestedBy: string | null }
): Promise<ImportJobRow> {
  return unwrap(
    "createJob",
    await db
      .from("import_jobs")
      .insert({
        source_id: input.sourceId,
        trigger: input.trigger,
        status: "running",
        started_at: new Date().toISOString(),
        requested_by: input.requestedBy,
      })
      .select(JOB_COLUMNS)
      .single()
  ) as ImportJobRow;
}

export async function getJob(db: Db, id: string): Promise<ImportJobRow | null> {
  return unwrap(
    "getJob",
    await db.from("import_jobs").select(JOB_COLUMNS).eq("id", id).maybeSingle()
  ) as ImportJobRow | null;
}

export async function listJobs(db: Db, sourceId: string, limit = 20): Promise<ImportJobRow[]> {
  return (unwrap(
    "listJobs",
    await db
      .from("import_jobs")
      .select(JOB_COLUMNS)
      .eq("source_id", sourceId)
      .order("created_at", { ascending: false })
      .limit(limit)
  ) ?? []) as unknown as ImportJobRow[];
}

export interface JobOutcome {
  status: ImportJobStatus;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  errorSummary?: string | null;
  finished?: boolean;
}

export async function finishJob(db: Db, id: string, outcome: JobOutcome): Promise<void> {
  unwrap(
    "finishJob",
    await db
      .from("import_jobs")
      .update({
        status: outcome.status,
        total_count: outcome.total,
        created_count: outcome.created,
        updated_count: outcome.updated,
        unchanged_count: outcome.unchanged,
        failed_count: outcome.failed,
        error_summary: outcome.errorSummary ?? null,
        finished_at: outcome.finished === false ? null : new Date().toISOString(),
      })
      .eq("id", id)
  );
}

export async function setJobStatus(
  db: Db,
  id: string,
  status: ImportJobStatus,
  errorSummary?: string
): Promise<void> {
  const update: Database["public"]["Tables"]["import_jobs"]["Update"] = { status };
  if (errorSummary !== undefined) update.error_summary = errorSummary;
  if (status === "completed" || status === "failed" || status === "cancelled") {
    update.finished_at = new Date().toISOString();
  }
  unwrap("setJobStatus", await db.from("import_jobs").update(update).eq("id", id));
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ImportItemRow {
  id: string;
  job_id: string;
  external_id: string | null;
  action: ImportItemAction;
  status: ImportItemStatus;
  raw_payload: Json;
  normalised_payload: Json;
  content_hash: string | null;
  diff: Json;
  error: string | null;
  product_id: string | null;
  created_at: string;
}

const ITEM_COLUMNS =
  "id, job_id, external_id, action, status, raw_payload, normalised_payload, " +
  "content_hash, diff, error, product_id, created_at";

export interface ImportItemInput {
  externalId: string | null;
  action: ImportItemAction;
  rawPayload: Json;
  normalisedPayload: Json;
  contentHash: string | null;
  diff: Json;
  error: string | null;
  productId: string | null;
}

/**
 * Staged in chunks rather than one statement.
 *
 * PostgREST will take a large insert, but a feed of a few thousand records
 * builds a request body big enough to be refused by a proxy long before
 * Postgres sees it — and the failure arrives as a truncated HTTP error with
 * nothing about which row was at fault.
 */
const STAGE_CHUNK = 250;

export async function stageItems(
  db: Db,
  jobId: string,
  items: readonly ImportItemInput[]
): Promise<void> {
  for (let offset = 0; offset < items.length; offset += STAGE_CHUNK) {
    const chunk = items.slice(offset, offset + STAGE_CHUNK);
    unwrap(
      "stageItems",
      await db.from("import_items").insert(
        chunk.map((item) => ({
          job_id: jobId,
          external_id: item.externalId,
          action: item.action,
          raw_payload: item.rawPayload as never,
          normalised_payload: item.normalisedPayload as never,
          content_hash: item.contentHash,
          diff: item.diff as never,
          error: item.error,
          product_id: item.productId,
        }))
      )
    );
  }
}

export async function listItems(
  db: Db,
  jobId: string,
  options: { status?: ImportItemStatus; limit?: number } = {}
): Promise<ImportItemRow[]> {
  let query = db.from("import_items").select(ITEM_COLUMNS).eq("job_id", jobId);
  if (options.status) query = query.eq("status", options.status);

  return (unwrap(
    "listItems",
    await query
      .order("action")
      .order("external_id")
      .limit(options.limit ?? 500)
  ) ?? []) as unknown as ImportItemRow[];
}

export async function setItemStatus(
  db: Db,
  jobId: string,
  itemIds: readonly string[],
  status: ImportItemStatus
): Promise<number> {
  if (itemIds.length === 0) return 0;

  const rows = unwrap(
    "setItemStatus",
    await db
      .from("import_items")
      .update({ status })
      .eq("job_id", jobId)
      .in("id", itemIds as string[])
      .select("id")
  ) as { id: string }[] | null;

  return rows?.length ?? 0;
}

/**
 * Approve or reject everything still awaiting a decision.
 *
 * Scoped to `pending` so it cannot walk back an item that was already applied —
 * `import_items.status` has no transition constraint in the schema, so the
 * narrowing has to happen in the query.
 */
export async function setPendingItemsStatus(
  db: Db,
  jobId: string,
  actions: readonly ImportItemAction[],
  status: ImportItemStatus
): Promise<number> {
  const rows = unwrap(
    "setPendingItemsStatus",
    await db
      .from("import_items")
      .update({ status })
      .eq("job_id", jobId)
      .eq("status", "pending")
      .in("action", actions as string[])
      .select("id")
  ) as { id: string }[] | null;

  return rows?.length ?? 0;
}

export async function markItemApplied(db: Db, itemId: string, productId: string): Promise<void> {
  unwrap(
    "markItemApplied",
    await db
      .from("import_items")
      .update({ status: "applied", product_id: productId })
      .eq("id", itemId)
  );
}

export async function markItemFailed(db: Db, itemId: string, error: string): Promise<void> {
  unwrap(
    "markItemFailed",
    await db.from("import_items").update({ action: "failed", error }).eq("id", itemId)
  );
}

// ---------------------------------------------------------------------------
// Applying an item to the catalogue
// ---------------------------------------------------------------------------

/**
 * Insert a product the feed has not seen before.
 *
 * `slug` is unique across the whole table, so a feed can collide with a
 * hand-entered product. The caller catches 23505 and retries with a suffixed
 * slug rather than failing the item: a name clash between an editor's product
 * and a merchant's is ordinary, and it should not stop a run.
 */
export async function insertImportedProduct(
  db: Db,
  input: {
    sourceId: string;
    externalId: string;
    slug: string;
    contentHash: string;
    columns: Record<string, unknown>;
    createdBy: string;
  }
): Promise<{ id: string }> {
  // `columns` is assembled by `columnsForApply` from a closed vocabulary, so the
  // row is well-formed; the cast is because TypeScript cannot see that a
  // `Record<string, unknown>` spread supplies the required `name`.
  const row = {
    ...input.columns,
    slug: input.slug,
    source_id: input.sourceId,
    external_id: input.externalId,
    content_hash: input.contentHash,
    draft_data: { sections: [], seo: {} },
    created_by: input.createdBy,
    updated_by: input.createdBy,
  } as unknown as Database["public"]["Tables"]["products"]["Insert"];

  return unwrap(
    "insertImportedProduct",
    await db.from("products").insert(row).select("id").single()
  ) as { id: string };
}

export async function updateImportedProduct(
  db: Db,
  id: string,
  input: { contentHash: string; columns: Record<string, unknown>; updatedBy: string }
): Promise<void> {
  const patch = {
    ...input.columns,
    content_hash: input.contentHash,
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString(),
  } as Database["public"]["Tables"]["products"]["Update"];

  unwrap("updateImportedProduct", await db.from("products").update(patch).eq("id", id));
}
