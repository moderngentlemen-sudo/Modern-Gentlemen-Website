/**
 * The interface every product source sits behind.
 *
 * `0005_commerce.sql` put XML feeds and Shopify in one `product_sources` table
 * on purpose — "XML and Shopify are adapters behind the same interface, so they
 * share this table and the ingestion pipeline in 0006". This file is that
 * interface, written while there is one adapter so that the second one is a new
 * file rather than a branch through `lib/services/ingestion.ts`.
 *
 * Two shapes are worth noticing.
 *
 * `fetchRecords` takes its `fetch` from the caller. That is the same injected-
 * dependency stance `lib/blocks/binding.ts` takes towards its sources, and it is
 * what lets the XML adapter be tested against a fixture feed with no network and
 * no stubbing of globals.
 *
 * `readPath` belongs to the adapter rather than to the pipeline because a source
 * path means different things to different providers: `item/title` is an element
 * path in XML and would be a property path in JSON. The pipeline stores the
 * string and never interprets it.
 */

import type { ProductSourceKind } from "@/lib/domain/ingestion";

/** Injected so a run is testable without a network. */
export interface AdapterContext {
  fetch: typeof globalThis.fetch;
  /**
   * The value behind `product_sources.credentials_ref`, already resolved from
   * the environment — the adapter never reads `process.env` itself, so a
   * credential cannot be read by an adapter that was not given one.
   */
  credential: string | null;
  /**
   * How an adapter waits between retries. Defaults to a real timer.
   *
   * Injected for the same reason `fetch` is: a test that proves the Shopify
   * adapter waits out a 429 should not spend four real seconds doing it, and a
   * suite that does spend them is a suite people stop running. Nothing in
   * production passes this.
   */
  wait?: (ms: number) => Promise<void>;
}

export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface SourceAdapter<Config> {
  readonly kind: ProductSourceKind;

  /** Throws (a `ZodError`) if `product_sources.config` is not usable. */
  parseConfig(config: unknown): Config;

  /** One entry per product in the provider's payload, unparsed by us. */
  fetchRecords(config: Config, context: AdapterContext): Promise<unknown[]>;

  /**
   * Read one `feed_field_mappings.source_path` out of a record.
   *
   * Returns `null` for a path that matches nothing, and an array for a path that
   * matches more than one node — `coerceValue` turns the second into an error
   * for every target except a list, which is the honest answer: a mapping that
   * matches three elements has not found one value.
   */
  readPath(record: unknown, path: string): unknown;
}
