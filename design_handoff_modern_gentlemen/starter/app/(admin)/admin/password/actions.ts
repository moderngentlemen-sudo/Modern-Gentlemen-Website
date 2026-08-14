"use server";

import { z } from "zod";
import { passwordProblem } from "@/lib/domain/passwords";
import { createClient } from "@/lib/db/server";
import { requireUser } from "@/lib/services/auth";
import { ok, fail, type ActionResult } from "../_lib/action-result";
import { toActionResult } from "../_lib/errors";

const ChangePassword = z.object({
  password: z.string(),
  confirmation: z.string(),
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
 * ⚠️ **No current-password check, deliberately.** This same page is where the
 * recovery link lands, and someone arriving from that link does not know their
 * old password — that is the entire reason they are here. The protection is that
 * a session is required at all: a recovery session is minted only by clicking a
 * single-use link sent to the account's own inbox.
 *
 * The cost is real and worth stating: anyone holding a live session on an
 * unlocked machine can change the password without knowing it. Closing that
 * needs GoTrue's reauthentication flow (a `nonce` sent by email), which is a
 * larger slice; it is recorded in PROGRESS.md rather than left implied.
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
    await requireUser();

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    // Surfaced as-is: GoTrue's own refusals ("New password should be different
    // from the old password") are already the sentence the user needs, and
    // rewording them would only lose information.
    if (error) return fail(error.message);

    return ok(undefined);
  } catch (error) {
    return toActionResult(error);
  }
}
