/**
 * The content hash change detection compares against — split out of
 * `ingestion.ts` for a build-time reason worth writing down.
 *
 * This is one function, and it belongs beside `decideAction` conceptually. It
 * lives alone because it needs `node:crypto`, and `ingestion.ts` is imported by
 * **client** components: `/admin/integrations/[id]` reads `FEED_TARGET_FIELDS`
 * and `FEED_TRANSFORMS` from it to build the mapping editor. A client component
 * importing a module that imports `node:crypto` drags a Node built-in into the
 * browser bundle, and webpack refuses it:
 *
 *     Module build failed: UnhandledSchemeError:
 *     Reading from "node:crypto" is not handled by plugins
 *
 * Nothing catches this earlier. `tsc`, ESLint and the whole unit suite pass —
 * Vitest resolves `node:crypto` happily because it runs in Node. It fails only
 * at `next build`, which is exactly why `CLAUDE.md` says to run one before
 * anything touching routing, and it is the same shape as the rule that a route
 * file may export only its page component.
 *
 * So the boundary this file draws is: **`lib/domain/ingestion.ts` is safe for a
 * client component, and this module is not.** Only `lib/services/ingestion.ts`
 * imports it. `lib/domain/jobs.ts` reaches for `node:crypto` too and has never
 * had the problem, because nothing on a client imports it — the difference is
 * the importer, not the module.
 */

import { createHash } from "node:crypto";

import { stableStringify, type NormalisedProduct } from "./ingestion";

/**
 * A stable hash of a normalised record, written to `products.content_hash` when
 * an item is applied and compared against on the next run. Stability comes from
 * `stableStringify`; see its comment for why the key sort matters.
 *
 * SHA-256 rather than something cheaper because the cost is irrelevant here (one
 * hash per feed record) and because a collision would silently mean "unchanged"
 * — a product whose price moved would never be re-imported, and nothing would
 * report it.
 */
export function contentHashOf(product: NormalisedProduct): string {
  return createHash("sha256").update(stableStringify(product)).digest("hex");
}
