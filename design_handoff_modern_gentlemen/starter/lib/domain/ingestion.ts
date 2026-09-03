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
  "text" | "slug" | "url" | "integer" | "pence" | "availability" | "list" | "urlList";

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
 * `images` is the one target here that is **not a column**, and it is called out
 * rather than left to be discovered: it stages a list of URLs, and `applyJob`
 * turns those into `media_assets` rows and `product_media` links *after* the
 * product row is written. `columnsForApply` excludes it by name — copied blindly
 * it would reach `products` as a column that does not exist, and the failure
 * would land on the apply of a run that had already validated cleanly.
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
  images: { kind: "urlList", label: "Image URLs" },
  collections: { kind: "list", label: "Collections" },
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
// The Shopify source config
// ---------------------------------------------------------------------------

/** Current stable Admin API version for newly created Shopify sources. */
export const DEFAULT_SHOPIFY_API_VERSION = "2026-07";

/**
 * `product_sources.config` for `kind = 'shopify'`.
 *
 * Same stance on credentials as the XML schema above: the token is never stored
 * here. It is `credentials_ref` naming a `FEED_`-prefixed environment variable,
 * resolved at run time.
 *
 * The two fields worth explaining are the caps. `page_size` and `max_pages`
 * exist because a Shopify catalogue is paginated and a run holds a server action
 * open for its whole duration — an unbounded walk over a large merchant's
 * products is the failure mode, and it arrives as a timeout with no explanation.
 * The defaults (250 x 20) admit 5,000 products, which is well past what this
 * store is for and small enough to fail quickly when a domain is wrong.
 */
export const shopifyConfigSchema = z
  .object({
    /**
     * The `*.myshopify.com` admin domain, not the storefront's custom domain and
     * not a URL. Validated rather than normalised: a merchant pasting
     * `https://shop.example.com/admin` has given the wrong thing, and repairing
     * it silently would send a token to a host they did not name.
     */
    shop_domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/,
        "Use the shop's myshopify.com domain, e.g. modern-gentlemen.myshopify.com — not a URL and not a custom domain."
      ),
    /**
     * Shopify versions its Admin API quarterly and retires a version after a
     * year. Pinned per source so one merchant can move without moving the rest,
     * and explicit so an upgrade is a deliberate edit rather than a silent drift
     * in what the same mapping means.
     */
    api_version: z
      .string()
      .regex(/^\d{4}-\d{2}$/, `An API version looks like ${DEFAULT_SHOPIFY_API_VERSION}.`)
      .optional()
      .default(DEFAULT_SHOPIFY_API_VERSION),
    /** Shopify's own maximum is 250. */
    page_size: z.number().int().min(1).max(250).optional().default(250),
    /** Bounds a run — see the header. */
    max_pages: z.number().int().min(1).max(100).optional().default(20),
    /**
     * `any` is offered but not the default: a merchant's drafts and archived
     * products are theirs, and importing them by default stages proposals nobody
     * asked for.
     */
    status: z.enum(["active", "archived", "draft", "any"]).optional().default("active"),
    /** Applied to every record the run stages — see `FEED_TARGET_FIELDS`. */
    fulfilment: z.enum(PRODUCT_FULFILMENTS).optional().default("direct"),
    /** ISO 4217. The column defaults to GBP and pence assume it. */
    currency: z.string().length(3).optional().default("GBP"),
    /** Per page request, not for the whole walk. */
    timeout_ms: z.number().int().min(1_000).max(120_000).optional().default(30_000),
  })
  .strict();

export type ShopifyConfig = z.infer<typeof shopifyConfigSchema>;

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
/**
 * Every entry an http(s) URL, or the whole list fails.
 *
 * All-or-nothing on purpose, and it matches how the rest of coercion behaves: a
 * bad value fails the *item*, so a reviewer sees it rather than importing a
 * product with three of its five photographs and no indication which two went
 * missing. A feed that emits one broken URL among good ones is a feed worth
 * looking at.
 *
 * ⚠️ **`data:` and `file:` are refused along with everything else non-http.**
 * These URLs are fetched by the server during apply, so the protocol check is
 * the boundary that stops a feed pointing the importer at the local filesystem.
 */
