import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fetchHatenaTags } from "@/lib/hatena-bookmark-api";
import { getHatenaRouteContext } from "@/lib/hatena-route-auth";
import type {
  TagCleanupCandidatesResponse,
  TagMappingAction,
  TagMappingCandidate,
} from "@/types/habu";

const MAX_TAGS_IN_PROMPT = 180;

const CandidateSchema = z.object({
  candidates: z
    .array(
      z.object({
        sourceTag: z.string().min(1).max(40),
        action: z.enum(["update", "delete"]),
        // OpenAI structured outputs require every property to be listed in `required`.
        // Use `null` when there is no replacement target.
        targetTag: z.string().min(1).max(40).nullable(),
        reason: z.string().min(1).max(160),
      }),
    )
    .max(40),
});

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

function normalizeAction(value: TagMappingAction, targetTag?: string | null) {
  if (value === "update" && targetTag?.trim()) return value;
  return "delete";
}

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateSameOrigin(request);
    if (csrfError) {
      return NextResponse.json(
        { success: false, error: csrfError } as TagCleanupCandidatesResponse,
        { status: 403 },
      );
    }

    const authResult = await getHatenaRouteContext(request.headers);
    if (!authResult.ok) {
      return NextResponse.json(
        { success: false, error: authResult.error } as TagCleanupCandidatesResponse,
        { status: authResult.status },
      );
    }

    const { env } = getCloudflareContext();
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" } as TagCleanupCandidatesResponse,
        { status: 500 },
      );
    }

    const tagInventory = await fetchHatenaTags(authResult.context);
    const tagsForPrompt = tagInventory.slice(0, MAX_TAGS_IN_PROMPT);
    const inventoryMap = new Map(tagInventory.map((tag) => [tag.tag.toLowerCase(), tag]));

    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    const result = await generateObject({
      model: openai("gpt-5-mini"),
      schema: CandidateSchema,
      system: `You are a tag taxonomy editor for Hatena Bookmark.

Rules:
- Suggest only tags that should change.
- If a tag should stay as-is, omit it from the output.
- Use action="update" when a tag should be merged into an existing tag or renamed.
- Use action="delete" when a tag should be removed without replacement.
- Prefer merging into an existing tag when that keeps the taxonomy cleaner.
- Never emit duplicate sourceTag values.
- Keep reasons concise.`,
      prompt: `<tag_inventory>
${tagsForPrompt.map((tag) => `- ${tag.tag} (${tag.count})`).join("\n")}
</tag_inventory>

Suggest cleanup candidates for this tag inventory. Return only tags that should change.`,
    });

    const usedSources = new Set<string>();
    const candidates: TagMappingCandidate[] = [];

    for (const item of result.object.candidates) {
      const sourceTag = item.sourceTag.trim();
      const sourceMeta = inventoryMap.get(sourceTag.toLowerCase());
      if (!sourceMeta) continue;

      const sourceKey = sourceTag.toLowerCase();
      if (usedSources.has(sourceKey)) continue;
      usedSources.add(sourceKey);

      const targetTag = item.targetTag?.trim();
      const action = normalizeAction(item.action, targetTag);
      const targetMeta = targetTag ? inventoryMap.get(targetTag.toLowerCase()) : undefined;

      candidates.push({
        sourceTag: sourceMeta.tag,
        action,
        targetTag: action === "update" ? targetTag : undefined,
        reason: item.reason,
        sourceCount: sourceMeta.count,
        targetCount: targetMeta?.count ?? 0,
        suggested: true,
      });
    }

    return NextResponse.json({
      success: true,
      candidates,
      missingWritePrivate: !authResult.context.scopes.includes("write_private"),
    } as TagCleanupCandidatesResponse);
  } catch (error) {
    console.error("Tag cleanup candidates API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as TagCleanupCandidatesResponse,
      { status: 500 },
    );
  }
}
