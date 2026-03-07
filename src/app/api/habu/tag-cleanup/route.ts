import { NextRequest, NextResponse } from "next/server";
import { getHatenaRouteContext } from "@/lib/hatena-route-auth";
import {
  findBookmarksByTag,
  replaceBookmarkTag,
  updateBookmarkTags,
} from "@/lib/hatena-bookmark-api";
import type { TagCleanupFailure, TagCleanupRequest, TagCleanupResponse } from "@/types/habu";

const MAX_PREVIEW_ITEMS = 50;

function validateSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const requestUrl = new URL(request.url);
  const expectedOrigin = requestUrl.origin;

  if (origin && origin !== expectedOrigin) {
    return "Invalid origin";
  }

  if (!origin && referer) {
    const refererUrl = new URL(referer);
    if (refererUrl.origin !== expectedOrigin) {
      return "Invalid referer";
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateSameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError } as TagCleanupResponse, {
        status: 403,
      });
    }

    const authResult = await getHatenaRouteContext(request.headers);
    if (!authResult.ok) {
      return NextResponse.json({ success: false, error: authResult.error } as TagCleanupResponse, {
        status: authResult.status,
      });
    }

    const body = (await request.json()) as TagCleanupRequest;
    const sourceTag = body.sourceTag?.trim();
    const targetTag = body.targetTag?.trim();

    if (!sourceTag || !targetTag) {
      return NextResponse.json(
        { success: false, error: "sourceTag and targetTag are required" } as TagCleanupResponse,
        { status: 400 },
      );
    }

    if (sourceTag.toLowerCase() === targetTag.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "sourceTag and targetTag must be different",
        } as TagCleanupResponse,
        { status: 400 },
      );
    }

    const missingWritePrivate = !authResult.context.scopes.includes("write_private");
    const matchedBookmarks = await findBookmarksByTag(authResult.context, sourceTag);
    const preview = matchedBookmarks.map((bookmark) => ({
      ...bookmark,
      nextTags: replaceBookmarkTag(bookmark.currentTags, sourceTag, targetTag),
    }));

    if (body.mode === "preview") {
      return NextResponse.json({
        success: true,
        sourceTag,
        targetTag,
        totalMatched: preview.length,
        preview: preview.slice(0, MAX_PREVIEW_ITEMS),
        missingWritePrivate,
      } as TagCleanupResponse);
    }

    const failures: TagCleanupFailure[] = [];
    let updatedCount = 0;

    for (const bookmark of preview) {
      try {
        await updateBookmarkTags(authResult.context, {
          url: bookmark.url,
          commentText: bookmark.commentText,
          tags: bookmark.nextTags,
          isPrivate: bookmark.isPrivate,
        });
        updatedCount += 1;
      } catch (error) {
        failures.push({
          url: bookmark.url,
          title: bookmark.title,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      sourceTag,
      targetTag,
      totalMatched: preview.length,
      updatedCount,
      failed: failures,
      preview: preview.slice(0, MAX_PREVIEW_ITEMS),
      missingWritePrivate,
    } as TagCleanupResponse);
  } catch (error) {
    console.error("Tag cleanup API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as TagCleanupResponse,
      { status: 500 },
    );
  }
}