function coerceUrlList(label: string, entries: string[]): CoercionResult {
  const urls: string[] = [];

  for (const entry of entries) {
    try {
      const url = new URL(entry);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, error: `${label} must be http(s) URLs; got ${truncate(entry)}` };
      }
      urls.push(url.toString());
    } catch {
      return {
        ok: false,
        error: `${label} contains a value that is not a URL: ${truncate(entry)}`,
      };
    }
  }

  // Deduplicated here rather than at apply: a feed repeating the same image is
  // common, and the alternative is a gallery with the same photograph twice.
  return { ok: true, value: [...new Set(urls)] };
}

export function coerceValue(field: FeedTargetField, raw: unknown): CoercionResult {
  const spec = FEED_TARGET_FIELDS[field];

  if (raw === null || raw === undefined) return { ok: true, value: null };

  if (Array.isArray(raw)) {
    if (spec.kind !== "list" && spec.kind !== "urlList") {
      return {
        ok: false,
        error: `${spec.label} got a list of ${raw.length} values; that path matches more than one element.`,
      };
    }
    const entries = raw.map((entry) => String(entry).trim()).filter(Boolean);
    return spec.kind === "urlList"
      ? coerceUrlList(spec.label, entries)
      : { ok: true, value: entries };
  }

  const text = String(raw).trim();
  if (text === "") return { ok: true, value: null };

  switch (spec.kind) {
    case "text":
      return { ok: true, value: text };

    // A feed with exactly one image matches one node, so the adapter hands back
    // a string rather than an array. Treated as a one-entry list rather than
    // refused: "this product has a single photograph" is the common case, not a
    // malformed mapping.
    case "urlList":
      return coerceUrlList(spec.label, [text]);

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
    /** URLs, not asset ids. `applyJob` fetches them and catalogues the result. */
    images: z.array(z.string().url()).optional(),
    collections: z
      .array(z.object({ slug: z.string().min(1), label: z.string().min(1) }).strict())
      .optional(),
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
    } else if (field === "collections" && Array.isArray(value)) {
      const bySlug = new Map<string, string>();
      for (const entry of value) {
        const label = String(entry).trim().replace(/\s+/g, " ");
        const slug = slugify(label);
        if (slug && !bySlug.has(slug)) bySlug.set(slug, label);
      }
      product.collections = [...bySlug].map(([slug, label]) => ({ slug, label }));
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

    if (field === "collections" && Array.isArray(incoming)) {
      const present = Array.isArray(normalisedCurrent) ? normalisedCurrent : [];
      const slugs = new Set(
        present.flatMap((entry) =>
          entry &&
          typeof entry === "object" &&
          typeof (entry as { slug?: unknown }).slug === "string"
            ? [(entry as { slug: string }).slug]
            : []
        )
      );
      const additions = incoming.filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof (entry as { slug?: unknown }).slug === "string" &&
          !slugs.has((entry as { slug: string }).slug)
      );
      if (additions.length > 0) {
        changes.push({ field, before: present, after: [...present, ...additions] });
      }
      continue;
    }

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
    // ⚠️ Not a column. `images` stages URLs that `applyJob` turns into
    // `media_assets` rows and `product_media` links after this row is written;
    // copied through here it would reach `products` as a column that does not
    // exist, failing the apply of a run that validated cleanly.
    if (field === "images" || field === "collections") continue;
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

/**
 * How many of a product's images this run will actually fetch.
 *
 * ⚠️ **Two caps, and the per-run one is the load-bearing half.** `applyJob`
 * holds a server action open for its whole duration — a known cost, recorded
 * since the ingestion phase — and images multiply it: fifty products with five
 * photographs each is 250 downloads inside one request. The per-product cap
 * bounds a single pathological record; the per-run budget bounds the request.
 *
 * **Truncating is safe here in a way it usually is not**, and that is what makes
 * a budget the right answer rather than a queue: the image import is idempotent
 * end to end. `uploadAsset` deduplicates on a SHA-256 of the bytes, and
 * `attachProductMedia` upserts on `(product_id, asset_id)` — so re-running apply
 * costs nothing for what already landed and picks up exactly what was skipped.
 * The message says so, because "47 images not imported" without "run apply
 * again" reads as data loss.
 */
export const MAX_IMAGES_PER_PRODUCT = 8;
export const MAX_IMAGE_DOWNLOADS_PER_RUN = 60;

/**
 * How many items one apply call writes.
 *
 * ⚠️ **This is the fix for "a run holds a server action open for its whole
 * duration", and it is deliberately *not* the queue `PROGRESS.md` predicted.**
 * That note proposed a background worker on the strength of
 * `import_jobs.status` already carrying a `'queued'` value. Reading the apply
 * path first showed most of a queue was already here: `applyJob` selects only
 * `approved` items and marks each the moment it is written, so it has always
 * been **idempotent and resumable** — calling it twice applies each item once.
 * What it lacked was a bound and a way to say "there is more".
 *
 * Bounding instead of queueing keeps three things a worker would have cost: the
 * editor sees progress as it happens; the apply still runs **as the editor**, so
 * `product.write` and `media.write` are checked against a real session rather
 * than a service-role client that outranks both; and there is no new route,
 * workflow or latency floor. A queue would have had to answer "may this job
 * import images?" with no session to ask — and the honest answers were a new
 * column or a quiet privilege escalation.
 *
 * `'queued'` therefore stays unused, and that is now a recorded decision rather
 * than an oversight. It remains the right value for a webhook-driven run, which
 * genuinely has no session.
 *
 * Twenty-five is well inside every platform request timeout even when each item
 * carries images, and `MAX_IMAGE_DOWNLOADS_PER_RUN` bounds the slow part
 * independently.
 */
export const APPLY_BATCH_SIZE = 25;

export interface ImageImportPlan {
  take: string[];
  /** Left for a later apply — never discarded, never silently dropped. */
  skipped: number;
}

export function imageImportPlan(
  urls: readonly string[],
  budget: { remaining: number; perProduct?: number }
): ImageImportPlan {
  const perProduct = budget.perProduct ?? MAX_IMAGES_PER_PRODUCT;
  const allowed = Math.max(0, Math.min(perProduct, budget.remaining));
  return { take: urls.slice(0, allowed), skipped: Math.max(0, urls.length - allowed) };
}

/**
 * A file name for an image the feed named only by URL.
 *
 * The path's last segment, percent-decoded and stripped of anything that is not
 * a plain file-name character. **Not used to address storage** — `uploadAsset`
 * generates the storage path — so this is a label in the media library rather
 * than a security boundary; it is sanitised anyway because it reaches a
 * `Content-Disposition` eventually and because `../..` in a library listing is
 * alarming whether or not it is exploitable.
 */
export function imageFileNameFrom(url: string, fallback = "image"): string {
  let last = "";
  try {
    last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    last = "";
  }

  const cleaned = last.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+/, "");
  if (!cleaned) return fallback;
  return cleaned.slice(0, 120);
}

