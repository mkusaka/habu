import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const hasHatena = !!(
      request.cookies.get("hatena_access_token")?.value &&
      request.cookies.get("hatena_access_token_secret")?.value
    );

    return NextResponse.json({
      authenticated: true, // Always true since we don't require auth
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
