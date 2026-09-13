import { searchWords } from "@/lib/domain/search";

/**
 * Postgres/PostgREST both report a missing generated search column, but with
 * different codes. Require the column name in the message as well as the known
 * code so a compatibility fallback can never hide an unrelated schema error.
 */
export function articleSearchVectorIsMissing(
  error: { code?: string | null; message: string },
  column: "search_vector" | "search_prefix_vector" = "search_vector"
): boolean {
  const missingColumnCode = error.code === "42703" || error.code === "PGRST204";
  return (
    missingColumnCode &&
    new RegExp(`\\b${column}\\b`, "i").test(error.message) &&
    /does not exist|schema cache/i.test(error.message)
  );
}
/** Literal word prefixes only: user punctuation can never become query operators. */
export function articlePrefixQuery(term: string): string {
  return [...new Set(searchWords(term))].map((word) => `'${word}':*`).join(" & ");
}
