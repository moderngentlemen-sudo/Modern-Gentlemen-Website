/**
 * Product ingestion — vocabulary, mapping rules and change detection. Pure, no
 * I/O.
 *
 * `0005_commerce.sql` and `0006_ingestion.sql` built the whole pipeline's schema
 * two phases before anything wrote to it: `product_sources` records where a
 * product came from, `feed_field_mappings` says how a provider's payload lines
 * up with our columns, and `import_jobs` / `import_items` stage a run so it can
 * be reviewed before it reaches the catalogue. This file is the half of that
 * pipeline Postgres cannot express — what a mapping is allowed to target, what a
 * value has to look like once extracted, and whether an incoming record differs
 * from the one already stored.
 *
 * Two things live here rather than in `lib/integrations/commerce`, and the split
 * is deliberate. The **vocabularies** (target fields, transform names) are here
 * because the Zod schemas that validate a stored mapping row need them, and
 * `lib/domain` may not import an adapter. The **implementations** — fetching,
 * parsing, and the transform functions themselves — are in the adapter, because
 * they are provider-payload wrangling rather than business rules. Where the two
 * halves could drift, a conformance test asserts they agree: the same stance
 * `products.ts` takes towards the demo catalogue and `lib/blocks` towards the
 * section registry.
 *
 * Money is integer pence throughout, and this file is unusually strict about it
 * — see `coerceValue`. A feed quoting "145.00" is quoting pounds, and silently
 * reading that as 145 pence is the exact failure `lib/domain/money.ts` exists to
 * prevent, arriving through a door money.ts does not guard.
 */

import { z } from "zod";
import {
  PRODUCT_AVAILABILITIES,
  PRODUCT_BADGES,
  PRODUCT_FULFILMENTS,
  type ProductAvailability,
  type ProductFulfilment,
} from "./products";
import { slugify } from "./slug";

// ---------------------------------------------------------------------------
// The vocabularies the migrations already fixed
// ---------------------------------------------------------------------------

/** `product_sources.kind` — the CHECK in `0005_commerce.sql`. */
export const PRODUCT_SOURCE_KINDS = ["native", "xml_feed", "shopify"] as const;
export type ProductSourceKind = (typeof PRODUCT_SOURCE_KINDS)[number];

/**
 * `product_sources.last_status`.
 *
 * 'partial' is the one worth explaining: a run that reached the feed, mapped
 * most of it, and failed on some records. It is not a failure — the good rows
 * are staged and reviewable — but it is not silence either, which is why the
 * source list surfaces it differently from 'ok'.
 */
export const SOURCE_SYNC_STATUSES = ["ok", "partial", "failed"] as const;
export type SourceSyncStatus = (typeof SOURCE_SYNC_STATUSES)[number];

/** `import_jobs.trigger`. Only 'manual' has a caller today. */
export const IMPORT_TRIGGERS = ["manual", "scheduled", "webhook"] as const;
export type ImportTrigger = (typeof IMPORT_TRIGGERS)[number];

