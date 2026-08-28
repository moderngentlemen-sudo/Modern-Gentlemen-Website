/**
 * Newsletter capture — pure, no data access.
 *
 * **What this replaces is the point.** Both sign-up bands were demo props with
 * a `setDone(true)` and no network call: `Newsletter.tsx` read the address into
 * state and discarded it, and `CtaBand.tsx`'s input was not even controlled, so
 * the address was never read at all. Between them they rendered on **seven live
 * pages** — the homepage and all five category pages, plus `/membership` — and
 * every one told the visitor "you're on the list" or "SUBSCRIBED ✓" while
 * storing nothing anywhere.
 *
 * ⚠️ `PROGRESS.md` described this for several phases as "the newsletter captures
 * to Supabase and reaches no ESP". There was no table, no route handler, no
 * repository and no service. **The backlog line is what stopped anyone
 * looking** — it read as a known, benign, half-finished integration rather than
 * a false confirmation shown to every visitor.
 *
 * This module is the vocabulary. It is deliberately importable by a client
 * component, so it touches no Node built-in — see the standing rule in
 * `CLAUDE.md` about `lib/domain` modules a client imports.
 */

/**
 * Where a sign-up came from.
 *
 * Stored because the two bands convert very differently and nobody can tell
 * which is which after the fact. The values are block types rather than page
 * paths: a block moves between pages, and `newsletter` on the homepage is the
 * same control as `newsletter` anywhere else.
 */
export const SUBSCRIBER_SOURCES = ["newsletter", "ctaBand", "unknown"] as const;
export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

export function isSubscriberSource(value: unknown): value is SubscriberSource {
  return (SUBSCRIBER_SOURCES as readonly unknown[]).includes(value);
}

/**
 * The lifecycle.
 *
 * **`pending` is the default and the only one anything writes today, which is
 * deliberate.** Nothing sends a confirmation email yet, so nobody has confirmed
 * anything, and a row that said `subscribed` would be the same lie the button
 * used to tell — just stored rather than rendered. Double opt-in flips a row to
 * `confirmed`; an ESP sync is what would later mark it `synced`. `unsubscribed`
 * exists so a later removal is a state change rather than a delete, because a
 * deleted row cannot prove you honoured the request.
 */
export const SUBSCRIBER_STATUSES = ["pending", "confirmed", "unsubscribed"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

/** The longest address this accepts. RFC 5321 caps a path at 254 octets. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Normalise an address for storage and comparison.
 *
 * Lowercased and trimmed, and **that is the whole normalisation** — no dot
 * stripping, no `+tag` removal. Both are common and both are wrong: the local
 * part is case-sensitive and provider-defined by RFC 5321, so `a.b@x.com` and
 * `ab@x.com` are the same mailbox at Gmail and different ones elsewhere, and
 * `+tag` is how people track who sold their address. Removing it silently
 * defeats that and merges mailboxes their owner meant to keep apart.
 *
 * Lowercasing is itself a deliberate small violation of the same RFC, taken
 * because every mainstream provider treats the local part case-insensitively
 * and the alternative is two rows for one person.
 */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Is this plausibly an address?
 *
 * ⚠️ **Deliberately permissive, and that is not laziness.** A fully RFC-correct
 * validator rejects addresses that work and accepts ones that do not, and the
 * only real test of an address is sending to it — which is exactly what double
 * opt-in is for. This rejects the shapes that are certainly wrong (no `@`, no
 * dot in the domain, whitespace, over the length cap) and lets the confirmation
 * email be the judge of everything else.
 */
export function isPlausibleEmail(value: string): boolean {
  const email = normaliseEmail(value);
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(email)) return false;

  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;

  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;

  return true;
}

/**
 * What the API answers. A shape rather than a string, so the UI picks the copy.
 *
 * `rate-limited` is separate from `unavailable` because the two mean opposite
 * things to the visitor: one clears by waiting, the other does not clear by
 * anything they can do. It says nothing about the address — a refusal is issued
 * before the address is even looked at — so it is not an enumeration oracle.
 *
 * ⚠️ **Success carries no detail, and it cannot.** An earlier draft returned
 * `alreadySubscribed`, which would have been an enumeration oracle even unused
 * — and it turned out to be unobtainable anyway: reading it back needs a SELECT
 * privilege `anon` deliberately does not hold. So the endpoint cannot tell a
 * new address from a known one, which is a stronger guarantee than choosing not
 * to say.
 */
export type SubscribeOutcome =
  { ok: true } | { ok: false; reason: "invalid-email" | "rate-limited" | "unavailable" };
