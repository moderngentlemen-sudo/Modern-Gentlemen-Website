/**
 * Ingestion service — configure a source, run it, review what it found, apply
 * what a person approved.
 *
 * The shape to hold in mind is that **a run writes nothing to the catalogue**.
 * It fetches, maps, compares and stages; `import_items` is a proposal, and
 * `applyJob` is the only function here that touches `products`. That is what
 * `0006`'s header meant by "a run can be reviewed and approved before anything
 * reaches the live catalogue", and it is why a bad mapping costs a rejected job
 * rather than a corrupted store.
 *
 * Three permissions, and the split matters:
 *
 *   integration.read   — see sources, mappings and past runs
 *   integration.write  — configure a source or its mappings
 *   integration.run    — start a run, and approve or reject what it staged
 *
 * `applyJob` additionally requires `product.write`, because that is the moment a
 * product is written and the person doing it should be someone allowed to write
 * products. RLS agrees independently: the `products` policies from `0005` gate
 * on `product.write` and this service uses the editor's own session, so an
 * operator with `integration.run` alone is refused by Postgres even if this
 * check were removed.
 */

import { createClient } from "@/lib/db/server";
import * as repo from "@/lib/db/repositories/ingestion";
import { RepositoryError } from "@/lib/db/repositories/errors";
import { contentHashOf } from "@/lib/domain/contentHash";
import {
  assembleProduct,
  availabilityForStock,
  coerceValue,
  decideAction,
  diffFields,
  isApplicable,
  isStageable,
  columnsForApply,
  imageFileNameFrom,
  imageImportPlan,
  imageTypeProblem,
  APPLY_BATCH_SIZE,
  MAX_IMAGE_DOWNLOADS_PER_RUN,
  missingRequiredTargets,
  normalisedProductSchema,
  feedFieldMappingSchema,
  isFeedTargetField,
  shopifyConfigSchema,
  sourceStatusFor,
  xmlFeedConfigSchema,
  type FeedTargetField,
  type ImportCounts,
  type ImportTrigger,
  type SyncSchedule,
  type NormalisedProduct,
  type ProductSourceKind,
} from "@/lib/domain/ingestion";
import {
  AdapterError,
  adapterFor,
  applyTransform,
  fetchBinaryCapped,
  resolveCredential,
} from "@/lib/integrations/commerce";
import { uploadAsset } from "./media";
import { attachProductMedia } from "@/lib/db/repositories/products";
import type { Json } from "@/lib/db/database.types";
import { requirePermission } from "./auth";

export type ProductSource = repo.ProductSourceRow;
export type FeedFieldMapping = repo.FeedFieldMappingRow;
export type ImportJob = repo.ImportJobRow;
export type ImportItem = repo.ImportItemRow;

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listSources(): Promise<ProductSource[]> {
  await requirePermission("integration.read");
  const db = await createClient();
  return repo.listSources(db);
}

export async function getSource(id: string): Promise<ProductSource | null> {
  await requirePermission("integration.read");
  const db = await createClient();
  return repo.getSource(db, id);
}

/**
 * Validate `config` against the schema for the source's kind.
 *
 * Exported because three callers need it — create, update and the run — and
 * because a config that only gets checked at run time is a config that fails
 * hours after someone typed it.
 */
export function parseSourceConfig(kind: ProductSourceKind, config: unknown): Json {
  if (kind === "xml_feed") return xmlFeedConfigSchema.parse(config ?? {}) as unknown as Json;
  if (kind === "shopify") return shopifyConfigSchema.parse(config ?? {}) as unknown as Json;
  if (kind === "native") return {} as Json;
  throw new Error(`A ${kind} source cannot be configured yet.`);
}

export async function createSource(input: {
  kind: ProductSourceKind;
  name: string;
  config: unknown;
  credentialsRef?: string | null;
}): Promise<{ id: string }> {
  await requirePermission("integration.write");
  const db = await createClient();

  return repo.createSource(db, {
    kind: input.kind,
    name: input.name,
    config: parseSourceConfig(input.kind, input.config),
    credentialsRef: input.credentialsRef ?? null,
  });
}

