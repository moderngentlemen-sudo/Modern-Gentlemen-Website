import { describe, expect, it } from "vitest";

import { coerceValue, type XmlFeedConfig } from "@/lib/domain/ingestion";
import { AdapterError } from "./types";
import { xmlFeedAdapter } from "./xmlFeed";

/**
 * The adapter takes its `fetch` from the caller, so every test here runs against
 * a string rather than a network — the same injected-dependency stance
 * `lib/blocks/binding.ts` takes towards its sources.
 */
function feedServing(
  body: string,
  init: { status?: number; headers?: Record<string, string> } = {}
) {
  return async () =>
    new Response(body, {
      status: init.status ?? 200,
      headers: init.headers ?? { "content-type": "application/xml" },
    });
}

function config(overrides: Partial<XmlFeedConfig> = {}): XmlFeedConfig {
  return {
    url: "https://example.com/feed.xml",
    item_path: "products/product",
    fulfilment: "direct",
    currency: "GBP",
    timeout_ms: 5_000,
    ...overrides,
  };
}

const TWO_PRODUCTS = `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product sku="MG-001">
    <title>Waxed Cotton Jacket</title>
    <price currency="GBP">145.00</price>
    <stock>4</stock>
    <category>Style</category>
    <category>Outerwear</category>
    <description><![CDATA[<p>A jacket.</p>]]></description>
  </product>
  <product sku="MG-002">
    <title>Travel Watch Roll</title>
    <price currency="GBP">89.00</price>
    <stock>0</stock>
  </product>
</products>`;

async function records(body: string, overrides: Partial<XmlFeedConfig> = {}) {
  return xmlFeedAdapter.fetchRecords(config(overrides), {
    fetch: feedServing(body) as unknown as typeof globalThis.fetch,
    credential: null,
  });
}

describe("fetchRecords", () => {
  it("returns one record per product", async () => {
    expect(await records(TWO_PRODUCTS)).toHaveLength(2);
  });

  /**
   * A feed with exactly one product parses as an object, not an array of one.
   * Left unwrapped, the run would treat each of that product's fields as a
   * product — and it only ever happens on a nearly empty feed, which is exactly
   * the feed someone tests with.
   */
  it("wraps a single-product feed rather than iterating its fields", async () => {
    const one = `<products><product sku="A"><title>Only</title></product></products>`;
    const result = await records(one);
    expect(result).toHaveLength(1);
    expect(xmlFeedAdapter.readPath(result[0], "title")).toBe("Only");
  });

  it("reads an RSS feed at its own path", async () => {
    const rss = `<rss><channel><item><title>One</title></item><item><title>Two</title></item></channel></rss>`;
    expect(await records(rss, { item_path: "rss/channel/item" })).toHaveLength(2);
  });

  it("names the root elements when the item path matches nothing", async () => {
    await expect(records(TWO_PRODUCTS, { item_path: "catalogue/entry" })).rejects.toThrow(
      /No element at "catalogue\/entry"/
    );
  });

  it("reports a non-200 as an adapter error rather than parsing the body", async () => {
    const notFound = xmlFeedAdapter.fetchRecords(config(), {
      fetch: feedServing("nope", { status: 404 }) as unknown as typeof globalThis.fetch,
      credential: null,
    });
    await expect(notFound).rejects.toBeInstanceOf(AdapterError);
  });

  it("refuses a feed that declares more than the size limit", async () => {
    const huge = xmlFeedAdapter.fetchRecords(config(), {
      fetch: feedServing(TWO_PRODUCTS, {
        headers: { "content-length": String(50 * 1024 * 1024) },
      }) as unknown as typeof globalThis.fetch,
      credential: null,
    });
    await expect(huge).rejects.toThrow(/limit/);
  });

  it("sends the credential as a bearer token when the source has one", async () => {
    let seen: Headers | undefined;
    await xmlFeedAdapter.fetchRecords(config(), {
      fetch: (async (_url: string, init?: RequestInit) => {
        seen = new Headers(init?.headers);
        return new Response(TWO_PRODUCTS);
      }) as unknown as typeof globalThis.fetch,
      credential: "s3cret",
    });
    expect(seen?.get("authorization")).toBe("Bearer s3cret");
  });

  it("sends no authorization header when there is no credential", async () => {
    let seen: Headers | undefined;
    await xmlFeedAdapter.fetchRecords(config(), {
      fetch: (async (_url: string, init?: RequestInit) => {
        seen = new Headers(init?.headers);
        return new Response(TWO_PRODUCTS);
      }) as unknown as typeof globalThis.fetch,
      credential: null,
    });
    expect(seen?.get("authorization")).toBeNull();
  });
});

describe("readPath", () => {
  it("reads an element's text", async () => {
    const [first] = await records(TWO_PRODUCTS);
    expect(xmlFeedAdapter.readPath(first, "title")).toBe("Waxed Cotton Jacket");
  });

  it("reads an attribute", async () => {
    const [first] = await records(TWO_PRODUCTS);
    expect(xmlFeedAdapter.readPath(first, "@_sku")).toBe("MG-001");
  });

  /**
   * `<price currency="GBP">145.00</price>` parses as an object because it has an
   * attribute. A mapping author writing `price` means the text, so the unwrap
   * happens in the adapter rather than in every mapping.
   */
  it("reads the text of an element that also carries attributes", async () => {
    const [first] = await records(TWO_PRODUCTS);
    expect(xmlFeedAdapter.readPath(first, "price")).toBe("145.00");
    expect(xmlFeedAdapter.readPath(first, "price/@_currency")).toBe("GBP");
  });

  it("returns every match when a path matches more than one element", async () => {
    const [first] = await records(TWO_PRODUCTS);
    expect(xmlFeedAdapter.readPath(first, "category")).toEqual(["Style", "Outerwear"]);
  });

  it("returns null for a path that matches nothing", async () => {
    const [, second] = await records(TWO_PRODUCTS);
    expect(xmlFeedAdapter.readPath(second, "description")).toBeNull();
  });

  it("returns null rather than an empty string for an empty element", async () => {
    const [record] = await records(`<products><product><title></title></product></products>`);
    expect(xmlFeedAdapter.readPath(record, "title")).toBeNull();
  });
});

describe("values stay strings", () => {
  /**
   * The single most important line of configuration in the adapter. With value
   * parsing on, fast-xml-parser reads `<price>145.00</price>` as the number 145
   * — indistinguishable from a feed quoting 145 pence — and the pounds guard in
   * `coerceValue` never sees the decimal point it is looking for. A £145 jacket
   * would import at £1.45 with nothing reporting an error.
   */
  it("keeps a decimal price as text, so the pounds guard can still see it", async () => {
    const [first] = await records(TWO_PRODUCTS);
    const price = xmlFeedAdapter.readPath(first, "price");

    expect(price).toBe("145.00");
    expect(coerceValue("price_pence", price).ok).toBe(false);
  });

  it("keeps a leading-zero identifier intact", async () => {
    const [record] = await records(`<products><product><sku>00123</sku></product></products>`);
    expect(xmlFeedAdapter.readPath(record, "sku")).toBe("00123");
  });
});
