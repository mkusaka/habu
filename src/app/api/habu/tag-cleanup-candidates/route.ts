import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fetchHatenaTags } from "@/lib/hatena-bookmark-api";
import { getHatenaRouteContext } from "@/lib/hatena-route-auth";
import { validateSameOrigin } from "@/lib/same-origin";
import { materializeTagCleanupCandidates } from "@/lib/tag-cleanup-candidates";
import type { TagCleanupCandidatesResponse } from "@/types/habu";

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

    const candidates = materializeTagCleanupCandidates(result.object.candidates, tagInventory);

    return NextResponse.json({
      success: true,
      candidates,
      tagCount: tagInventory.length,
      hatenaId: authResult.context.hatenaId,
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
