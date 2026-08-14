import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { publicUrl } from "../_lib/publicUrl";

/**
 * OAuth / magic-link / password-recovery landing.
 *
 * Exchanges the one-time code for a session cookie. Built now, ahead of the
 * flows that need it, so adding "forgot password" or a social provider later is
 * configuration rather than new plumbing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");

  // Same-origin paths only — never redirect to an attacker-supplied absolute URL.
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";

  // `publicUrl`, not `nextUrl.clone()` — behind Railway's proxy the latter is
  // the internal origin, and this route was redirecting recovering users to
  // https://localhost:8080. See the note in ../_lib/publicUrl.ts.
  const to = (pathname: string, error?: string) =>
    publicUrl(request, pathname, error ? `?error=${error}` : "");

  if (!code) return NextResponse.redirect(to("/sign-in", "missing_code"));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(to("/sign-in", "invalid_code"));

  return NextResponse.redirect(to(next));
}
