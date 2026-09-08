import { NextResponse, type NextRequest } from "next/server";
import { readDesignStudio } from "@/lib/services/designStudio";
import { ForbiddenError, UnauthenticatedError } from "@/lib/domain/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const asset = await readDesignStudio(request.nextUrl.searchParams.get("asset") || "index.html");
    if (!asset) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(asset.body, {
      headers: {
        "Content-Type": asset.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      return new NextResponse("Sign in required", { status: 401 });
    if (error instanceof ForbiddenError) return new NextResponse("Not permitted", { status: 403 });
    throw error;
  }
}
