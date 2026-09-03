/**
 * The Shopify adapter — `product_sources.kind = 'shopify'`.
 *
 * The second adapter behind `SourceAdapter`, and the one `types.ts` was written
 * in advance for: "written while there is one adapter so that the second one is
 * a new file rather than a branch through `lib/services/ingestion.ts`". That
 * held. Nothing in the pipeline, the review screen, change detection or the
 * apply path knows this file exists — the service reaches it through
 * `adapterFor(source.kind)` and nothing else.
 *
 * Reads the **Admin REST API** (`GET /admin/api/<version>/products.json`) with a
 * plain `fetch` and no SDK. Two things follow from that choice and are worth
 * knowing before changing anything here.
 *
 * **Authentication is mandatory, unlike a feed.** There is no anonymous products
 * endpoint, so a source with no `credentials_ref` fails before a request is
 * made rather than collecting a 401 from Shopify.
 *
 * **Prices arrive as JSON strings** — `"price": "145.00"` — and `JSON.parse`
 * preserves that. It is the same property `parseTagValue: false` buys the XML
 * adapter, and it is load-bearing for the same reason: `coerceValue`'s
 * pounds-vs-pence guard recognises pounds by the decimal point, so a price that
 * arrived as the number 145 would import a £145 jacket at £1.45 with nothing
 * reporting an error. Do not add any numeric coercion to this file.
 */

import { shopifyConfigSchema, type ShopifyConfig } from "@/lib/domain/ingestion";
import { fetchCapped, type RetryPolicy } from "./http";
import { isPresent, segmentsOf, walk } from "./paths";
import { AdapterError, type AdapterContext, type SourceAdapter } from "./types";

export const shopifyAdapter: SourceAdapter<ShopifyConfig> = {
  kind: "shopify",

  parseConfig(config: unknown): ShopifyConfig {
    return shopifyConfigSchema.parse(config ?? {});
  },

  async fetchRecords(config: ShopifyConfig, context: AdapterContext): Promise<unknown[]> {
    if (!context.credential) {
      throw new AdapterError(
        "A Shopify source needs an access token. Set the source's credential variable to a " +
          "FEED_-prefixed environment variable holding the app's Admin API token."
      );
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "ModernGentlemen-Ingestion/1.0",
      "x-shopify-access-token": context.credential,
    };

    const products: unknown[] = [];
    let url: string | null = firstPageUrl(config);
    let pages = 0;

    while (url && pages < config.max_pages) {
      const response = await fetchCapped(context.fetch, url, {
        subject: "The Shopify API",
        headers,
        timeoutMs: config.timeout_ms,
        // See the note on `redirect` in ./http — the token is in a custom header
        // and `fetch` would carry it across a redirect to any host.
        redirect: "manual",
        describeStatus,
        retry: { ...RATE_LIMIT_RETRY, wait: context.wait },
      });

      products.push(...productsIn(response.text));
      pages += 1;
      url = nextPageUrl(response.headers, config);
    }

    return products;
  },

  /**
   * The same slash-separated path the XML adapter reads, over JSON.
   *
   * Shopify's payload is JSON, where dot notation would be the native
   * convention — but the mapping editor's help text, every path already stored
   * in `feed_field_mappings`, and the XML adapter all speak slashes, and one
   * separator means one thing for an author to learn. `variants/0/price` is the
   * first variant's price; `variants/sku` is every variant's SKU, which arrives
   * as an array and which `coerceValue` then refuses for any target that is not
   * a list. That refusal is correct: a mapping matching three SKUs has not found
   * one value.
   *
   * No `#text` unwrapping — that is a property of the XML parser. A JSON leaf is
   * already its own value, and an object or array reaching a scalar target is
   * returned as it is so `coerceValue` can refuse it in its own words.
   */
  readPath(record: unknown, path: string): unknown {
    const value = walk(record, segmentsOf(path));
    if (value === undefined) return null;

    if (Array.isArray(value)) {
      const flattened = value.flat().filter(isPresent);
      if (flattened.length === 0) return null;
      return flattened.length === 1 ? flattened[0] : flattened;
    }

    return isPresent(value) ? value : null;
  },
};

function firstPageUrl(config: ShopifyConfig): string {
  const query = new URLSearchParams({
    limit: String(config.page_size),
    status: config.status,
  });
  return `https://${config.shop_domain}/admin/api/${config.api_version}/products.json?${query}`;
}

