import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  formatCommentWithTags,
  parseTaggedComment,
  sanitizeBookmarkTags,
} from "@/lib/bookmark-comment";
import { createSignedRequest } from "@/lib/hatena-oauth";
import type {
  HatenaTag,
  HatenaTagsResponse,
  TidyTagsRequest,
  TidyTagsResponse,
} from "@/types/habu";

const HATENA_TAGS_API_URL = "https://bookmark.hatenaapis.com/rest/1/my/tags";
const MAX_TAG_PROMPT_CHARS = 4000;
const MAX_TAG_PROMPT_ITEMS = 250;

const TidyTagsSchema = z.object({
  tags: z.array(z.string().min(1).max(10)).min(1).max(5),
  reasoning: z.array(z.string().min(1).max(160)).min(1).max(4),
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

function buildTagInventoryPrompt(tags: HatenaTag[], currentTags: string[]) {
  const currentTagKeys = new Set(currentTags.map((tag) => tag.toLowerCase()));
  const prioritized = [...tags].sort((a, b) => {
    const aCurrent = currentTagKeys.has(a.tag.toLowerCase()) ? 1 : 0;
    const bCurrent = currentTagKeys.has(b.tag.toLowerCase()) ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    return b.count - a.count || a.tag.localeCompare(b.tag, "ja");
  });

  const selected: string[] = [];
  let totalChars = 0;

  for (const tag of prioritized) {
    const line = `- ${tag.tag} (${tag.count})`;
    if (
      selected.length >= MAX_TAG_PROMPT_ITEMS ||
      totalChars + line.length + 1 > MAX_TAG_PROMPT_CHARS
    ) {
      break;
    }

    selected.push(line);
    totalChars += line.length + 1;
  }

  return {
    text: selected.join("\n"),
    truncated: selected.length < prioritized.length,
    total: prioritized.length,
    included: selected.length,
  };
}

async function fetchHatenaTags(
  accessToken: string,
  accessTokenSecret: string,
  consumerKey: string,
  consumerSecret: string,
): Promise<HatenaTag[]> {
  const authHeaders = createSignedRequest(
    HATENA_TAGS_API_URL,
    "GET",
    accessToken,
    accessTokenSecret,
    consumerKey,
    consumerSecret,
  );

  const response = await fetch(HATENA_TAGS_API_URL, {
    method: "GET",
    headers: authHeaders,
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    throw new Error(`Hatena Tags API redirect detected: ${response.status} -> ${location}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hatena Tags API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as HatenaTagsResponse;
  return [...data.tags].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "ja"));
}

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateSameOrigin(request);
    if (csrfError) {
      return NextResponse.json({ success: false, error: csrfError } as TidyTagsResponse, {
        status: 403,
      });
    }

    const { env } = getCloudflareContext();
    const auth = createAuth(env.DB);
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Not authenticated" } as TidyTagsResponse, {
        status: 401,
      });
    }

    const db = getDb(env.DB);
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      with: { hatenaToken: true },
    });

    if (!user?.hatenaToken) {
      return NextResponse.json(
        { success: false, error: "Hatena not connected" } as TidyTagsResponse,
        { status: 400 },
      );
    }

    const consumerKey = env.HATENA_CONSUMER_KEY;
    const consumerSecret = env.HATENA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" } as TidyTagsResponse,
        { status: 500 },
      );
    }

    const openaiApiKey = env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" } as TidyTagsResponse,
        { status: 500 },
      );
    }

    const body = (await request.json()) as TidyTagsRequest;
    const { url, comment = "", metadata } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" } as TidyTagsResponse, {
        status: 400,
      });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" } as TidyTagsResponse,
        { status: 400 },
      );
    }

    const { tags: currentTags, commentText } = parseTaggedComment(comment);
    const hatenaTags = await fetchHatenaTags(
      user.hatenaToken.accessToken,
      user.hatenaToken.accessTokenSecret,
      consumerKey,
      consumerSecret,
    );
    const tagInventory = buildTagInventoryPrompt(hatenaTags, currentTags);
    const openai = createOpenAI({ apiKey: openaiApiKey });

    const metadataContext = [
      metadata?.title && `Title: ${metadata.title}`,
      metadata?.description && `Description: ${metadata.description}`,
      metadata?.siteName && `Site: ${metadata.siteName}`,
      metadata?.lang && `Language: ${metadata.lang}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await generateObject({
      model: openai("gpt-5-mini"),
      schema: TidyTagsSchema,
      system: `You are a Hatena Bookmark tag curator.

Rules:
- Suggest the cleanest set of tags for this bookmark.
- Prefer reusing tags from the user's existing tag inventory whenever they fit.
- Only introduce a new tag when no existing tag is a good fit.
- Keep each tag to 10 characters or less.
- Use 1-5 tags.
- Keep technical terms in their original form.
- Do not output duplicate tags.
- Do not output "AI要約".`,
      prompt: `Review this bookmark and suggest a tidied tag set.

URL: ${url}
${metadataContext ? `\n<metadata>\n${metadataContext}\n</metadata>` : ""}

<current_bookmark>
Current tags: ${currentTags.length > 0 ? currentTags.join(", ") : "(none)"}
Comment text: ${commentText || "(none)"}
</current_bookmark>

<tag_inventory total="${tagInventory.total}" included="${tagInventory.included}" truncated="${tagInventory.truncated ? "yes" : "no"}">
${tagInventory.text || "(none)"}
</tag_inventory>

Return a compact, consistent tag set for this bookmark.`,
    });

    const suggestedTags = sanitizeBookmarkTags(result.object.tags);
    const fallbackTags = sanitizeBookmarkTags(currentTags);
    const finalTags = suggestedTags.length > 0 ? suggestedTags : fallbackTags;

    if (finalTags.length === 0) {
      return NextResponse.json(
        { success: false, error: "Failed to generate tag suggestions" } as TidyTagsResponse,
        { status: 500 },
      );
    }

    const currentTagKeys = new Set(currentTags.map((tag) => tag.toLowerCase()));
    const finalTagKeys = new Set(finalTags.map((tag) => tag.toLowerCase()));

    return NextResponse.json({
      success: true,
      suggestion: {
        tags: finalTags,
        commentText,
        formattedComment: formatCommentWithTags(commentText, finalTags),
        addTags: finalTags.filter((tag) => !currentTagKeys.has(tag.toLowerCase())),
        removeTags: currentTags.filter((tag) => !finalTagKeys.has(tag.toLowerCase())),
        reasoning: result.object.reasoning,
      },
    } as TidyTagsResponse);
  } catch (error) {
    console.error("Tag tidy up API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      } as TidyTagsResponse,
      { status: 500 },
    );
  }
}
