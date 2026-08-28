import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/**
 * The marker that says "this session was minted by proving control of the
 * inbox", and the reason `/admin/password` can ask for the current password at
 * all.
 *
 * ⚠️ **The two requirements are in direct tension, and that tension is why this
 * exists.** Requiring the current password is the obvious hardening: it is what
 * stops someone at an unlocked machine, holding a live session, from locking the
 * real owner out of their own account in four keystrokes. But `/admin/password`
 * is also **where a recovery link lands**, and somebody arriving from that link
 * does not know their old password — not knowing it is the entire reason they
 * asked for the link. Requiring it unconditionally does not harden recovery; it
 * *removes* recovery.
 *
 * So the requirement is conditional on how the session was obtained.
 * `/auth/callback` is the only route that exchanges a one-time code, and a code
 * only reaches a browser through a link Supabase emailed to the account's own
 * address. A session minted there has already proved something stronger than a
 * password. Every other session — a normal sign-in, a refreshed cookie, a stolen
 * one — has not, and gets asked.
 *
 * **What this is not.** It is not GoTrue's `reauthentication` flow (a nonce
 * mailed at the moment of the change), which is stronger and is a larger slice.
 * And the marker is a plain cookie: `httpOnly` keeps it away from page
 * JavaScript, `sameSite: "lax"` keeps a cross-site request from riding it, and
 * the short lifetime keeps it from outliving the visit — but anything that can
 * already run script on this origin can set it, and at that point it is not the
 * weakest link. Stated rather than implied.
 */
export const RECOVERY_COOKIE = "mg-recovery";

/**
 * Fifteen minutes: long enough to read the page, choose a password and mistype
 * it twice; short enough that a shared machine does not carry the exemption into
 * somebody else's session. It is also cleared explicitly the moment the password
 * changes, so this is the backstop rather than the mechanism.
 */
const RECOVERY_TTL_SECONDS = 15 * 60;

const options = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // Never `true` in development: a secure cookie over http is silently dropped,
  // and the symptom would be "recovery asks for the password I do not have".
  secure: process.env.NODE_ENV === "production",
};

/** Called by `/auth/callback` on a successful code exchange, on its redirect. */
export function markRecoverySession(response: NextResponse): void {
  response.cookies.set(RECOVERY_COOKIE, "1", { ...options, maxAge: RECOVERY_TTL_SECONDS });
}

/** True when the current request carries the marker. */
export async function hasRecoveryMarker(): Promise<boolean> {
  return (await cookies()).get(RECOVERY_COOKIE)?.value === "1";
}

/**
 * Spent on use.
 *
 * The exemption is for *one* password change, not for the next fifteen minutes
 * of whatever else happens in this tab. Clearing it on success means a second
 * change in the same session is asked for the password the first one just set —
 * which the user now knows.
 */
export async function clearRecoveryMarker(): Promise<void> {
  (await cookies()).set(RECOVERY_COOKIE, "", { ...options, maxAge: 0 });
}
