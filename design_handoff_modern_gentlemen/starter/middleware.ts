import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { fetchForKey } from "@/lib/db/apiKey";
import {
  isAdminPath,
  isAllowedWithoutStaff,
  isApiPath,
  isHomepageOnlyMode,
} from "@/lib/domain/siteAccess";

/**
 * Refreshes Supabase auth cookies and enforces the application route gate.
 *
 * In homepage-only mode, every website page and non-homepage API requires an
 * authenticated staff account (at least one user_roles grant). Hiding links
 * in the UI is not authorization: direct navigation, RSC prefetch requests,
 * draft previews and API routes all pass through this gate.
 *
 * Admin renders are guarded again in the admin layout and admin mutations by
 * permission checks and RLS. Published data and public storage in Supabase are
 * a *separate* exposure surface; this middleware cannot make those private.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  // Middleware has its own cookie plumbing. Keep the modern publishable-key
  // fetch wrapper, otherwise getUser() sends an invalid Bearer header.
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    global: { fetch: fetchForKey(key) },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * Supabase can rotate a session during getUser(). A redirect constructed
   * afterwards must retain *all* rotated cookies, not just a successful
   * NextResponse.next(), or the editor is signed out on the next request.
   */
  function withCookies(target: NextResponse): NextResponse {
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  }

  const { pathname } = request.nextUrl;
  const adminRoute = isAdminPath(pathname);

  if (adminRoute && !user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    signIn.searchParams.set("next", pathname);
    return withCookies(NextResponse.redirect(signIn));
  }

  if (pathname === "/sign-in" && user) {
    const admin = request.nextUrl.clone();
    admin.pathname = "/admin";
    admin.search = "";
    return withCookies(NextResponse.redirect(admin));
  }

  if (isHomepageOnlyMode() && !adminRoute && !isAllowedWithoutStaff(pathname)) {
    // Neither an authenticated member without an admin role nor a signed-out
    // user may access private published pages or the search/API endpoints.
    let staff = false;
    if (user) {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role_key")
        .eq("user_id", user.id)
        .limit(1);
      if (error) console.error("Site access role lookup failed:", error.message);
      staff = !error && (roles?.length ?? 0) > 0;
    }

    if (!staff) {
      if (isApiPath(pathname)) {
        return withCookies(
          NextResponse.json(
            { error: "Forbidden" },
            { status: 403, headers: { "Cache-Control": "private, no-store" } }
          )
        );
      }
      const homepage = request.nextUrl.clone();
      homepage.pathname = "/";
      homepage.search = "";
      return withCookies(
        NextResponse.redirect(homepage, {
          headers: {
            "Cache-Control": "private, no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        })
      );
    }

    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}

export const config = {
  matcher: [
    // Includes page/RSC requests and /api; omits only static binaries.
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|woff|woff2)$).*)",
  ],
};