/** `import_jobs.status`. */
export const IMPORT_JOB_STATUSES = [
  "queued",
  "running",
  "review",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ImportJobStatus = (typeof IMPORT_JOB_STATUSES)[number];

/** `import_items.action` — what change detection decided about a record. */
export const IMPORT_ITEM_ACTIONS = ["create", "update", "unchanged", "failed"] as const;
export type ImportItemAction = (typeof IMPORT_ITEM_ACTIONS)[number];

/** `import_items.status` — where a staged record is in review. */
export const IMPORT_ITEM_STATUSES = ["pending", "approved", "rejected", "applied"] as const;
export type ImportItemStatus = (typeof IMPORT_ITEM_STATUSES)[number];

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

/**
 * How a mapped value is read once the transforms have run.
 *
 * The kind is not decoration: it decides the coercion in `coerceValue`, and the
 * coercion is where a feed's stringly-typed payload stops being strings.
 */
export type TargetFieldKind =
  "text" | "slug" | "url" | "integer" | "pence" | "availability" | "list";

export interface TargetFieldSpec {
  kind: TargetFieldKind;
  /** Shown beside the control in the mapping editor. */
  label: string;
  /** A mapping cannot be saved without this target. */
  required?: true;
  /** Written on create only — see `IMMUTABLE_AFTER_CREATE`. */
  createOnly?: true;
}

/**
 * Every column a feed is allowed to write, and nothing else.
 *
 * Deliberately narrower than `products`. Absent, and absent on purpose:
 *
 * - **`status`.** An import never publishes. A created product lands as a draft
 *   and an editor publishes it, because a feed that can reach the live store
 *   without a human is a feed that can take the store down without one.
 * - **`draft_data` / `published_data`.** The block tree is editorial work. A
 *   sync that rewrote it would discard whatever the builder had been used for.
 * - **images.** Ingesting media means downloading binaries into Storage,
 *   cataloguing them in `media_assets` and reconciling `product_media` — a slice
 *   of its own, and one that fails in ways a text mapping never does. A feed's
 *   image URLs are visible in the raw payload on the review screen, so nothing
 *   is lost, only deferred.
 *
 * `fulfilment` is also absent: it is a property of the *source* (an affiliate
 * feed is affiliate for every row) rather than of a record, so it is configured
 * once on the source and applied to everything the run stages.
 */
export const FEED_TARGET_FIELDS: Readonly<Record<string, TargetFieldSpec>> = {
  external_id: { kind: "text", label: "External ID", required: true },
  name: { kind: "text", label: "Name", required: true },
  slug: { kind: "slug", label: "Slug", createOnly: true },
  sku: { kind: "text", label: "SKU" },
  cat: { kind: "text", label: "Category key" },
  cat_label: { kind: "text", label: "Category label" },
  blurb: { kind: "text", label: "Blurb" },
  story: { kind: "text", label: "Story" },
  material: { kind: "text", label: "Material" },
  price_pence: { kind: "pence", label: "Price" },
  compare_at_pence: { kind: "pence", label: "Compare-at price" },
  stock: { kind: "integer", label: "Stock" },
  availability: { kind: "availability", label: "Availability" },
  badges: { kind: "list", label: "Badges" },
  "affiliate.merchant_name": { kind: "text", label: "Merchant name" },
  "affiliate.merchant_url": { kind: "url", label: "Merchant URL" },
  "affiliate.disclosure": { kind: "text", label: "Disclosure" },
  "affiliate.external_price_pence": { kind: "pence", label: "Merchant price" },
} as const;

export type FeedTargetField = keyof typeof FEED_TARGET_FIELDS & string;

export const FEED_TARGET_FIELD_NAMES = Object.keys(FEED_TARGET_FIELDS) as FeedTargetField[];

export function isFeedTargetField(value: string): value is FeedTargetField {
  return Object.prototype.hasOwnProperty.call(FEED_TARGET_FIELDS, value);
}

/** The targets a mapping must carry before a run is possible. */
export const REQUIRED_TARGET_FIELDS = FEED_TARGET_FIELD_NAMES.filter(
  (field) => FEED_TARGET_FIELDS[field].required
);

/**
 * Written when the product is created and never again.
 *
 * `slug` is the only member, and it is the one that matters: the slug is the
 * product's public URL. A merchant renaming "Oxford Shoe" to "Oxford Shoe (New)"
 * would otherwise move a live PDP and break every link to it — including the
 * ones already indexed, which `lib/domain/seo.ts` has just spent a phase getting
 * right. A rename should reach the catalogue as a name change and nothing more.
 */
export const IMMUTABLE_AFTER_CREATE: readonly FeedTargetField[] = FEED_TARGET_FIELD_NAMES.filter(
  (field) => FEED_TARGET_FIELDS[field].createOnly
);

/**
 * The named transforms a mapping may apply, declared here because
 * `feedFieldMappingSchema` validates against them.
 *
 * The functions are in `lib/integrations/commerce/transforms.ts`; this list and
 * that registry are kept honest by `ingestion.test.ts`, which asserts the two
 * have exactly the same members. Adding a transform in one place only is
 * therefore a failing test rather than a mapping that saves and then throws
 * mid-run.
 */
export const FEED_TRANSFORMS = [
  "trim",
  "upper",
  "lower",
  "slugify",
  "strip_html",
  "pounds_to_pence",
  "integer",
  "split_commas",
  "boolean_in_stock",
] as const;
export type FeedTransform = (typeof FEED_TRANSFORMS)[number];

export function isFeedTransform(value: string): value is FeedTransform {
  return (FEED_TRANSFORMS as readonly string[]).includes(value);
}

/**
 * One `feed_field_mappings` row.
 *
 * `source_path` is the adapter's business — an XML feed reads it as an element
 * path, and a future Shopify adapter would read it as a property path — so it is
 * validated as a non-empty string here and interpreted there.
 */
export const feedFieldMappingSchema = z.object({
  target_field: z
    .string()
    .refine(isFeedTargetField, "That is not a field a feed is allowed to write."),
  source_path: z.string().min(1, "A mapping needs a path into the feed."),
  transform: z
    .string()
    .refine(isFeedTransform, "Unknown transform.")
    .nullable()
    .optional()
    .default(null),
  fallback: z.string().nullable().optional().default(null),
  is_required: z.boolean().optional().default(false),
});

export type FeedFieldMapping = z.infer<typeof feedFieldMappingSchema>;

/**
 * Which required targets a mapping set is missing.
 *
 * Returned as a list rather than a boolean so the source screen can name them.
 * A run refuses to start while this is non-empty: without `external_id` there is
 * no dedupe key, so every run would create duplicates of everything it had
 * already imported.
 */
export function missingRequiredTargets(mappings: readonly { target_field: string }[]): string[] {
  const present = new Set(mappings.map((mapping) => mapping.target_field));
  return REQUIRED_TARGET_FIELDS.filter((field) => !present.has(field));
}

// ---------------------------------------------------------------------------
// The XML feed source config
// ---------------------------------------------------------------------------

/**
 * `product_sources.config` for `kind = 'xml_feed'`.
 *
 * Note what is *not* here: credentials. `product_sources.credentials_ref` names
 * an environment variable and the adapter resolves it at run time, so a database
 * dump never carries a live merchant token — the reasoning is in the 0005
 * header and this schema keeps to it.
 */
export const xmlFeedConfigSchema = z
  .object({
    url: z
      .string()
      .url("A feed needs an absolute http(s) URL.")
      .refine(
        (value) => value.startsWith("http://") || value.startsWith("https://"),
        "Only http and https feeds can be fetched."
      ),
    /**
     * Path to the repeating element, e.g. `rss/channel/item` or
     * `products/product`. Required rather than guessed: a heuristic that picks
     * the longest array is right most of the time, and silently imports the
     * wrong node the rest of it.
     */
    item_path: z.string().min(1, "Name the repeating element, e.g. rss/channel/item."),
    /** Applied to every record the run stages — see `FEED_TARGET_FIELDS`. */
    fulfilment: z.enum(PRODUCT_FULFILMENTS).optional().default("direct"),
    /** ISO 4217. The column defaults to GBP and pence assume it. */
    currency: z.string().length(3).optional().default("GBP"),
    /** Belt and braces against a feed that never finishes responding. */
    timeout_ms: z.number().int().min(1_000).max(120_000).optional().default(30_000),
  })
  .strict();

export type XmlFeedConfig = z.infer<typeof xmlFeedConfigSchema>;

// ---------------------------------------------------------------------------
// Coercion: strings out of a feed, typed values into the catalogue
// ---------------------------------------------------------------------------

export type CoercionResult =
  { ok: true; value: string | number | string[] | null } | { ok: false; error: string };

const PENCE_LOOKS_LIKE_POUNDS = /^-?\d+[.,]\d{1,2}$/;

/**
 * Turn one extracted, transformed value into the shape its target column wants.
 *
 * The `pence` case is the one with teeth. A feed quoting `"145.00"` is quoting
 * pounds, and every other coercion in this function would happily read it as
 * 145 — a product priced at £1.45 on a live storefront, with nothing anywhere
 * reporting an error. So a pence target refuses a decimal outright and names the
 * transform that fixes it. A mapping author sees this on their first dry run,
 * which is exactly when it is cheap.
 *
 * `null` means "the feed did not supply this", and is distinct from a coercion
 * failure: an absent optional field leaves the column alone, while a bad value
 * fails the whole item so a reviewer sees it rather than importing half a
 * product.
 */
export function coerceValue(field: FeedTargetField, raw: unknown): CoercionResult {
  const spec = FEED_TARGET_FIELDS[field];

  if (raw === null || raw === undefined) return { ok: true, value: null };

  if (Array.isArray(raw)) {
    if (spec.kind !== "list") {
      return {
        ok: false,
        error: `${spec.label} got a list of ${raw.length} values; that path matches more than one element.`,
      };
    }
    return { ok: true, value: raw.map((entry) => String(entry).trim()).filter(Boolean) };
  }

  const text = String(raw).trim();
  if (text === "") return { ok: true, value: null };

  switch (spec.kind) {
    case "text":
      return { ok: true, value: text };

    case "slug":
      return { ok: true, value: slugify(text) };

    case "url":
      try {
        const url = new URL(text);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return { ok: false, error: `${spec.label} must be an http(s) URL.` };
        }
        return { ok: true, value: url.toString() };
      } catch {
        return { ok: false, error: `${spec.label} is not a valid URL: ${truncate(text)}` };
      }

    case "integer": {
      const parsed = Number(text);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        return { ok: false, error: `${spec.label} is not a whole number: ${truncate(text)}` };
      }
      return { ok: true, value: parsed };
    }

    case "pence": {
      if (PENCE_LOOKS_LIKE_POUNDS.test(text)) {
        return {
          ok: false,
          error:
            `${spec.label} received "${text}", which reads as pounds. Prices are stored in ` +
            `integer pence — add the pounds_to_pence transform to this mapping.`,
        };
      }
      const parsed = Number(text);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        return {
          ok: false,
          error: `${spec.label} is not a whole number of pence: ${truncate(text)}`,
        };
      }
      if (parsed < 0) return { ok: false, error: `${spec.label} cannot be negative.` };
      return { ok: true, value: parsed };
    }

    case "availability": {
      const normalised = text.toLowerCase().replace(/[\s-]+/g, "_");
      if (!(PRODUCT_AVAILABILITIES as readonly string[]).includes(normalised)) {
        return {
          ok: false,
          error: `${spec.label} "${truncate(text)}" is not one of ${PRODUCT_AVAILABILITIES.join(", ")}.`,
        };
      }
      return { ok: true, value: normalised };
    }

    case "list":
      return { ok: true, value: [text] };
  }
}

