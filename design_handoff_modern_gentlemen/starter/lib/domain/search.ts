/**
 * Shared, punctuation-safe matching for the two lightweight search indexes.
 *
 * Search terms are data, never PostgREST filter grammar. Splitting into letter
 * and number runs also means `slow-car` and `slow car` behave identically, and
 * requiring every word lets a query such as `slow philosophy` match a title
 * whose words are separated by punctuation or other copy.
 */
export function searchWords(term: string): string[] {
  return term.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function matchesSearchQuery(
  values: readonly (string | null | undefined)[],
  term: string
): boolean {
  const words = searchWords(term);
  if (words.length === 0) return false;

  const haystack = values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLocaleLowerCase();

  return words.every((word) => haystack.includes(word));
}

/** The serializable public article shape hydrated into the site search modal. */
export interface EditorialSearchEntry {
  tag: string;
  title: string;
  meta: string;
  href: string;
  img: string;
}
