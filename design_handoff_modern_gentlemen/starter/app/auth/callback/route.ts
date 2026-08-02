import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";

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

  // Same reasoning as sign-out: build redirects from nextUrl so the user stays
  // on the host they arrived on.
  const to = (pathname: string, error?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = error ? `?error=${error}` : "";
    return url;
  };

  if (!code) return NextResponse.redirect(to("/sign-in", "missing_code"));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) return NextResponse.redirect(to("/sign-in", "invalid_code"));

  return NextResponse.redirect(to(next));
}
