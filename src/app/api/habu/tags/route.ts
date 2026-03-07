import { NextRequest, NextResponse } from "next/server";
import { fetchHatenaTags } from "@/lib/hatena-bookmark-api";
import { getHatenaRouteContext } from "@/lib/hatena-route-auth";
import type { HatenaTagsListResponse } from "@/types/habu";

export async function GET(request: NextRequest) {
  try {
    const authResult = await getHatenaRouteContext(request.headers);
    if (!authResult.ok) {
      return NextResponse.json(
        { success: false, error: authResult.error } as HatenaTagsListResponse,
        { status: authResult.status },
      );
    }

    const tags = await fetchHatenaTags(authResult.context);

    return NextResponse.json({
      success: true,
      tags,
      missingWritePrivate: !authResult.context.scopes.includes("write_private"),
    } as HatenaTagsListResponse);
  } catch (error) {
    console.error("Hatena tags API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as HatenaTagsListResponse,
      { status: 500 },
    );
  }
}