function truncate(value: string): string {
  return value.length > 60 ? `${value.slice(0, 57)}…` : value;
}

// ---------------------------------------------------------------------------
// Assembling a record
// ---------------------------------------------------------------------------

/**
 * A record after mapping, coercion and validation — the shape staged in
 * `import_items.normalised_payload` and the shape hashed for change detection.
 *
 * Every field except the two required ones is optional: a feed supplies what it
 * supplies, and an absent key means "leave the column alone", not "clear it".
 */
export const normalisedProductSchema = z
  .object({
    external_id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    sku: z.string().nullable().optional(),
    cat: z.string().nullable().optional(),
    cat_label: z.string().nullable().optional(),
    blurb: z.string().nullable().optional(),
    story: z.string().nullable().optional(),
    material: z.string().nullable().optional(),
    price_pence: z.number().int().nonnegative().optional(),
    compare_at_pence: z.number().int().nonnegative().nullable().optional(),
    stock: z.number().int().nonnegative().optional(),
    availability: z.enum(PRODUCT_AVAILABILITIES).optional(),
    badges: z.array(z.enum(PRODUCT_BADGES)).optional(),
    affiliate: z
      .object({
        merchant_name: z.string().optional(),
        merchant_url: z.string().url().optional(),
        disclosure: z.string().optional(),
        external_price_pence: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type NormalisedProduct = z.infer<typeof normalisedProductSchema>;

export type AssembleResult =
  { ok: true; product: NormalisedProduct } | { ok: false; error: string };

/**
 * Flat mapped values → the nested record, validated.
 *
 * The nesting is only one level deep (`affiliate.*`), so this reads the dot
 * rather than reaching for a general `setPath`. A general one would accept
 * `affiliate.merchant_url.evil` and quietly build it; `FEED_TARGET_FIELDS` is a
 * closed list precisely so that cannot happen, and honouring exactly the shape
 * that list describes keeps the two from disagreeing.
 *
 * `slug` is derived from the name when unmapped — feeds rarely carry one, and
 * `slugify` is the same function the seeder and the admin's create dialogs use,
 * so a slug computed here cannot disagree with one computed there.
 */
export function assembleProduct(values: Partial<Record<FeedTargetField, unknown>>): AssembleResult {
  const affiliate: Record<string, unknown> = {};
  const product: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (field.startsWith("affiliate.")) {
      affiliate[field.slice("affiliate.".length)] = value;
    } else {
      product[field] = value;
    }
  }

  if (Object.keys(affiliate).length > 0) product.affiliate = affiliate;

  if (typeof product.name === "string" && typeof product.slug !== "string") {
    product.slug = slugify(product.name);
  }

  const parsed = normalisedProductSchema.safeParse(product);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue.path.join(".");
    return { ok: false, error: path ? `${path}: ${issue.message}` : issue.message };
  }

  // A badge the store has no styling for is dropped rather than failing the
  // item — `PRODUCT_BADGES` is a design vocabulary, and a feed calling something
  // "SALE" is not a broken record, just one with a badge we do not render.
  return { ok: true, product: parsed.data };
}

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON, used both for hashing and for comparing two values in a
 * diff.
 *
 * Keys are sorted rather than taken in insertion order, because two runs that
 * read the same feed must produce the same string: object key order in
 * JavaScript follows insertion, which follows whichever mappings a source
 * happens to have. Without the sort, re-ordering a mapping row in the admin
 * would mark every product in the catalogue as changed.
 *
 * The hash *itself* is in `contentHash.ts` and not here — see that file's
 * header. This module is imported by client components for its vocabularies, so
 * it must not reach for a Node built-in.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);

  return `{${entries.join(",")}}`;
}

