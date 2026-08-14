/**
 * The named transforms a `feed_field_mappings` row can apply, which the 0006
 * header promised would live here.
 *
 * They run between extraction and coercion: the adapter pulls a node out of the
 * payload, the transform makes it look like the thing we want, and
 * `coerceValue` in `lib/domain/ingestion.ts` decides whether it succeeded. Each
 * one is total — it takes whatever the feed gave and returns something, never
 * throwing — because a transform that throws would fail an item with a stack
 * trace where the pipeline wants a sentence.
 *
 * The *names* are declared in `lib/domain/ingestion.ts` (`FEED_TRANSFORMS`),
 * because the Zod schema that validates a saved mapping needs them and
 * `lib/domain` may not import an adapter. `ingestion.test.ts` asserts this
 * registry and that list have exactly the same members, so adding a transform to
 * one and not the other is a failing test rather than a mapping that saves
 * cleanly and then blows up mid-run.
 */

import { type FeedTransform } from "@/lib/domain/ingestion";
import { slugify } from "@/lib/domain/slug";

type TransformFn = (value: unknown) => unknown;

/** Applies to each entry when a path matched several nodes, to the value otherwise. */
function overEach(fn: (value: string) => unknown): TransformFn {
  return (value) => {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((entry) => fn(String(entry)));
    return fn(String(value));
  };
}

/**
 * "£1,450.00" → 145000.
 *
 * The single most valuable transform here, and the reason `coerceValue` refuses
 * a bare decimal in a pence field: feeds quote pounds, the catalogue stores
 * pence, and the conversion has to happen somewhere it can be seen. Rounding is
 * `Math.round` on the pence figure rather than on the pounds one — a half-penny
 * is a rounding decision, a whole pound is a bug (PROGRESS.md records the cart
 * making exactly that mistake in the other direction).
 *
 * Currency symbols, thousands separators and surrounding whitespace are
 * stripped. A comma *decimal* separator is honoured too, since a European feed
 * quoting "1450,00" means the same thing as "1450.00" — but only when it is the
 * last separator with two digits after it, so "1,450" stays 1450 rather than
 * becoming 1.45.
 */
function poundsToPence(value: string): unknown {
  const cleaned = value.replace(/[^\d.,-]/g, "").trim();
  if (cleaned === "") return value;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let decimalSeparator: "," | "." | null = null;

  if (lastComma > lastDot && /,\d{1,2}$/.test(cleaned)) decimalSeparator = ",";
  else if (lastDot > lastComma && /\.\d{1,2}$/.test(cleaned)) decimalSeparator = ".";

  const digitsOnly =
    decimalSeparator === ","
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");

  const pounds = Number(digitsOnly);
  // Unparseable input is returned untouched rather than swallowed as 0. A price
  // of zero is a plausible-looking product; the original string is not, and it
  // fails coercion with the feed's own value in the message.
  if (!Number.isFinite(pounds)) return value;

  return Math.round(pounds * 100);
}

/**
 * Feeds say availability in prose. This maps the common vocabulary onto a
 * boolean-ish token `coerceValue` can read as an availability.
 *
 * Anything unrecognised is passed through unchanged, so it fails coercion with
 * the feed's own wording rather than being guessed into 'in_stock' — guessing
 * here puts something on sale that nobody can ship.
 */
const IN_STOCK_WORDS = new Set([
  "true",
  "yes",
  "y",
  "1",
  "in stock",
  "instock",
  "in_stock",
  "available",
]);
const OUT_OF_STOCK_WORDS = new Set([
  "false",
  "no",
  "n",
  "0",
  "out of stock",
  "outofstock",
  "out_of_stock",
  "unavailable",
  "sold out",
  "soldout",
]);

function booleanInStock(value: string): unknown {
  const word = value.trim().toLowerCase();
  if (IN_STOCK_WORDS.has(word)) return "in_stock";
  if (OUT_OF_STOCK_WORDS.has(word)) return "out_of_stock";
  return value;
}

/**
 * Strips tags from a description field.
 *
 * Not a sanitiser and not trying to be — nothing here is rendered as HTML; the
 * blurb and story columns are printed as text. This exists because feeds wrap
 * descriptions in `<p>` and `<br/>`, and a PDP showing the literal characters
 * `&lt;p&gt;` looks broken. The five XML entities are decoded for the same
 * reason: they are what the parser leaves behind inside a CDATA block.
 */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export const TRANSFORMS: Readonly<Record<FeedTransform, TransformFn>> = {
  trim: overEach((value) => value.trim()),
  upper: overEach((value) => value.toUpperCase()),
  lower: overEach((value) => value.toLowerCase()),
  slugify: overEach((value) => slugify(value)),
  strip_html: overEach(stripHtml),
  pounds_to_pence: overEach(poundsToPence),
  integer: overEach((value) => {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? Math.trunc(parsed) : value;
  }),
  boolean_in_stock: overEach(booleanInStock),

  /**
   * "NEW, LIMITED" → ["NEW", "LIMITED"]. The one transform that changes arity,
   * which is why it does not go through `overEach`: applied to an already-multi
   * match it flattens rather than nesting.
   */
  split_commas: (value) => {
    if (value === null || value === undefined) return value;
    const parts = Array.isArray(value) ? value : [value];
    return parts
      .flatMap((entry) => String(entry).split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  },
};

/**
 * Apply a mapping's transform, if it has one.
 *
 * An unknown name is a no-op rather than an error: the name was validated by
 * `feedFieldMappingSchema` on the way into the database, so reaching here with
 * one means the row predates a transform being removed — and dropping a
 * catalogue on the floor is a worse answer to that than importing the untouched
 * value and letting coercion judge it.
 */
export function applyTransform(name: string | null | undefined, value: unknown): unknown {
  if (!name) return value;
  const transform = (TRANSFORMS as Record<string, TransformFn | undefined>)[name];
  return transform ? transform(value) : value;
}
