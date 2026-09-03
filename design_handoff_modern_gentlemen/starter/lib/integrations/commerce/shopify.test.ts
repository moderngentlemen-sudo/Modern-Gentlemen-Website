import { describe, expect, it } from "vitest";

import {
  coerceValue,
  DEFAULT_SHOPIFY_API_VERSION,
  shopifyConfigSchema,
  type ShopifyConfig,
} from "@/lib/domain/ingestion";
import { shopifyAdapter } from "./shopify";
import { AdapterError } from "./types";

/**
 * Same stance as `xmlFeed.test.ts`: the adapter takes its `fetch` from the
 * caller, so every test here runs against fixtures and no global is stubbed.
 *
 * There is no test that talks to a real store, and there deliberately never will
 * be — a shop domain and an Admin API token would make a merchant's account part
 * of the suite. What that leaves unproven is stated in PROGRESS.md rather than
 * papered over here.
 */
const SHOP = "mg-test.myshopify.com";

interface Call {
  url: string;
  headers: Headers;
  redirect?: RequestRedirect;
  method?: string;
  body?: string;
}

/** A fake Shopify that serves the given pages in order, recording every call. */
function shopServing(pages: Array<{ body: string; headers?: Record<string, string> }>) {
  const calls: Call[] = [];
  let served = 0;

  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: new Headers(init?.headers),
      redirect: init?.redirect,
      method: init?.method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const page = pages[Math.min(served, pages.length - 1)];
    served += 1;
    return new Response(page.body, {
      status: 200,
      headers: { "content-type": "application/json", ...(page.headers ?? {}) },
    });
  };

  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

function config(overrides: Partial<ShopifyConfig> = {}): ShopifyConfig {
  return shopifyConfigSchema.parse({
    shop_domain: SHOP,
    api_version: "2025-01",
    page_size: 250,
    max_pages: 20,
    status: "active",
    fulfilment: "direct",
    currency: "GBP",
    timeout_ms: 5_000,
    transport: "rest",
    collection_limit: 50,
    ...overrides,
  });
}

function pageOf(...products: unknown[]): string {
  return JSON.stringify({ products });
}

const JACKET = {
  id: 8_100_000_000_001,
  title: "Waxed Cotton Jacket",
  handle: "waxed-cotton-jacket",
  status: "active",
  tags: "outerwear, style",
  variants: [
    { id: 1, sku: "MG-001", price: "145.00", compare_at_price: "160.00", inventory_quantity: 4 },
    { id: 2, sku: "MG-001-L", price: "145.00", compare_at_price: null, inventory_quantity: 2 },
  ],
};

const WATCH_ROLL = {
  id: 8_100_000_000_002,
  title: "Travel Watch Roll",
  handle: "travel-watch-roll",
  status: "active",
  tags: "",
  variants: [{ id: 3, sku: "MG-002", price: "89.00", inventory_quantity: 0 }],
};

const TOKEN = "shpat_fixture_token";

async function records(
  pages: Array<{ body: string; headers?: Record<string, string> }>,
  overrides: Partial<ShopifyConfig> = {}
) {
  const shop = shopServing(pages);
  const result = await shopifyAdapter.fetchRecords(config(overrides), {
    fetch: shop.fetch,
    credential: TOKEN,
  });
  return { result, calls: shop.calls };
}

