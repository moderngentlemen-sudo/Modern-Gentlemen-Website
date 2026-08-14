/**
 * The adapter registry, and the one place a feed credential is read.
 *
 * `native` has no adapter by design: a hand-entered product has no provider to
 * sync from, which is what `kind = 'native'` means. Asking for one is a
 * programming error rather than a configuration error, so it throws.
 */

import type { ProductSourceKind } from "@/lib/domain/ingestion";
import { shopifyAdapter } from "./shopify";
import { AdapterError, type SourceAdapter } from "./types";
import { xmlFeedAdapter } from "./xmlFeed";

export { AdapterError } from "./types";
export type { AdapterContext, SourceAdapter } from "./types";
export { applyTransform, TRANSFORMS } from "./transforms";
export { shopifyAdapter } from "./shopify";
export { xmlFeedAdapter } from "./xmlFeed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ADAPTERS: Partial<Record<ProductSourceKind, SourceAdapter<any>>> = {
  xml_feed: xmlFeedAdapter,
  shopify: shopifyAdapter,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adapterFor(kind: ProductSourceKind): SourceAdapter<any> {
  const adapter = ADAPTERS[kind];
  if (!adapter) {
    throw new AdapterError(
      kind === "native"
        ? "A native source has no feed to import from."
        : `No adapter is implemented for a ${kind} source yet.`
    );
  }
  return adapter;
}

/**
 * The prefix a `product_sources.credentials_ref` must carry.
 *
 * This is a guard, not a convention. `credentials_ref` is a *string an operator
 * types into a form*, and resolving it means indexing `process.env` with it — so
 * without a restriction, someone holding `integration.write` could point a
 * source at `SUPABASE_SERVICE_ROLE_KEY` and have the run send it, as a bearer
 * token, to a URL they also control. That is a service-role key exfiltrated
 * through a feature whose whole purpose is to make outbound requests.
 *
 * Requiring `FEED_` costs nothing (a feed credential has to be added to the
 * deployment by hand anyway) and closes the hole completely: the only variables
 * reachable are ones deliberately named for this.
 */
export const CREDENTIAL_PREFIX = "FEED_";
const CREDENTIAL_NAME = /^FEED_[A-Z0-9_]+$/;

export function isCredentialRef(ref: string): boolean {
  return CREDENTIAL_NAME.test(ref);
}

/**
 * Resolve `product_sources.credentials_ref` to a value, or throw a sentence an
 * editor can act on.
 *
 * ⚠️ This is the first dynamic `process.env[...]` read in the repository, and
 * `scripts/check-env.mjs` is a regex over source text — PROGRESS.md's own note
 * on the checker says a dynamic read is invisible to it and that "nothing does
 * that today". That stopped being true here. The mitigation is the naming rule
 * above rather than a declaration: a feed credential belongs to a *source row*,
 * not to the codebase, so there is no fixed name `.env.example` could carry.
 */
export function resolveCredential(ref: string | null | undefined): string | null {
  if (!ref) return null;

  if (!isCredentialRef(ref)) {
    throw new AdapterError(
      `A credential reference must name an environment variable beginning with ` +
        `${CREDENTIAL_PREFIX} (got "${ref}").`
    );
  }

  const value = process.env[ref];
  if (!value) {
    throw new AdapterError(`The environment variable ${ref} is not set on this deployment.`);
  }

  return value;
}