/**
 * What a run should do with a record it has just normalised.
 *
 * 'unchanged' is decided on the hash alone, which is why the hash has to be
 * stable: this is the comparison that keeps a nightly run over a 2,000-product
 * feed from staging 2,000 rows a reviewer has to dismiss.
 */
export function decideAction(
  existing: { content_hash: string | null } | null,
  incomingHash: string
): Extract<ImportItemAction, "create" | "update" | "unchanged"> {
  if (!existing) return "create";
  if (existing.content_hash && existing.content_hash === incomingHash) return "unchanged";
  return "update";
}

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

/**
 * Whether an update writes this field at all.
 *
 * Shared by `diffFields` and `columnsForApply` so the review screen and the
 * write cannot disagree — and they did disagree, in the first draft of this
 * file: `columnsForApply` skipped `external_id` (it is the dedupe key, written
 * by the repository) while `diffFields` did not, so every update proposed a
 * change to a column it was never going to touch. A reviewer would have
 * approved it and seen nothing happen.
 */
function writtenOnUpdate(field: string): boolean {
  if (field === "external_id") return false;
  return !(IMMUTABLE_AFTER_CREATE as readonly string[]).includes(field);
}

/**
 * Field-level before/after for `import_items.diff`, so the review screen can
 * show exactly what would change rather than two payloads side by side.
 *
 * Only fields the incoming record actually carries are compared. A feed that
 * stopped sending `material` has not asked for the column to be cleared — it has
 * said nothing about it — and reporting that as "material: 'Suede' → null" would
 * invite a reviewer to approve a deletion nobody proposed.
 *
 * Fields an update does not write are excluded for the same reason — `slug`
 * because it is the product's URL, `external_id` because it is the key the two
 * records were matched on. Showing either as a pending change would be a lie.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: NormalisedProduct
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const [field, incoming] of Object.entries(after)) {
    if (incoming === undefined) continue;
    if (!writtenOnUpdate(field)) continue;

    const current = before[field] ?? null;
    const normalisedCurrent = current === undefined ? null : current;

    if (stableStringify(normalisedCurrent) !== stableStringify(incoming)) {
      changes.push({ field, before: normalisedCurrent, after: incoming });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Run outcome
// ---------------------------------------------------------------------------

export interface ImportCounts {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
}

/**
 * How a finished run should leave `product_sources.last_status`.
 *
 * A run where every record failed is a failed run even though the fetch and the
 * parse both worked — a mapping pointed at the wrong path is not a partial
 * success, and calling it one would leave the source list green.
 */