function productsIn(body: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new AdapterError(
      `The Shopify API did not answer with JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const products =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).products : undefined;

  if (!Array.isArray(products)) {
    throw new AdapterError(
      `The Shopify API answered without a products array. It returned ${describeShape(parsed)}.`
    );
  }

  return products;
}

/**
 * Shopify paginates by cursor, in a `Link` header:
 * `<https://shop.myshopify.com/admin/api/2026-07/products.json?limit=250&page_info=xyz>; rel="next"`
 *
 * The URL is used **verbatim** because Shopify refuses `page_info` combined with
 * any other filter — rebuilding it from the config would drop the cursor or be
 * rejected outright.
 *
 * ⚠️ It is still validated against the configured shop. The header is remote
 * input, and every request carries the merchant's Admin API token; a `Link`
 * pointing somewhere else is either a compromise or a bug, and following it
 * would hand the token over. Same reasoning as `redirect: "manual"` above.
 */
function nextPageUrl(headers: Headers, config: ShopifyConfig): string | null {
  const link = headers.get("link");
  if (!link) return null;

  for (const part of link.split(",")) {
    const match = /^\s*<([^>]+)>\s*;\s*rel\s*=\s*"?next"?/i.exec(part);
    if (!match) continue;

    const candidate = match[1];
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new AdapterError(`The Shopify API sent an unreadable next-page link: ${candidate}`);
    }

    if (parsed.protocol !== "https:" || parsed.hostname !== config.shop_domain) {
      throw new AdapterError(
        `The Shopify API sent a next-page link pointing at ${parsed.host}, not ${config.shop_domain}. ` +
          "Refusing to follow it — the request carries this shop's access token."
      );
    }

    return parsed.toString();
  }

  return null;
}

/**
 * How a 429 is waited out.
 *
 * ⚠️ **This reverses an earlier decision, and the earlier reasoning is worth
 * keeping because it was half right.** It said backoff belonged with the queued
 * runs `import_jobs.status` has a `'queued'` value for, "not inside a server
 * action that is holding a request open", and that saying so beat "a silent
 * retry that makes the same run take four minutes". The danger is real; the
 * magnitude was assumed. Shopify's REST Admin API refills its leaky bucket at
 * two requests a second and answers `Retry-After: 2.0` — it is asking for two
 * seconds. Four minutes was never on offer, and refusing to wait two seconds
 * throws away every page the run had already fetched.
 *
 * The bounds below are what make the reversal safe. `totalDelayBudgetMs` is the
 * one that matters: **10 seconds is the most this can add to any one request**,
 * whatever the provider asks for. Note the unit — per *request*, not per run, so
 * a twelve-page walk being limited on every page could spend it twelve times.
 * `max_pages` is what bounds that, and a run hitting the limit on every page has
 * a page size that needs lowering, which is exactly what the 429 message says.
 *
 * Only 429. A 401, 403 or 404 will not fix itself in two seconds, and retrying
 * a 5xx is a different judgement about idempotence that this adapter has no
 * reason to make.
 */
const RATE_LIMIT_RETRY: RetryPolicy = {
  statuses: [429],
  maxAttempts: 3,
  maxDelayMs: 5_000,
  totalDelayBudgetMs: 10_000,
  // Shopify's own answer is 2s; this is what is used when the header is missing
  // or unparseable, which should not happen and does.
  defaultDelayMs: 2_000,
};

/**
 * Statuses worth a better sentence than "answered 401 Unauthorized".
 */
function describeStatus(response: Response): string | null {
  switch (response.status) {
    case 401:
      return "Shopify rejected the access token (401). Check the credential variable names the right token and that the app is still installed.";
    case 403:
      return "Shopify refused the request (403). The app's token is missing the read_products scope.";
    case 402:
      return "The Shopify store is frozen or unavailable (402). Nothing can be imported until the merchant resolves it.";
    case 404:
      return "Shopify answered 404. Check the shop domain and the API version — a retired version answers this way.";
    case 429:
      // Reached only after the retries above are exhausted, so the advice is
      // "change something", not "try again" — trying again is what just failed.
      return "Shopify rate-limited the run (429) and was still limiting it after three attempts. Lower the page size, or run it again in a few minutes.";
    default:
      return null;
  }
}

function describeShape(parsed: unknown): string {
  if (parsed === null) return "null";
  if (Array.isArray(parsed)) return "an array";
  if (typeof parsed !== "object") return typeof parsed;
  const keys = Object.keys(parsed as Record<string, unknown>);
  return keys.length > 0 ? `an object with ${keys.join(", ")}` : "an empty object";
}
