import { fetchTwitterOEmbed, formatTwitterMarkdown, isTwitterStatusUrl } from "./twitter-oembed";
import { fetchTwitterThreadViaGrok, formatTwitterThreadMarkdown } from "./twitter-grok";

export type TwitterMarkdownResult = {
  markdown: string;
  source: "grok" | "oembed";
};

export async function fetchTwitterMarkdown(
  input: string | URL,
): Promise<TwitterMarkdownResult | null> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    return null;
  }

  if (!isTwitterStatusUrl(url)) return null;

  const thread = await fetchTwitterThreadViaGrok(url);
  if (thread) {
    const markdown = formatTwitterThreadMarkdown(thread);
    if (markdown) return { markdown, source: "grok" };
  }

  const oembed = await fetchTwitterOEmbed(url);
  if (oembed?.text) {
    return { markdown: formatTwitterMarkdown(oembed), source: "oembed" };
  }

  return null;
}
