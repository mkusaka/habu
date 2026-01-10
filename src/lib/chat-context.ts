/**
 * Chat context types and utilities
 * Used to build system prompts and pass context to the chat API
 */

export interface PageMetadata {
  title?: string;
  description?: string;
  lang?: string;
  ogType?: string;
  siteName?: string;
  keywords?: string;
  author?: string;
}

export interface ChatContext {
  url: string;
  markdown?: string;
  metadata?: PageMetadata;
  existingComment?: string;
  existingTags?: string[];
}

const MAX_MARKDOWN_LENGTH = 50000;

export function buildChatSystemPrompt(context: ChatContext): string {
  const truncatedMarkdown = context.markdown?.slice(0, MAX_MARKDOWN_LENGTH);
  const markdownSection = truncatedMarkdown
    ? `<page_content>
${truncatedMarkdown}${context.markdown && context.markdown.length > MAX_MARKDOWN_LENGTH ? "\n[...truncated...]" : ""}
</page_content>`
    : "<page_content>No content available</page_content>";

  const bookmarkSection =
    context.existingComment || context.existingTags?.length
      ? `<current_bookmark>
${context.existingTags?.length ? `Tags: ${context.existingTags.join(", ")}` : "Tags: None"}
${context.existingComment ? `Comment: ${context.existingComment}` : "Comment: None"}
</current_bookmark>`
      : "";

  return `You are a helpful assistant for Hatena Bookmark users. You help users understand web pages they are bookmarking.

<context>
URL: ${context.url}
Title: ${context.metadata?.title || "Unknown"}
${context.metadata?.siteName ? `Site: ${context.metadata.siteName}` : ""}
${context.metadata?.lang ? `Language: ${context.metadata.lang}` : ""}
</context>

${markdownSection}

${bookmarkSection}

Your capabilities:
- Answer questions about the page content
- Summarize the page or specific sections
- Suggest bookmark comments or tags
- Explain technical concepts mentioned in the page
- Help with any other questions about the content

Respond concisely and helpfully. Use Japanese if the user writes in Japanese.`;
}

export function extractTagsFromComment(comment: string): string[] {
  const tags: string[] = [];
  const tagRegex = /^\[([^\]]+)\]/;
  let remaining = comment;
  let match;
  while ((match = tagRegex.exec(remaining)) !== null) {
    tags.push(match[1]);
    remaining = remaining.slice(match[0].length);
  }
  return tags;
}

export function extractCommentText(comment: string): string {
  return comment.replace(/^(\[[^\]]+\])+/, "").trim();
}
