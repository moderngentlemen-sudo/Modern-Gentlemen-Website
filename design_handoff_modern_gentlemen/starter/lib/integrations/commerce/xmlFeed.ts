/**
 * The XML feed adapter — `product_sources.kind = 'xml_feed'`.
 *
 * Fetches a feed, parses it, and hands the pipeline one record per product. It
 * knows nothing about products: what a record *means* is decided by the mappings
 * and by `lib/domain/ingestion.ts`. This file's only job is to turn a URL into a
 * list of nodes and a path string into a value.
 *
 * `fast-xml-parser` has been a dependency since the scaffold, unused until now —
 * the 0006 header's example paths (`item/title`, `@_sku`) are written in its
 * attribute convention, so the choice was made two phases ago and this honours
 * it.
 *
 * ⚠️ **The parser is configured to leave every value as a string** — see
 * `PARSER_OPTIONS`. That is not a stylistic preference. With value parsing on,
 * fast-xml-parser reads `<price>145.00</price>` as the number 145, which is
 * indistinguishable from a feed quoting 145 pence, and the pounds-vs-pence guard
 * in `coerceValue` would never see the decimal point it is looking for. A £145
 * jacket would import at £1.45 and nothing would report an error.
 */

import { XMLParser } from "fast-xml-parser";

import { xmlFeedConfigSchema, type XmlFeedConfig } from "@/lib/domain/ingestion";
import { fetchCapped } from "./http";
import { isPresent, segmentsOf, walk } from "./paths";
import { AdapterError, type AdapterContext, type SourceAdapter } from "./types";

const PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  // Both off deliberately — see the file header. Everything stays a string and
  // the domain layer decides what it is.
  parseTagValue: false,
  parseAttributeValue: false,
  // A feed's own namespace prefixes (`g:price` in a Google Merchant feed) are
  // part of the path an author writes, so they are kept rather than stripped.
  removeNSPrefix: false,
} as const;

const parser = new XMLParser(PARSER_OPTIONS);

export const xmlFeedAdapter: SourceAdapter<XmlFeedConfig> = {
  kind: "xml_feed",

  parseConfig(config: unknown): XmlFeedConfig {
    return xmlFeedConfigSchema.parse(config ?? {});
  },

  async fetchRecords(config: XmlFeedConfig, context: AdapterContext): Promise<unknown[]> {
    const body = await fetchFeed(config, context);

    let parsed: unknown;
    try {
      parsed = parser.parse(body);
    } catch (error) {
      throw new AdapterError(
        `The feed did not parse as XML: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const node = walk(parsed, segmentsOf(config.item_path));

    if (node === null || node === undefined) {
      throw new AdapterError(
        `No element at "${config.item_path}". The feed parsed, so the path is wrong rather than the feed: ` +
          `its root elements are ${describeKeys(parsed)}.`
      );
    }

    // A feed with exactly one product parses as an object, not an array of one.
    // Left unwrapped, that run would import the product's own fields as if each
    // were a product — a failure that only ever shows up on a nearly empty feed,
    // which is exactly the feed someone tests with.
    const records = Array.isArray(node) ? node : [node];

    return records.flat();
  },

  /**
   * An element that is present but empty answers `null`, exactly as one that is
   * absent does.
   *
   * The two are worth collapsing rather than distinguishing. Downstream, `null`
   * is what makes a mapping's `fallback` fire, and a feed sending
   * `<price></price>` wants the fallback for the same reason a feed omitting
   * `<price>` does. Keeping them apart also made the adapter disagree with
   * itself: the multi-match branch already dropped empties, so
   * `<category></category>` vanished while `<title></title>` came back as "".
   */
  readPath(record: unknown, path: string): unknown {
    const value = walk(record, segmentsOf(path));
    if (value === undefined) return null;

    if (Array.isArray(value)) {
      const flattened = value.flat().map(textOf).filter(isPresent);
      if (flattened.length === 0) return null;
      return flattened.length === 1 ? flattened[0] : flattened;
    }

    const text = textOf(value);
    return isPresent(text) ? text : null;
  },
};

/**
 * An element carrying attributes parses as an object, with its text under
 * `#text`. A mapping author writing `item/title` means the title's text, not
 * that object, so the unwrapping happens here rather than in every mapping.
 */
function textOf(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const text = (value as Record<string, unknown>)[PARSER_OPTIONS.textNodeName];
    return text === undefined ? null : text;
  }
  return value;
}

function describeKeys(parsed: unknown): string {
  if (parsed === null || typeof parsed !== "object") return "none";
  const keys = Object.keys(parsed as Record<string, unknown>).filter((key) => key !== "?xml");
  return keys.length > 0 ? keys.join(", ") : "none";
}

/**
 * Fetch the feed with a timeout and a size cap — both from `./http`, which is
 * where they moved when the Shopify adapter needed the same two guards.
 *
 * `credentials_ref` is sent as a bearer token when the source has one. Feeds
 * that authenticate by embedding a key in the URL need nothing here, which
 * covers most affiliate networks; Basic and query-parameter schemes are a
 * follow-up rather than a guess.
 */
async function fetchFeed(config: XmlFeedConfig, context: AdapterContext): Promise<string> {
  const headers: Record<string, string> = {
    accept: "application/xml, text/xml, application/rss+xml;q=0.9, */*;q=0.8",
    "user-agent": "ModernGentlemen-Ingestion/1.0",
  };
  if (context.credential) headers.authorization = `Bearer ${context.credential}`;

  const response = await fetchCapped(context.fetch, config.url, {
    subject: "The feed",
    headers,
    timeoutMs: config.timeout_ms,
  });

  return response.text;
}