export async function updateSource(
  id: string,
  patch: {
    name?: string;
    enabled?: boolean;
    config?: unknown;
    credentialsRef?: string | null;
    /** `null` switches the schedule off — see `SYNC_SCHEDULES`. */
    syncSchedule?: SyncSchedule | null;
  }
): Promise<void> {
  await requirePermission("integration.write");
  const db = await createClient();

  const source = await repo.getSource(db, id);
  if (!source) throw new Error("That source no longer exists.");

  await repo.updateSource(db, id, {
    name: patch.name,
    enabled: patch.enabled,
    config: patch.config === undefined ? undefined : parseSourceConfig(source.kind, patch.config),
    credentialsRef: patch.credentialsRef,
    syncSchedule: patch.syncSchedule,
  });
}

/** `integration.write`, not a delete permission — there is no `integration.delete`. */
export async function deleteSource(id: string): Promise<void> {
  await requirePermission("integration.write");
  const db = await createClient();
  await repo.deleteSource(db, id);
}

// ---------------------------------------------------------------------------
// Mappings
// ---------------------------------------------------------------------------

export async function listMappings(sourceId: string): Promise<FeedFieldMapping[]> {
  await requirePermission("integration.read");
  const db = await createClient();
  return repo.listMappings(db, sourceId);
}

/**
 * Replace a source's mapping set, validating every row first.
 *
 * Validation happens over the whole set before anything is written, because
 * `replaceMappings` deletes before it inserts: a set that fails validation
 * halfway through would leave the source with no mappings at all.
 */
export async function saveMappings(sourceId: string, mappings: unknown[]): Promise<void> {
  await requirePermission("integration.write");

  const parsed = mappings.map((mapping, index) => {
    const result = feedFieldMappingSchema.safeParse(mapping);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(`Mapping ${index + 1}: ${issue.path.join(".")} — ${issue.message}`);
    }
    return result.data;
  });

  const seen = new Set<string>();
  for (const mapping of parsed) {
    if (seen.has(mapping.target_field)) {
      throw new Error(
        `Two mappings both write ${mapping.target_field}. Each field can be mapped once.`
      );
    }
    seen.add(mapping.target_field);
  }

  const db = await createClient();
  await repo.replaceMappings(
    db,
    sourceId,
    parsed.map((mapping) => ({
      target_field: mapping.target_field,
      source_path: mapping.source_path,
      transform: mapping.transform ?? null,
      fallback: mapping.fallback ?? null,
      is_required: mapping.is_required ?? false,
    }))
  );
}

// ---------------------------------------------------------------------------
// Jobs and items
// ---------------------------------------------------------------------------

export async function listJobs(sourceId: string, limit?: number): Promise<ImportJob[]> {
  await requirePermission("integration.read");
  const db = await createClient();
  return repo.listJobs(db, sourceId, limit);
}

export async function getJob(id: string): Promise<ImportJob | null> {
  await requirePermission("integration.read");
  const db = await createClient();
  return repo.getJob(db, id);
}

