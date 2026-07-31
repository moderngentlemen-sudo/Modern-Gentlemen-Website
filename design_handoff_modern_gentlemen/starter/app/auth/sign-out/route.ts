import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";

/**
 * POST-only by design: a GET sign-out can be triggered by any third-party page
 * embedding an image or link, which is a nuisance-logout vector.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Redirect via nextUrl.clone(), NOT `new URL("/", request.url)`. In a route
  // handler `request.url` can carry a different host than the one the browser
  // is actually on (localhost vs 127.0.0.1 locally, and the internal origin
  // behind a proxy). Auth cookies are host-scoped, so redirecting across hosts
  // strands the user on an origin where they still appear signed in.
  const home = request.nextUrl.clone();
  home.pathname = "/";
  home.search = "";

  // 303 so the browser follows with GET rather than replaying the POST.
  return NextResponse.redirect(home, { status: 303 });
}
