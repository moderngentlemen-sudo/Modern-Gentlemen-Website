import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import { publicUrl } from "../_lib/publicUrl";

/**
 * POST-only by design: a GET sign-out can be triggered by any third-party page
 * embedding an image or link, which is a nuisance-logout vector.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Auth cookies are host-scoped, so redirecting across hosts strands the user
  // on an origin where they still appear signed in. `request.url` gets that
  // wrong, and so — behind a proxy — does `request.nextUrl`, which is what
  // `publicUrl` exists to correct. See the note in ../_lib/publicUrl.ts.
  const home = publicUrl(request, "/");

  // 303 so the browser follows with GET rather than replaying the POST.
  return NextResponse.redirect(home, { status: 303 });
}