describe("fetchRecords", () => {
  it("returns one record per product", async () => {
    const { result } = await records([{ body: pageOf(JACKET, WATCH_ROLL) }]);
    expect(result).toHaveLength(2);
    expect((result[0] as typeof JACKET).title).toBe("Waxed Cotton Jacket");
  });

  it("asks for the configured version, page size and status", async () => {
    const { calls } = await records([{ body: pageOf(JACKET) }], {
      page_size: 50,
      status: "any",
      api_version: "2024-10",
    });
    const url = new URL(calls[0].url);
    expect(url.host).toBe(SHOP);
    expect(url.pathname).toBe("/admin/api/2024-10/products.json");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("status")).toBe("any");
  });

  it("sends the token in the Shopify header, and refuses to follow a redirect with it", async () => {
    const { calls } = await records([{ body: pageOf(JACKET) }]);
    expect(calls[0].headers.get("x-shopify-access-token")).toBe(TOKEN);
    // The token is in a custom header, which `fetch` does not strip across
    // origins — so a redirect must not be followed.
    expect(calls[0].redirect).toBe("manual");
  });

  it("uses bounded GraphQL pagination and returns REST-compatible collection records", async () => {
    const first = JSON.stringify({
      data: {
        products: {
          nodes: [
            {
              legacyResourceId: "8100000000001",
              title: "Waxed Cotton Jacket",
              handle: "waxed-cotton-jacket",
              status: "ACTIVE",
              productType: "Outerwear",
              tags: ["style"],
              variants: { nodes: [{ legacyResourceId: "1", sku: "MG-001", price: "145.00" }] },
              images: { nodes: [{ url: "https://cdn.example/jacket.jpg", altText: "Jacket" }] },
              collections: {
                nodes: [
                  {
                    id: "gid://shopify/Collection/9",
                    handle: "editors-picks",
                    title: "Editors' picks",
                  },
                ],
              },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: "cursor-one" },
        },
      },
    });
    const second = JSON.stringify({
      data: { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    });
    const { result, calls } = await records([{ body: first }, { body: second }], {
      transport: "graphql",
      page_size: 25,
      collection_limit: 12,
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(`https://${SHOP}/admin/api/2025-01/graphql.json`);
    expect(calls[0].method).toBe("POST");
    expect(JSON.parse(calls[0].body ?? "{}").variables).toEqual({
      first: 25,
      after: null,
      query: "status:active",
      collections: 12,
    });
    expect(JSON.parse(calls[1].body ?? "{}").variables.after).toBe("cursor-one");
    expect(shopifyAdapter.readPath(result[0], "collections/title")).toBe("Editors' picks");
    expect(shopifyAdapter.readPath(result[0], "variants/0/price")).toBe("145.00");
  });

  it("reports GraphQL application errors returned with HTTP 200", async () => {
    await expect(
      records([{ body: JSON.stringify({ errors: [{ message: "Access denied" }] }) }], {
        transport: "graphql",
      })
    ).rejects.toThrow(/Access denied/);
  });

  it("fails before making a request when no credential is set", async () => {
    const shop = shopServing([{ body: pageOf(JACKET) }]);
    await expect(
      shopifyAdapter.fetchRecords(config(), { fetch: shop.fetch, credential: null })
    ).rejects.toBeInstanceOf(AdapterError);
    expect(shop.calls).toHaveLength(0);
  });

  it("follows the Link header to the next page and concatenates", async () => {
    const next = `https://${SHOP}/admin/api/2025-01/products.json?limit=250&page_info=CURSOR`;
    const { result, calls } = await records([
      { body: pageOf(JACKET), headers: { link: `<${next}>; rel="next"` } },
      { body: pageOf(WATCH_ROLL) },
    ]);

    expect(result).toHaveLength(2);
    expect(calls).toHaveLength(2);
    // Verbatim: Shopify refuses page_info combined with any other filter, so a
    // rebuilt URL would either drop the cursor or be rejected.
    expect(calls[1].url).toBe(next);
  });

  it("stops at max_pages even while the feed keeps offering a next page", async () => {
    const next = `https://${SHOP}/admin/api/2025-01/products.json?limit=250&page_info=CURSOR`;
    const { result, calls } = await records(
      [{ body: pageOf(JACKET), headers: { link: `<${next}>; rel="next"` } }],
      { max_pages: 3 }
    );

    expect(calls).toHaveLength(3);
    expect(result).toHaveLength(3);
  });

  it("ignores a Link header that only offers a previous page", async () => {
    const previous = `https://${SHOP}/admin/api/2025-01/products.json?limit=250&page_info=BACK`;
    const { calls } = await records([
      { body: pageOf(JACKET), headers: { link: `<${previous}>; rel="previous"` } },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("refuses a next-page link pointing at another host", async () => {
    const elsewhere = "https://attacker.example.com/admin/api/2025-01/products.json?page_info=X";
    await expect(
      records([{ body: pageOf(JACKET), headers: { link: `<${elsewhere}>; rel="next"` } }])
    ).rejects.toThrow(/not mg-test\.myshopify\.com/);
  });

  it("names the status when Shopify rejects the token", async () => {
    const shop = {
      fetch: (async () =>
        new Response("{}", {
          status: 401,
          statusText: "Unauthorized",
        })) as unknown as typeof globalThis.fetch,
    };
    await expect(
      shopifyAdapter.fetchRecords(config(), { fetch: shop.fetch, credential: TOKEN })
    ).rejects.toThrow(/401/);
  });

  /**
   * The 429 retry, and the three things about it that can go wrong quietly.
   *
   * ⚠️ **`wait` is injected on every one of these.** Without it the adapter
   * spends its real backoff — four seconds for a run that exhausts the attempts
   * — and a suite that takes four seconds to prove a two-second wait is a suite
   * people stop running. The recorded delays are also the assertion: a retry you
   * cannot see the timing of is a retry you cannot prove honours the header.
   */
  function limitedShop(responses: Array<{ status: number; retryAfter?: string; body?: string }>) {
    const waits: number[] = [];
    let served = 0;

    const fetch = (async () => {
      const next = responses[Math.min(served, responses.length - 1)];
      served += 1;
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (next.retryAfter !== undefined) headers["retry-after"] = next.retryAfter;
      return new Response(next.body ?? "{}", {
        status: next.status,
        statusText: next.status === 429 ? "Too Many Requests" : "OK",
        headers,
      });
    }) as unknown as typeof globalThis.fetch;

    return {
      waits,
      calls: () => served,
      context: { fetch, credential: TOKEN, wait: async (ms: number) => void waits.push(ms) },
    };
  }

  it("waits out a 429 and carries on when the next attempt succeeds", async () => {
    const shop = limitedShop([
      { status: 429, retryAfter: "2.0" },
      { status: 200, body: pageOf(JACKET) },
    ]);

    const records = await shopifyAdapter.fetchRecords(config(), shop.context);

    expect(records).toHaveLength(1);
    expect(shop.calls()).toBe(2);
    // Honoured, not guessed: Shopify's leaky bucket answers `2.0` seconds.
    expect(shop.waits).toEqual([2_000]);
  });

  it("falls back to its own delay when the header is missing or unusable", async () => {
    // ⚠️ `Number("")` is 0 and `Number("soon")` is NaN. A wait of NaN
    // milliseconds resolves immediately, which turns the backoff into a hot loop
    // against a provider that is already refusing — the failure this asserts is
    // absent.
    for (const retryAfter of [undefined, "", "soon", "-5"]) {
      const shop = limitedShop([
        { status: 429, retryAfter },
        { status: 200, body: pageOf(JACKET) },
      ]);
      await shopifyAdapter.fetchRecords(config(), shop.context);
      expect(shop.waits, String(retryAfter)).toEqual([2_000]);
    }
  });

  it("caps a single wait, however long the provider asks for", async () => {
    // A provider asking for an hour must not get one: the run is holding a
    // request open, and the ceiling is this file's to set, not theirs.
    const shop = limitedShop([
      { status: 429, retryAfter: "3600" },
      { status: 200, body: pageOf(JACKET) },
    ]);
    await shopifyAdapter.fetchRecords(config(), shop.context);
    expect(shop.waits).toEqual([5_000]);
  });

  it("gives up after its attempts and says the retries were spent", async () => {
    const shop = limitedShop([{ status: 429, retryAfter: "2.0" }]);

    await expect(shopifyAdapter.fetchRecords(config(), shop.context)).rejects.toThrow(
      /rate-limited.*three attempts/s
    );
    // Three attempts, so two waits — not three. An off-by-one here is a wait
    // nobody is waiting for.
    expect(shop.calls()).toBe(3);
    expect(shop.waits).toEqual([2_000, 2_000]);
  });

  it("does not retry a status that will not fix itself", async () => {
    // A 401 is a wrong token and a 404 is a wrong domain. Waiting changes
    // neither, and retrying them turns a clear failure into a slow one.
    for (const status of [401, 403, 404]) {
      const shop = limitedShop([{ status }]);
      await expect(shopifyAdapter.fetchRecords(config(), shop.context)).rejects.toBeInstanceOf(
        AdapterError
      );
      expect(shop.calls(), String(status)).toBe(1);
      expect(shop.waits, String(status)).toEqual([]);
    }
  });

  it("refuses a body with no products array, naming what arrived", async () => {
    await expect(records([{ body: JSON.stringify({ errors: "Not Found" }) }])).rejects.toThrow(
      /products array.*errors/s
    );
  });

  it("refuses a body that is not JSON at all", async () => {
    await expect(records([{ body: "<html>nope</html>" }])).rejects.toBeInstanceOf(AdapterError);
  });

  it("refuses a page that declares more bytes than the cap", async () => {
    const shop = {
      fetch: (async () =>
        new Response(pageOf(JACKET), {
          status: 200,
          headers: { "content-type": "application/json", "content-length": "99999999" },
        })) as unknown as typeof globalThis.fetch,
    };
    await expect(
      shopifyAdapter.fetchRecords(config(), { fetch: shop.fetch, credential: TOKEN })
    ).rejects.toThrow(/limit/);
  });
});

describe("readPath", () => {
  const read = (path: string) => shopifyAdapter.readPath(JACKET, path);

  it("reads a top-level property", () => {
    expect(read("title")).toBe("Waxed Cotton Jacket");
  });

  it("indexes an array with a numeric segment", () => {
    expect(read("variants/0/sku")).toBe("MG-001");
    expect(read("variants/1/sku")).toBe("MG-001-L");
  });

  it("returns every match as an array when a path crosses an array", () => {
    expect(read("variants/sku")).toEqual(["MG-001", "MG-001-L"]);
  });

  it("collapses a single match to a scalar", () => {
    expect(shopifyAdapter.readPath(WATCH_ROLL, "variants/sku")).toBe("MG-002");
  });

  it("answers null for a path that matches nothing", () => {
    expect(read("vendor")).toBeNull();
    expect(read("variants/0/barcode")).toBeNull();
    expect(read("variants/9/sku")).toBeNull();
  });

  it("answers null for a present but empty value", () => {
    expect(shopifyAdapter.readPath(WATCH_ROLL, "tags")).toBeNull();
  });

  it("drops nulls inside an array rather than counting them as matches", () => {
    // Only one variant carries a compare_at_price; the other is null.
    expect(read("variants/compare_at_price")).toBe("160.00");
  });

  it("returns a non-scalar as it is, so coerceValue can refuse it in its own words", () => {
    const variants = read("variants");
    expect(Array.isArray(variants)).toBe(true);
    expect(coerceValue("name", variants).ok).toBe(false);
  });
});

/**
 * The coupling, asserted directly rather than as two separate properties.
 *
 * Shopify returns money as a JSON string and `JSON.parse` preserves it. If that
 * ever changed — or if this adapter grew a numeric coercion — `coerceValue`'s
 * pounds-vs-pence guard would stop seeing the decimal point, and a £145 jacket
 * would import at £1.45 with nothing reporting an error.
 */
describe("values stay strings", () => {
  it("keeps a price as the string the API sent, and the pence guard still fires", async () => {
    const { result } = await records([{ body: pageOf(JACKET) }]);
    const price = shopifyAdapter.readPath(result[0], "variants/0/price");

    expect(price).toBe("145.00");
    expect(coerceValue("price_pence", price).ok).toBe(false);
  });

  it("leaves an integer quantity alone for the integer target", () => {
    expect(
      coerceValue("stock", shopifyAdapter.readPath(JACKET, "variants/0/inventory_quantity"))
    ).toEqual({ ok: true, value: 4 });
  });
});

describe("shopifyConfigSchema", () => {
  it("applies its defaults", () => {
    const parsed = shopifyConfigSchema.parse({ shop_domain: SHOP });
    expect(parsed).toMatchObject({
      api_version: DEFAULT_SHOPIFY_API_VERSION,
      page_size: 250,
      max_pages: 20,
      status: "active",
      fulfilment: "direct",
      currency: "GBP",
      timeout_ms: 30_000,
      transport: "rest",
      collection_limit: 50,
    });
  });

  it("lowercases the shop domain", () => {
    expect(shopifyConfigSchema.parse({ shop_domain: "MG-Test.MyShopify.com" }).shop_domain).toBe(
      SHOP
    );
  });

  it("refuses a URL, a custom domain and an empty domain", () => {
    for (const shop_domain of [
      `https://${SHOP}`,
      `https://${SHOP}/admin`,
      "shop.example.com",
      "",
    ]) {
      expect(shopifyConfigSchema.safeParse({ shop_domain }).success).toBe(false);
    }
  });

  it("refuses a malformed API version", () => {
    expect(shopifyConfigSchema.safeParse({ shop_domain: SHOP, api_version: "2025" }).success).toBe(
      false
    );
  });

  it("refuses a page size over Shopify's own maximum", () => {
    expect(shopifyConfigSchema.safeParse({ shop_domain: SHOP, page_size: 251 }).success).toBe(
      false
    );
  });

  it("refuses an unknown key rather than ignoring it", () => {
    expect(
      shopifyConfigSchema.safeParse({ shop_domain: SHOP, access_token: "shpat_oops" }).success
    ).toBe(false);
  });
});