/**
 * Whether these bytes may be imported as an image, and the MIME type if so.
 *
 * A discriminated result rather than `string | null`, so the caller narrows to a
 * non-null `mimeType` by checking the thing it was going to check anyway. The
 * `null`-means-fine shape needed a non-null assertion at the one call site,
 * which is the sort of small lie that outlives the reason for it.
 *
 * Pure, and separated from the fetch for the reason the ingestion E2E gives for
 * never running an import — "a fixture served from the test process would be
 * testing Playwright's ability to serve a file". The only honest coverage of the
 * image path is the part decidable without a network, so as much as possible of
 * it lives here.
 */
export type ImageTypeCheck = { ok: true; mimeType: string } | { ok: false; problem: string };

export function imageTypeProblem(contentType: string | null, byteLength: number): ImageTypeCheck {
  if (byteLength === 0) return { ok: false, problem: "the source returned an empty response." };

  if (!contentType) {
    return {
      ok: false,
      problem: `the source sent no content-type (${byteLength} bytes), so this may not be an image.`,
    };
  }

  // ⚠️ **The case this exists for is a feed answering a photograph URL with an
  // HTML error page.** `uploadAsset` would refuse it too, but its message is
  // written for someone standing at an upload dialog; a merchant reading a
  // failed run needs to be told their CDN served a 200 with the wrong thing.
  if (!contentType.startsWith("image/")) {
    return {
      ok: false,
      problem:
        `expected an image, got ${contentType} (${byteLength} bytes)` +
        (contentType === "text/html" ? " — usually an error page served as 200." : "."),
    };
  }

  // ⚠️ **SVG is an image and also a script host.** `media_assets` serves from a
  // public bucket, so an SVG a merchant controls would be stored XSS on our own
  // origin. Refused for *imported* media specifically: a person uploading one
  // through the library has made a decision, and a feed has not.
  if (contentType === "image/svg+xml") {
    return {
      ok: false,
      problem:
        "SVG is not imported from a feed: it can carry script, and it would be served from our own origin.",
    };
  }

  return { ok: true, mimeType: contentType };
}

