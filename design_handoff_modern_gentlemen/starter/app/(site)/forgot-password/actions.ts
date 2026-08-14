"use server";

import { z } from "zod";
import { canonicalSiteUrl } from "@/lib/db/env";
import { createClient } from "@/lib/db/server";

const ForgotPasswordInput = z.object({
  email: z.string().trim().min(1, "Enter your email").email("That does not look like an email"),
});

export interface ForgotPasswordState {
  error?: string;
  fieldErrors?: { email?: string };
  sent?: boolean;
}

/**
 * Where Supabase sends someone after it has verified the recovery token.
 *
 * ⚠️ Passed explicitly on every request rather than relying on the project's
 * **Site URL** setting, and that is the point of this whole slice. Site URL is
 * one global value: pointing it at a callback path to make recovery work would
 * also change what every other email link means, and leaving it at the origin
 * lands the recovery on the public homepage — which carries a `?code=` that
 * nothing there exchanges, so the visitor arrives successfully and is still
 * signed out. `redirectTo` is per-request and has neither problem.
 *
 * It must still appear in **Authentication → URL Configuration → Redirect
 * URLs**; Supabase refuses any `redirectTo` outside that allow list, which is
 * what stops this being an open redirect.
 */
function recoveryLanding(): string {
  const origin = canonicalSiteUrl().replace(/\/+$/, "");
  return `${origin}/auth/callback?next=${encodeURIComponent("/admin/password")}`;
}

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const parsed = ForgotPasswordInput.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.flatten().fieldErrors.email?.[0] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: recoveryLanding(),
  });

  /**
   * The same answer either way, on purpose — the same stance `signIn` takes when
   * it refuses to distinguish "no such account" from "wrong password".
   *
   * A form that says "no account with that email" is an account-enumeration
   * oracle, and it is a worse one here than on sign-in: this endpoint needs no
   * password to probe with. The rate limit Supabase applies to recovery mail is
   * the other half of that, and it is a reason not to surface its errors either
   * — "too many requests" tells an attacker their guess was worth rate-limiting.
   */
  if (error) {
    // Logged rather than shown: a real misconfiguration (an unlisted redirect
    // URL, SMTP not set up) would otherwise be invisible to whoever deployed it.
    console.error("resetPasswordForEmail failed", error.message);
  }

  return { sent: true };
}