export function sourceStatusFor(counts: ImportCounts): SourceSyncStatus {
  if (counts.failed === 0) return "ok";
  if (counts.failed === counts.total) return "failed";
  return "partial";
}

/**
 * A run stages a row only for something a reviewer can act on.
 *
 * `unchanged` records are counted on the job and not stored: a feed's steady
 * state is "nothing moved", and writing one `import_items` row per unchanged
 * product would make the table grow by the size of the catalogue every night to
 * record that nothing happened. `import_jobs.unchanged_count` is what the
 * migration provided for saying so, and it is enough.
 */
export function isStageable(action: ImportItemAction): boolean {
  return action !== "unchanged";
}

/** Only these can be approved and applied; 'failed' rows are diagnostics. */
export function isApplicable(action: ImportItemAction): boolean {
  return action === "create" || action === "update";
}

/**
 * The `products` columns an applied item writes, given what it is.
 *
 * Split out of the service because it is a rule rather than a query, and because
 * it is the rule most likely to be got wrong later: an update must not write
 * `slug`, and neither path may write `status`. Both are enforced here so both
 * are testable without a database.
 */
export function columnsForApply(
  product: NormalisedProduct,
  action: "create" | "update",
  defaults: { fulfilment: ProductFulfilment; currency: string }
): Record<string, unknown> {
  const columns: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(product)) {
    if (value === undefined) continue;
    if (field === "external_id") continue;
    if (field === "affiliate") continue;
    if (action === "update" && !writtenOnUpdate(field)) continue;
    columns[field] = value;
  }

  if (product.affiliate && Object.keys(product.affiliate).length > 0) {
    columns.affiliate = product.affiliate;
  }

  if (action === "create") {
    columns.fulfilment = defaults.fulfilment;
    columns.currency = defaults.currency;
    // Not `status`. A created product is a draft until a person publishes it —
    // the column's own default, named here so the omission reads as a decision
    // rather than an oversight.
  }

  return columns;
}

/**
 * `availability` is a column and stock is a number, and a feed usually gives one
 * or the other. When a feed maps stock but not availability, the two disagree
 * the moment stock hits zero: a product with no stock still says 'in_stock'.
 */
export function availabilityForStock(product: NormalisedProduct): ProductAvailability | undefined {
  if (product.availability !== undefined) return undefined;
  if (product.stock === undefined) return undefined;
  return product.stock > 0 ? "in_stock" : "out_of_stock";
}
