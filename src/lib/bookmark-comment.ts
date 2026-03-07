const TAG_PREFIX_REGEX = /^\[([^\]]+)\]/;

export function extractTagsFromComment(comment: string): string[] {
  const tags: string[] = [];
  let remaining = comment;
  let match: RegExpExecArray | null;

  while ((match = TAG_PREFIX_REGEX.exec(remaining)) !== null) {
    tags.push(match[1]);
    remaining = remaining.slice(match[0].length);
  }

  return tags;
}

export function extractCommentText(comment: string): string {
  return comment.replace(/^(\[[^\]]+\])+/, "").trim();
}

export function parseTaggedComment(comment: string): { tags: string[]; commentText: string } {
  return {
    tags: extractTagsFromComment(comment),
    commentText: extractCommentText(comment),
  };
}

export function sanitizeBookmarkTags(tags: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    const normalized = tag.trim().replace(/[?/%[\]:]/g, "");
    if (!normalized || normalized.length > 10) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

export function formatCommentWithTags(commentText: string, tags: string[]): string {
  const normalizedTags = sanitizeBookmarkTags(tags);
  const tagPart = normalizedTags.map((tag) => `[${tag}]`).join("");
  const normalizedComment = commentText.trim();
  return `${tagPart}${normalizedComment}`;
}
