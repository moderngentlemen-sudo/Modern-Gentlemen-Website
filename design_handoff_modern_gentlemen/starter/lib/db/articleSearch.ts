/**
 * Postgres/PostgREST both report a missing generated search column, but with
 * different codes. Require the column name in the message as well as the known
 * code so a compatibility fallback can never hide an unrelated schema error.
 */
export function articleSearchVectorIsMissing(error: {
  code?: string | null;
  message: string;
}): boolean {
  const missingColumnCode = error.code === "42703" || error.code === "PGRST204";
  return (
    missingColumnCode &&
    /search_vector.*(?:does not exist|schema cache)|(?:does not exist|schema cache).*search_vector/i.test(
      error.message
    )
  );
}