export async function listItems(jobId: string): Promise<ImportItem[]> {
  await requirePermission("integration.read");
  const db = await createClient();
  return repo.listItems(db, jobId);
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

export interface RunResult {
  jobId: string;
  status: "review" | "completed" | "failed";
  counts: ImportCounts;
  /** Set when the run failed before it could stage anything. */
  error?: string;
}

/**
 * Fetch a source and stage everything it proposes.
 *
 * Returns rather than throws when the *feed* fails, because by then a job row
 * exists and the useful answer is "here is the run, and here is why it failed" —
 * a thrown error would leave the operator with a message and no link to the
 * record of it. A refusal *before* the job exists (no mappings, a disabled
 * source, an unusable config) still throws: there is nothing to link to.
 */
export async function runImport(sourceId: string): Promise<RunResult> {
  const user = await requirePermission("integration.run");
  const db = await createClient();
  return runImportCore(db, sourceId, { trigger: "manual", requestedBy: user.id });
}

/**
 * A run, with the client and the actor handed in.
 *
 * Extracted from `runImport` when scheduled runs landed, and the split is
 * exactly where the two callers differ and nowhere else. A scheduled run has
 * **no session** — that is what a schedule is — so it cannot go through
 * `requirePermission` or `lib/db/server.ts`. It uses the service-role client,
 * which `lib/db/admin.ts` names this case for in its own header: "scheduled
 * ingestion jobs (no user session exists)".
 *
 * **No permission check here, and it is not an oversight** — the same reasoning
 * `runScheduledPublishes` records. The permission was checked when the
 * *schedule was set*: `saveSourceAction` asserts `integration.write` before it
 * will store one. By the time a row is due, a person entitled to run it has
 * already said so. Checking again here would mean checking against nobody.
 *
 * ⚠️ **A scheduled run stages and never applies.** It ends at `review` exactly
 * as a manual run does, and `applyJob` — the only thing that writes `products`
 * — still needs a human. A schedule that could reach the live catalogue
 * unattended is the thing `FEED_TARGET_FIELDS` refuses `status` for, arrived at
 * from the other direction.
 */
export async function runImportCore(
  db: Awaited<ReturnType<typeof createClient>>,
  sourceId: string,
  actor: { trigger: ImportTrigger; requestedBy: string | null }
): Promise<RunResult> {
  const source = await repo.getSource(db, sourceId);
  if (!source) throw new Error("That source no longer exists.");
  if (!source.enabled) throw new Error(`"${source.name}" is disabled. Enable it before running.`);

  const mappings = await repo.listMappings(db, sourceId);
  const missing = missingRequiredTargets(mappings);
  if (missing.length > 0) {
    throw new Error(
      `This source cannot run yet: ${missing.join(" and ")} ${
        missing.length === 1 ? "is" : "are"
      } not mapped. Without external_id a run cannot tell a new product from one it already imported.`
    );
  }

  const adapter = adapterFor(source.kind);
  const config = adapter.parseConfig(source.config);
  const credential = resolveCredential(source.credentials_ref);

  const job = await repo.createJob(db, {
    sourceId,
    trigger: actor.trigger,
    requestedBy: actor.requestedBy,
  });

  const counts: ImportCounts = { total: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };

  let records: unknown[];
  try {
    records = await adapter.fetchRecords(config, { fetch: globalThis.fetch, credential });
  } catch (error) {
    const message =
      error instanceof AdapterError || error instanceof Error ? error.message : String(error);
    await repo.finishJob(db, job.id, {
      status: "failed",
      ...toOutcome(counts),
      errorSummary: message,
    });
    await repo.recordSyncOutcome(db, sourceId, {
      status: "failed",
      at: new Date().toISOString(),
    });
    return { jobId: job.id, status: "failed", counts, error: message };
  }

  const existingByExternalId = new Map(
    (await repo.listSourceProducts(db, sourceId)).map((product) => [
      product.external_id as string,
      product,
    ])
  );

  const staged: repo.ImportItemInput[] = [];
  const seenExternalIds = new Set<string>();

  for (const record of records) {
    counts.total += 1;

    const mapped = mapRecord(adapter, record, mappings);
    if (!mapped.ok) {
      counts.failed += 1;
      staged.push(failedItem(null, record, mapped.error));
      continue;
    }

    const assembled = assembleProduct(mapped.values);
    if (!assembled.ok) {
      counts.failed += 1;
      staged.push(failedItem(asExternalId(mapped.values), record, assembled.error));
      continue;
    }

    const product = assembled.product;

    // A feed listing the same product twice is a feed whose second row would
    // silently overwrite the first — and on a create, would collide on
    // `products_source_external_uniq` mid-apply. Caught here so the reviewer
    // sees the duplicate rather than a constraint violation.
    if (seenExternalIds.has(product.external_id)) {
      counts.failed += 1;
      staged.push(
        failedItem(
          product.external_id,
          record,
          `The feed lists external ID "${product.external_id}" more than once.`
        )
      );
      continue;
    }
    seenExternalIds.add(product.external_id);

    const existing = existingByExternalId.get(product.external_id) ?? null;
    const hash = contentHashOf(product);
    const action = decideAction(existing, hash);

    if (action === "unchanged") {
      counts.unchanged += 1;
      continue; // Counted, not staged — see `isStageable`.
    }

    let diff: Json = null;
    if (action === "update" && existing) {
      const before = await repo.getProductForDiff(db, existing.id);
      if (before) diff = diffFields(before, product) as unknown as Json;
    }

    if (action === "create") counts.created += 1;
    else counts.updated += 1;

    staged.push({
      externalId: product.external_id,
      action,
      rawPayload: record as Json,
      normalisedPayload: product as unknown as Json,
      contentHash: hash,
      diff,
      error: null,
      productId: existing?.id ?? null,
    });
  }

  await repo.stageItems(
    db,
    job.id,
    staged.filter((item) => isStageable(item.action))
  );

  // 'review' whenever there is something to decide, 'completed' when a run found
  // nothing to do — a job nobody needs to open should not sit in the list asking
  // to be opened.
  const hasProposals = counts.created + counts.updated + counts.failed > 0;
  const status = hasProposals ? "review" : "completed";

  await repo.finishJob(db, job.id, {
    status,
    ...toOutcome(counts),
    // The finish timestamp belongs to the *staging*, not to the apply, and a job
    // in review is genuinely finished running.
    finished: true,
  });

  await repo.recordSyncOutcome(db, sourceId, {
    status: sourceStatusFor(counts),
    at: new Date().toISOString(),
  });

  return { jobId: job.id, status, counts };
}

function toOutcome(counts: ImportCounts) {
  return {
    total: counts.total,
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged,
    failed: counts.failed,
  };
}

function failedItem(
  externalId: string | null,
  record: unknown,
  error: string
): repo.ImportItemInput {
  return {
    externalId,
    action: "failed",
    rawPayload: record as Json,
    normalisedPayload: null,
    contentHash: null,
    diff: null,
    error,
    productId: null,
  };
}

function asExternalId(values: Partial<Record<FeedTargetField, unknown>>): string | null {
  const value = values.external_id;
  return typeof value === "string" && value !== "" ? value : null;
}

type MapResult =
  { ok: true; values: Partial<Record<FeedTargetField, unknown>> } | { ok: false; error: string };

/**
 * One record → the flat set of coerced values, or the first reason it could not
 * be read.
 *
 * First reason, not all of them: a record whose price is unreadable usually has
 * a dozen other fields reading fine, and listing every complaint would bury the
 * one that matters. The reviewer fixes the mapping and runs again.
 *
 * `fallback` is applied *before* the transform, so a fallback of "0.00" on a
 * price field goes through `pounds_to_pence` like any other value. The opposite
 * order would make a fallback mean something different from a feed value that
 * happened to be identical.
 */
function mapRecord(
  adapter: { readPath(record: unknown, path: string): unknown },
  record: unknown,
  mappings: readonly repo.FeedFieldMappingRow[]
): MapResult {
  const values: Partial<Record<FeedTargetField, unknown>> = {};

  for (const mapping of mappings) {
    if (!isFeedTargetField(mapping.target_field)) continue; // Retired target; ignore.

    const extracted = adapter.readPath(record, mapping.source_path);
    const withFallback = isEmpty(extracted) ? (mapping.fallback ?? null) : extracted;
    const transformed = applyTransformSafely(mapping.transform, withFallback);

    const coerced = coerceValue(mapping.target_field, transformed);
    if (!coerced.ok) return { ok: false, error: coerced.error };

    if (coerced.value === null) {
      if (mapping.is_required) {
        return {
          ok: false,
          error: `${mapping.target_field} is required, and "${mapping.source_path}" matched nothing.`,
        };
      }
      continue;
    }

    values[mapping.target_field] = coerced.value;
  }

  return { ok: true, values };
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === "";
}

/**
 * The transforms are written to be total, but they run over whatever a stranger's
 * feed contains. One throwing would abandon the entire run at whichever record
 * happened to trip it; failing that single item instead keeps the other 1,999.
 */
function applyTransformSafely(name: string | null, value: unknown): unknown {
  try {
    return applyTransform(name, value);
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export async function setItemsDecision(
  jobId: string,
  itemIds: string[],
  decision: "approved" | "rejected"
): Promise<number> {
  await requirePermission("integration.run");
  const db = await createClient();
  return repo.setItemStatus(db, jobId, itemIds, decision);
}

/**
 * Approve or reject everything still pending.
 *
 * Restricted to applicable actions, so "approve all" cannot approve a failed
 * item — a failed row carries no normalised payload, and approving it would put
 * something in the apply queue that apply must then skip.
 */
export async function decideAllPending(
  jobId: string,
  decision: "approved" | "rejected"
): Promise<number> {
  await requirePermission("integration.run");
  const db = await createClient();
  return repo.setPendingItemsStatus(db, jobId, ["create", "update"], decision);
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export interface ApplyResult {
  applied: number;
  failed: number;
  errors: string[];
  /** The products written, so the caller can revalidate their public pages. */
  productIds: string[];
  /** Photographs fetched, catalogued and attached during this apply. */
  imagesImported: number;
  /**
   * Photographs this run did not reach — over a cap, or refused by the source.
   *
   * Reported rather than merely counted: the import is idempotent, so the fix is
   * always "run apply again", and a bare number reads as data loss.
   */
  imagesSkipped: number;
  /**
   * Approved items this call did not reach, because the batch was full.
   *
   * The caller applies again to continue. Nothing is lost and nothing repeated:
   * each item is marked `applied` or `failed` the moment it is written, so a
   * second call selects exactly what the first did not reach.
   */
  remaining: number;
}

/**
 * Write every approved item to the catalogue.
 *
 * Sequential rather than batched, and deliberately: each item can fail on its
 * own (a slug collision, a CHECK the mapping could not foresee) and the run has
 * to survive that with the rest applied. A batched upsert would take the whole
 * set down with one bad row, which is the failure mode `0006`'s header set out
 * to avoid — "one malformed row fails alone instead of failing the run".
 *
 * Products are created as drafts. Nothing here publishes, and nothing here
 * touches `draft_data`: the block tree belongs to the builder.
 */
export async function applyJob(jobId: string, limit = APPLY_BATCH_SIZE): Promise<ApplyResult> {
  const user = await requirePermission("integration.run");
  await requirePermission("product.write");
  const db = await createClient();

  const job = await repo.getJob(db, jobId);
  if (!job) throw new Error("That import run no longer exists.");

  const source = await repo.getSource(db, job.source_id);
  if (!source) throw new Error("The source this run belongs to no longer exists.");

  const config = adapterFor(source.kind).parseConfig(source.config);
  const defaults = {
    fulfilment: config.fulfilment ?? "direct",
    currency: config.currency ?? "GBP",
  };

  const approvedAll = (await repo.listItems(db, jobId, { status: "approved" })).filter((item) =>
    isApplicable(item.action)
  );
  const approved = approvedAll.slice(0, limit);

  const result: ApplyResult = {
    applied: 0,
    failed: 0,
    errors: [],
    productIds: [],
    imagesImported: 0,
    imagesSkipped: 0,
    remaining: approvedAll.length - approved.length,
  };

  // One budget for the whole run — see `imageImportPlan` on why a cap rather
  // than a queue is the right answer while the import stays idempotent.
  const imageBudget = { remaining: MAX_IMAGE_DOWNLOADS_PER_RUN };

  // ⚠️ Checked once, up front, rather than discovered per image. `uploadAsset`
  // requires `media.write`, which `applyJob` does not otherwise need — a
  // merchandiser who may run imports and write products need not hold it. Left
  // to fail per image it would produce one "the database refused the write" per
  // photograph, naming neither the permission nor the reason.
  const mayWriteMedia = user.permissions.has("media.write");

  for (const item of approved) {
    const parsed = normalisedProductSchema.safeParse(item.normalised_payload);
    if (!parsed.success) {
      result.failed += 1;
      const message = `${item.external_id ?? item.id}: the staged payload is no longer valid.`;
      result.errors.push(message);
      await repo.markItemFailed(db, item.id, message);
      continue;
    }

    try {
      const productId = await applyOne(db, {
        item,
        product: parsed.data,
        sourceId: source.id,
        defaults,
        userId: user.id,
      });
      await repo.markItemApplied(db, item.id, productId);
      result.applied += 1;
      result.productIds.push(productId);

      // ⚠️ **After the item is marked applied, and outside its try/catch on
      // purpose.** The product row is written and correct; a photograph that
      // 404s is not a reason to mark the item failed and re-stage a product the
      // catalogue already has. Image trouble is reported and the item stays
      // applied.
      await importImages(db, {
        productId,
        product: parsed.data,
        label: item.external_id ?? item.id,
        budget: imageBudget,
        mayWriteMedia,
        result,
      });
    } catch (error) {
      result.failed += 1;
      const message = `${item.external_id ?? item.id}: ${describe(error)}`;
      result.errors.push(message);
      await repo.markItemFailed(db, item.id, message);
    }
  }

  // The job is done being acted on once nothing is left pending or approved.
  const outstanding = (await repo.listItems(db, jobId)).filter(
    (item) => item.status === "pending" || item.status === "approved"
  );
  if (outstanding.length === 0) await repo.setJobStatus(db, jobId, "completed");

  return result;
}

/**
 * Fetches a product's staged image URLs, catalogues them, and attaches them.
 *
 * ⚠️ **Attaches, never detaches, and that is the same stance as the rest of
 * ingestion.** An import does not publish, does not rename and does not rewrite
 * the block tree; it does not curate a gallery either. A merchant dropping a
 * photograph from their feed must not silently remove one an editor chose to
 * feature, so a URL that disappears from a feed leaves `product_media` alone.
 * The cost is stated: a gallery can accumulate images the source no longer
 * lists, and pruning it is an editor's job on `/admin/products`.
 *
 * **Idempotent end to end.** `uploadAsset` deduplicates on a SHA-256 of the
 * bytes, so re-running costs one query and no storage for an image already in
 * the library; `attachProductMedia` upserts on `(product_id, asset_id)`. That is
 * what makes the per-run budget safe — see `imageImportPlan`.
 *
 * Each image is fetched independently and a failure is recorded rather than
 * thrown: five photographs where the third 404s should yield four photographs
 * and one message, not a failed product.
 */
async function importImages(
  db: Awaited<ReturnType<typeof createClient>>,
  input: {
    productId: string;
    product: NormalisedProduct;
    label: string;
    budget: { remaining: number };
    mayWriteMedia: boolean;
    result: ApplyResult;
  }
): Promise<void> {
  const urls = input.product.images ?? [];
  if (urls.length === 0) return;

  if (!input.mayWriteMedia) {
    input.result.imagesSkipped += urls.length;
    // One message for the run, not one per product: the permission does not
    // change between items, and repeating it would bury the real errors.
    const notice = "Images were not imported: this account does not hold media.write.";
    if (!input.result.errors.includes(notice)) input.result.errors.push(notice);
    return;
  }

  const plan = imageImportPlan(urls, input.budget);
  if (plan.skipped > 0) {
    input.result.imagesSkipped += plan.skipped;
    input.result.errors.push(
      `${input.label}: ${plan.skipped} image${plan.skipped === 1 ? "" : "s"} not imported ` +
        `(this run's image budget is spent). Run apply again to continue — nothing already ` +
        `imported is fetched twice.`
    );
  }

  // Sequential rather than `Promise.all`, deliberately. These are downloads
  // followed by uploads against one Storage bucket; firing eight at once at a
  // merchant's CDN is the shape that gets a feed rate-limited, and the run is
  // already bounded by the budget above.
  for (const [index, url] of plan.take.entries()) {
    input.budget.remaining -= 1;

    try {
      const asset = await imageAssetFor(url, input.product);
      await attachProductMedia(db, input.productId, {
        assetId: asset.id,
        // The first photograph a feed lists is the one it leads with. Position
        // carries the feed's own order, which is the only ordering information
        // a feed gives us.
        role: index === 0 ? "primary" : "gallery",
        position: index,
      });
      input.result.imagesImported += 1;
    } catch (error) {
      input.result.imagesSkipped += 1;
      input.result.errors.push(`${input.label}: image ${index + 1} — ${describe(error)}`);
    }
  }
}

/**
 * One URL to a catalogued asset.
 *
 * ⚠️ **The content type is checked before the bytes reach `uploadAsset`.** That
 * function refuses a non-media MIME type, but its message is written for someone
 * at an upload dialog; a feed that answers a photograph URL with an HTML error
 * page deserves to be told that is what happened.
 *
 * `altText` is the product's own name. It is a guess, and a defensible one for a
 * product photograph — the alternative is an image with no alternative text at
 * all, which the a11y suite exists to catch and which an editor is far less
 * likely to notice than a slightly generic sentence.
 */
async function imageAssetFor(url: string, product: NormalisedProduct) {
  const { bytes, contentType } = await fetchBinaryCapped(globalThis.fetch, url, {
    subject: `The image at ${url}`,
    timeoutMs: IMAGE_TIMEOUT_MS,
  });

  const check = imageTypeProblem(contentType, bytes.byteLength);
  if (!check.ok) throw new Error(check.problem);

  return uploadAsset({
    fileName: imageFileNameFrom(url),
    mimeType: check.mimeType,
    bytes,
    title: product.name,
    altText: product.name,
  });
}

/** Shorter than a feed fetch: one photograph should not hold a run for a minute. */
const IMAGE_TIMEOUT_MS = 15_000;

async function applyOne(
  db: Awaited<ReturnType<typeof createClient>>,
  input: {
    item: repo.ImportItemRow;
    product: NormalisedProduct;
    sourceId: string;
    defaults: { fulfilment: "direct" | "affiliate"; currency: string };
    userId: string;
  }
): Promise<string> {
  const { item, product, defaults } = input;
  const action = item.action === "create" ? "create" : "update";

  const columns = columnsForApply(product, action, defaults);

  // A feed that tracks stock but not availability would otherwise leave a
  // sold-out product reading 'in_stock' on the storefront.
  const derived = availabilityForStock(product);
  if (derived) columns.availability = derived;

  const hash = item.content_hash ?? contentHashOf(product);

  if (action === "update") {
    if (!item.product_id) throw new Error("this update has lost the product it referred to.");
    await repo.updateImportedProduct(db, item.product_id, {
      contentHash: hash,
      columns,
      updatedBy: input.userId,
    });
    return item.product_id;
  }

  // `slug` is unique across the whole table, so a merchant's product can collide
  // with one an editor typed. Suffixing is better than failing the item: the
  // product is real, and only its URL needed to differ.
  const baseSlug = product.slug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      const created = await repo.insertImportedProduct(db, {
        sourceId: input.sourceId,
        externalId: product.external_id,
        slug,
        contentHash: hash,
        columns: { ...columns, slug },
        createdBy: input.userId,
      });
      return created.id;
    } catch (error) {
      const collidesOnSlug =
        error instanceof RepositoryError &&
        error.code === "23505" &&
        (error.details ?? "").includes("slug");
      if (!collidesOnSlug) throw error;
    }
  }

  throw new Error(`could not find a free slug near "${baseSlug}".`);
}

function describe(error: unknown): string {
  if (error instanceof RepositoryError) {
    if (error.isPermissionDenied) return "the database refused the write.";
    return error.details ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
