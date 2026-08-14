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
import { AdapterError, type AdapterContext, type SourceAdapter } from "./types";

/**
 * A feed that never finishes is a request that never finishes, and this runs
 * inside a server action. The cap is generous for a catalogue feed and small
 * enough that a misconfigured URL pointing at something enormous fails quickly
 * rather than filling the container's memory.
 */
const MAX_FEED_BYTES = 20 * 1024 * 1024;

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

    const node = walk(parsed, config.item_path.split("/").filter(Boolean));

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
    const value = walk(record, path.split("/").filter(Boolean));
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
 * Walk a slash-separated path, flattening across any array met on the way.
 *
 * The flattening is what makes `item/category` work on a record holding three
 * `<category>` elements: the walk returns all three, and `coerceValue` refuses
 * them for every target except a list. That refusal is the point — a mapping
 * that matches three nodes has not found one value, and picking the first would
 * import a third of the truth silently.
 */
function walk(node: unknown, segments: readonly string[]): unknown {
  let current: unknown = node;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      const collected = current
        .map((entry) => walk(entry, [segment]))
        .filter((entry) => entry !== undefined && entry !== null);
      if (collected.length === 0) return undefined;
      current = collected.flat();
      continue;
    }

    if (typeof current !== "object") return undefined;

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

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

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function describeKeys(parsed: unknown): string {
  if (parsed === null || typeof parsed !== "object") return "none";
  const keys = Object.keys(parsed as Record<string, unknown>).filter((key) => key !== "?xml");
  return keys.length > 0 ? keys.join(", ") : "none";
}

/**
 * Fetch the feed with a timeout and a size cap.
 *
 * Both guards exist because the URL is operator-supplied: an editor with
 * `integration.write` types it into a form, and the server then makes that
 * request. The timeout keeps a stalled feed from holding a server action open;
 * the cap is enforced while streaming rather than after, so an unbounded
 * response is abandoned instead of buffered.
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

  let response: Response;
  try {
    response = await context.fetch(config.url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(config.timeout_ms),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AdapterError(`The feed did not respond within ${config.timeout_ms}ms.`);
    }
    throw new AdapterError(
      `The feed could not be reached: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!response.ok) {
    throw new AdapterError(`The feed answered ${response.status} ${response.statusText}.`);
  }

  return readCapped(response);
}

async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_FEED_BYTES) {
    throw new AdapterError(
      `The feed declares ${declared} bytes, over the ${MAX_FEED_BYTES}-byte limit.`
    );
  }

  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FEED_BYTES) {
        // Cancelling matters: without it the connection stays open pulling
        // bytes we have already decided not to keep.
        await reader.cancel();
        throw new AdapterError(`The feed exceeded the ${MAX_FEED_BYTES}-byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged);
}
