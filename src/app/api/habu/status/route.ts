import { NextRequest, NextResponse } from "next/server";
import { getHabuSession } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const session = await getHabuSession(request);
    const hasHatena = !!(
      request.cookies.get("hatena_access_token")?.value &&
      request.cookies.get("hatena_access_token_secret")?.value
    );

    return NextResponse.json({
      authenticated: !!session,
      hasHatena,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { authenticated: false, hasHatena: false },
      { status: 500 }
    );
  }
}
