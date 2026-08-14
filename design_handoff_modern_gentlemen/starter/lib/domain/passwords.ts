/**
 * What makes a password acceptable here.
 *
 * Pure, and deliberately so: the sign-in surface, the admin form and the server
 * actions all need the same answer, and a client component imports this for its
 * inline validation. No Node built-ins — see the `lib/domain` rule in
 * `CLAUDE.md`; `TextEncoder` is a web global rather than a `node:` import, which
 * is why the byte check below is safe here.
 */

import { z } from "zod";

/**
 * Supabase's own floor is 6. Twelve is chosen instead because every account this
 * gate protects is staff with write access to a live storefront, and because a
 * six-character minimum on an admin console is the kind of default nobody
 * revisits.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * ⚠️ Not an arbitrary limit. GoTrue hashes with **bcrypt, which silently
 * truncates at 72 bytes** — a 100-character passphrase is stored as its first 72
 * bytes, and everything after that is decorative. Worse, it is silent in both
 * directions: the account still works, so nobody discovers that the tail was
 * never protecting anything.
 *
 * Bytes, not characters. An emoji is four bytes and an accented letter is two,
 * so a 40-character passphrase can cross this while `length` says otherwise.
 */
export const MAX_PASSWORD_BYTES = 72;

export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .refine(
    (value) => passwordByteLength(value) <= MAX_PASSWORD_BYTES,
    `That is longer than ${MAX_PASSWORD_BYTES} bytes, and everything past that would be silently ignored.`
  )
  .refine((value) => value.trim().length > 0, "A password cannot be only whitespace.");

/**
 * The whole form's verdict in one sentence, or `null` when it is fine.
 *
 * Returns a single message rather than field-level errors because the two
 * fields fail as a pair: "these do not match" belongs to neither one of them.
 */
export function passwordProblem(password: string, confirmation: string): string | null {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "That password cannot be used.";

  // Compared after validation, so the more specific complaint wins: telling
  // someone their two short passwords do not match wastes the round trip.
  if (password !== confirmation) return "Those two passwords do not match.";

  return null;
}
