import { NextResponse, type NextRequest } from "next/server";

import { submitPublicForm } from "@/lib/services/forms";
import { clientIdentity, FORM_PER_CALLER } from "@/lib/services/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid-form" }, { status: 400 });
  }

  const outcome = await submitPublicForm({
    formKey: body.formKey,
    fields: body.fields,
    pagePath: body.pagePath,
    honeypot: body.website,
    identity: clientIdentity(request.headers),
  });
  if (outcome.ok) return NextResponse.json(outcome, { status: 201 });
  if (outcome.reason === "rate-limited") {
    return NextResponse.json(outcome, {
      status: 429,
      headers: { "Retry-After": String(FORM_PER_CALLER.windowSeconds) },
    });
  }
  if (outcome.reason === "unavailable") console.error("Public form submission failed.");
  return NextResponse.json(outcome, { status: outcome.reason === "invalid-form" ? 400 : 503 });
}

export function GET() {
  return NextResponse.json(
    { ok: false, reason: "method-not-allowed" },
    { status: 405, headers: { Allow: "POST" } }
  );
}
