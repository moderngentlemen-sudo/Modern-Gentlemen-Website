/**
 * Walking a `feed_field_mappings.source_path`, for adapters that agree it is
 * slash-separated.
 *
 * Both adapters do, and that is a decision rather than an accident. Shopify's
 * payload is JSON, where dot notation would be the native convention — but the
 * mapping editor's help text, every path an author has already stored, and the
 * XML adapter all speak slashes. One separator means one editor and one thing to
 * learn; a per-provider separator would mean a path that silently means nothing
 * when a source's kind changes.
 *
 * What is *not* shared is what happens at the leaf. XML's `#text` unwrapping is
 * a property of its parser and stays in `xmlFeed.ts`; a JSON leaf is already its
 * own value.
 */

/**
 * Walk a slash-separated path, flattening across any array met on the way.
 *
 * The flattening is what makes `item/category` work on a record holding three
 * `<category>` elements, and `variants/sku` work on a Shopify product with three
 * variants: the walk returns all three, and `coerceValue` refuses them for every
 * target except a list. That refusal is the point — a mapping that matches three
 * nodes has not found one value, and picking the first would import a third of
 * the truth silently.
 *
 * A numeric segment indexes an array, so `variants/0/price` reads as "the first
 * variant's price".
 *
 * ⚠️ That index branch is new here, and it is the one behavioural difference
 * between this function and the private `walk` it was extracted from. It cannot
 * affect an XML mapping: an XML element name may not begin with a digit, so a
 * numeric segment in an XML path matched nothing before and was already dead.
 * It turns a dead path into a working one; it changes no path that worked.
 */
export function walk(node: unknown, segments: readonly string[]): unknown {
  let current: unknown = node;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;

    if (Array.isArray(current)) {
      // An explicit index selects one entry; anything else maps across them all.
      if (/^\d+$/.test(segment)) {
        current = current[Number(segment)];
        continue;
      }

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

/** Absent, null, or whitespace — the three things a mapping's `fallback` is for. */
export function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

/** `a/b//c` and `/a/b` mean what they look like they mean. */
export function segmentsOf(path: string): string[] {
  return path.split("/").filter(Boolean);
}
