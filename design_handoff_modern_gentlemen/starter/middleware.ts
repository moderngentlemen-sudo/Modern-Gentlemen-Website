import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { fetchForKey } from "@/lib/db/apiKey";

/**
 * Refreshes the Supabase session cookie on every matched request, and keeps
 * signed-out visitors out of /admin.
 *
 * The cookie dance matters: @supabase/ssr may rotate the auth token during
 * getUser(), and the refreshed cookie has to be written onto the response that
 * is actually returned. Building `response` first and mutating it in `setAll`
 * is what makes that work — constructing a fresh NextResponse afterwards would
 * silently discard the rotation and log users out roughly every hour.
 *
 * This is a convenience gate, not the security boundary. Row Level Security is
 * the real one; a request that slips past here still cannot read or write
 * anything the user lacks permission for.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  // ⚠️ **The fifth Supabase client, and the one that is easy to forget.** It is
  // built here rather than through `lib/db/server.ts` because middleware has its
  // own cookie plumbing, which means it does not inherit anything that file
  // does — including the modern-key header rule. `lib/db/apiKey.ts` explains
  // why a `sb_publishable_…` key must not travel as a Bearer token; this runs on
  // every matched request and calls `auth.getUser()`, so it is the last place
  // that should be relying on getting away with it.
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

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !user) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = "";
    // Preserve where they were heading so sign-in can return them there.
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  // Someone already signed in has no reason to see the sign-in form.
  if (pathname === "/sign-in" && user) {
    const admin = request.nextUrl.clone();
    admin.pathname = "/admin";
    admin.search = "";
    return NextResponse.redirect(admin);
  }

  return response;
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and image files. The public site is
     * included deliberately: it is how the session cookie stays fresh while a
     * member browses, and it costs one already-cached token check.
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|mp4|webm|woff|woff2)$).*)",
  ],
};
