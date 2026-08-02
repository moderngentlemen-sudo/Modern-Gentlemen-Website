import type { PostgrestError } from "@supabase/supabase-js";

/**
 * One error type for everything the data layer can fail with, carrying the
 * Postgres SQLSTATE so callers can react to *why* rather than string-matching a
 * message.
 *
 * The codes that matter here are the ones `0010_publishing.sql` raises
 * deliberately: `42501` when a permission check fails, `P0002` when the row
 * does not exist (or RLS hides it, which is the same answer from outside), and
 * `22023` for an argument the function will not accept.
 */
export class RepositoryError extends Error {
  readonly code: string | null;
  readonly details: string | null;

  constructor(operation: string, cause: PostgrestError) {
    super(`${operation}: ${cause.message}`);
    this.name = "RepositoryError";
    this.code = cause.code ?? null;
    this.details = cause.details ?? null;
  }

  /** A permission check refused this — RLS, a GRANT, or an explicit RAISE. */
  get isPermissionDenied(): boolean {
    return this.code === "42501";
  }

  get isNotFound(): boolean {
    return this.code === "P0002";
  }

  get isInvalidArgument(): boolean {
    return this.code === "22023";
  }
}

/** Throws on error, returns the data otherwise. Keeps repositories free of `if (error)`. */
export function unwrap<T>(operation: string, result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw new RepositoryError(operation, result.error);
  return result.data;
}
