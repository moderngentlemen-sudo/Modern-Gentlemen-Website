"use server";

import { z } from "zod";
import { passwordProblem } from "@/lib/domain/passwords";
import { createClient } from "@/lib/db/server";
import { createPublicClient } from "@/lib/db/public";
import { requireUser } from "@/lib/services/auth";
import { clearRecoveryMarker, hasRecoveryMarker } from "@/app/auth/_lib/recovery";
import { ok, fail, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

const ChangePassword = z.object({
  password: z.string(),
  confirmation: z.string(),
  /** Absent on a recovery landing, where the user does not have one to give. */
  currentPassword: z.string().optional(),
});

/**
 * Set the signed-in user's password.
 *
 * Uses the caller's own session (`lib/db/server.ts`), never the service-role
 * client — the standing rule, and here it is also what makes the operation
 * correct rather than merely compliant: `updateUser` acts on whoever the session
 * belongs to, so there is no user id to get wrong and no way to aim this at
 * another account.
 *
 * ⚠️ **The current password is required, except on a recovery landing** — and
 * the exception is not a loophole, it is the only thing that keeps recovery
 * working. This page is where the reset link lands, and someone arriving from
 * that link does not know their old password; not knowing it is why they asked
 * for the link. An unconditional check would not harden recovery, it would
 * delete it. `app/auth/_lib/recovery.ts` carries the reasoning and the marker
 * that distinguishes the two cases: a session minted at `/auth/callback` has
 * proved control of the account's inbox, which is stronger evidence than a
 * password, and nothing else has.
 *
 * This closes what the previous version of this comment recorded as a known
 * cost — "anyone holding a live session on an unlocked machine can change the
 * password without knowing it". It is not GoTrue's `reauthentication` flow (a
 * nonce mailed at the moment of the change), which is stronger and remains the
 * larger slice; what this removes is the four-keystroke account takeover from an
 * unattended browser.
 *
 * ⚠️ **The check runs on `createPublicClient()`, not on the caller's own
 * client**, and that matters. `signInWithPassword` on the session client would
 * re-issue the session mid-action and rotate its cookies underneath a request
 * that is about to change the password anyway. The public client persists
 * nothing (`persistSession: false`), so the token it mints is created, read for
 * a yes/no, and dropped.
 */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = ChangePassword.safeParse(input);
  if (!parsed.success) return fail("That request was not understood.");

  // Validated before the session lookup so an obviously bad password costs no
  // database round trip, and re-validated here rather than trusting the client's
  // copy of the same rules.
  const problem = passwordProblem(parsed.data.password, parsed.data.confirmation);
  if (problem) return fail(problem);

  try {
    const user = await requireUser();

    // Read before the write, and the ORDER is the point: a recovery landing is
    // exempt, everything else has to prove it already knows the password.
    const recovering = await hasRecoveryMarker();

    if (!recovering) {
      const current = parsed.data.currentPassword ?? "";
      if (current === "") return fail("Enter your current password.");

      const { error: wrong } = await createPublicClient().auth.signInWithPassword({
        email: user.email,
        password: current,
      });

      // Deliberately not GoTrue's own message. "Invalid login credentials" is
      // the right answer on a sign-in form and a confusing one here, where the
      // email is not in question and only one field can be wrong.
      if (wrong) return fail("That is not your current password.");
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    // Surfaced as-is: GoTrue's own refusals ("New password should be different
    // from the old password") are already the sentence the user needs, and
    // rewording them would only lose information.
    if (error) return fail(error.message);

    // Spent on use. The exemption covers one change, not the rest of the
    // quarter-hour — and after this one the user knows a password again.
    if (recovering) await clearRecoveryMarker();

    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
