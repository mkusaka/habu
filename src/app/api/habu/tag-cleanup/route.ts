import { NextRequest, NextResponse } from "next/server";
import { getHatenaRouteContext } from "@/lib/hatena-route-auth";
import {
  applyTagMappings,
  findBookmarksByTag,
  updateBookmarkTags,
} from "@/lib/hatena-bookmark-api";
import type {
  TagCleanupFailure,
  TagCleanupRequest,
  TagCleanupResponse,
  TagMappingCandidate,
} from "@/types/habu";

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

function normalizeMappings(mappings: TagMappingCandidate[]) {
  const actionable: TagMappingCandidate[] = [];
  const seen = new Set<string>();

  for (const mapping of mappings) {
    const sourceTag = mapping.sourceTag?.trim();
    if (!sourceTag) continue;

    if (seen.has(sourceTag)) {
      throw new Error(`Duplicate source tag: ${sourceTag}`);
    }
    seen.add(sourceTag);

    if (mapping.action === "no_change") continue;

    if (mapping.action === "update") {
      const targetTag = mapping.targetTag?.trim();
      if (!targetTag) {
        throw new Error(`targetTag is required for ${sourceTag}`);
      }
      if (targetTag === sourceTag) continue;
      actionable.push({ ...mapping, sourceTag, targetTag });
      continue;
    }

    actionable.push({ ...mapping, sourceTag, targetTag: undefined });
  }

  return actionable;
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
    const mappings = normalizeMappings(body.mappings ?? []);

    if (mappings.length === 0) {
      return NextResponse.json({
        success: true,
        mappings: [],
        totalMatched: 0,
        preview: [],
      } as TagCleanupResponse);
    }

    const bookmarksByUrl = new Map<string, NonNullable<TagCleanupResponse["preview"]>[number]>();

    for (const mapping of mappings) {
      const matchedBookmarks = await findBookmarksByTag(authResult.context, mapping.sourceTag);
      for (const bookmark of matchedBookmarks) {
        const existing = bookmarksByUrl.get(bookmark.url);
        if (!existing) {
          bookmarksByUrl.set(bookmark.url, {
            ...bookmark,
            nextTags: bookmark.currentTags,
            matchedSourceTags: [],
          });
        }
      }
    }

    const preview = [...bookmarksByUrl.values()]
      .map((bookmark) => {
        const applied = applyTagMappings(bookmark.currentTags, mappings);
        return {
          ...bookmark,
          nextTags: applied.nextTags,
          matchedSourceTags: applied.matchedSourceTags,
        };
      })
      .filter(
        (bookmark) => bookmark.currentTags.join("\u0000") !== bookmark.nextTags.join("\u0000"),
      );

    if (body.mode === "preview") {
      return NextResponse.json({
        success: true,
        mappings,
        totalMatched: preview.length,
        preview: preview.slice(0, MAX_PREVIEW_ITEMS),
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
      mappings,
      totalMatched: preview.length,
      updatedCount,
      failed: failures,
      preview: preview.slice(0, MAX_PREVIEW_ITEMS),
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
