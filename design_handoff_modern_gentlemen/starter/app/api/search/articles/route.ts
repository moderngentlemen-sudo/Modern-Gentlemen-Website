import { NextResponse, type NextRequest } from "next/server";

import { searchPublishedArticles } from "@/lib/services/publicEditorial";

export const dynamic = "force-dynamic";

/** Public, anonymous search. RLS and the service's published filter exclude drafts. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length > 100) {
    return NextResponse.json({ results: [], reason: "query-too-long" }, { status: 400 });
  }
  if (!query) return NextResponse.json({ results: [] });

  try {
    const results = await searchPublishedArticles(query);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    console.error("Public article search failed — see the service layer for the cause.");
    return NextResponse.json({ results: [], reason: "unavailable" }, { status: 503 });
  }
}