// ---------------------------------------------------------------------------
// Scheduling — `product_sources.sync_schedule`
//
// ⚠️ **This vocabulary lives here and not in `lib/domain/jobs.ts`**, which is
// where the other job constants are. `jobs.ts` imports `node:crypto`, and
// `SourceEditor.tsx` is a client component: an `import` from a client component
// into a module touching a Node built-in is `UnhandledSchemeError` at build
// time, with `tsc`, ESLint and the whole unit suite green beforehand. The rule
// is in the repo's CLAUDE.md and this is the second module it applies to. The
// *job key* stays in `jobs.ts`, because only the route and the service use it.
// ---------------------------------------------------------------------------

/**
 * How often a source re-fetches, as a small closed vocabulary.
 *
 * ⚠️ **Deliberately not cron.** The column is free text and would hold a
 * quarter-hourly cron expression happily — and the thing firing it is GitHub
 * Actions, which
 * this repo has already measured drifting **over ninety minutes** on a quiet
 * repository (see the scheduled-publish phase). A cron field would let an
 * operator write a precision the platform cannot deliver, and the first person
 * to notice would be the merchant whose 15-minute sync ran twice that morning.
 * Four coarse options promise only what is true.
 *
 * `off` is the absence of a schedule and is stored as SQL `null`, not the
 * string "off": the column existed for four phases holding null on every row,
 * and a second falsy value would mean every reader had to know about both.
 */
export const SYNC_SCHEDULES = ["hourly", "daily", "weekly"] as const;
export type SyncSchedule = (typeof SYNC_SCHEDULES)[number];

export function isSyncSchedule(value: unknown): value is SyncSchedule {
  return typeof value === "string" && (SYNC_SCHEDULES as readonly string[]).includes(value);
}

/** Shown beside the selector. Says the tolerance out loud, because it is real. */
export const SYNC_SCHEDULE_LABEL: Record<SyncSchedule, string> = {
  hourly: "Hourly — roughly, whenever the runner next fires",
  daily: "Daily",
  weekly: "Weekly",
};

const HOUR = 60 * 60 * 1000;

export const SYNC_INTERVAL_MS: Record<SyncSchedule, number> = {
  hourly: HOUR,
  daily: 24 * HOUR,
  weekly: 7 * 24 * HOUR,
};

/**
 * The grace the due check allows, and it is not a rounding convenience.
 *
 * A poller that fires every N minutes and asks "has a full hour elapsed?" turns
 * an hourly schedule into a *two*-hourly one whenever a tick lands a few seconds
 * early — the classic cron-catchup mistake, and it looks like the feature simply
 * running at half the configured rate. Allowing a source to be due slightly
 * before its interval closes means a schedule keeps its intended cadence instead
 * of drifting a whole period every time the poller jitters.
 *
 * Five minutes is well under the shortest interval, so no schedule can run twice
 * within a period because of it.
 */
export const SYNC_DUE_GRACE_MS = 5 * 60 * 1000;

/**
 * Whether a source with this schedule is due to run.
 *
 * `null` schedule means no schedule: never due. A source that has never synced
 * is due immediately — the first run is the one an operator is waiting for after
 * setting a schedule, and making them wait a full period for it reads as the
 * setting not having worked.
 *
 * ⚠️ **`lastSyncedAt` is `product_sources.last_synced_at`, which records the
 * last *attempt*, not the last success.** That is deliberate: a source whose
 * feed is down would otherwise be retried by every single tick, hammering a
 * server that is already struggling. A failed run waits its interval like any
 * other, and `last_status` is what tells an operator it failed.
 */
export function isSyncDue(
  schedule: string | null | undefined,
  lastSyncedAt: string | Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!isSyncSchedule(schedule)) return false;
  if (!lastSyncedAt) return true;

  const last = lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt);
  if (Number.isNaN(last.getTime())) return true;

  // A clock that has gone backwards, or a row written by a machine ahead of
  // this one. Treated as "not due" rather than "due": running early is a
  // choice, and one made by a wrong clock is not a choice anybody made.
  const elapsed = now.getTime() - last.getTime();
  if (elapsed < 0) return false;

  return elapsed >= SYNC_INTERVAL_MS[schedule] - SYNC_DUE_GRACE_MS;
}
