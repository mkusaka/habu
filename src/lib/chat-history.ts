import type { UIMessage } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { chatThreads } from "@/db/schema";

export interface ChatThreadSummary {
  id: string;
  query?: string;
  url?: string;
  title?: string;
  updatedAt: Date;
  messageCount: number;
  lastMessagePreview?: string;
}

export interface ChatThreadRecord extends ChatThreadSummary {
  messages: UIMessage[];
}

function parseMessages(raw: string): UIMessage[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : [];
  } catch {
    return [];
  }
}

function extractText(message: UIMessage | undefined): string {
  if (!message) {
    return "";
  }

  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export async function listChatThreadsForHatenaAccount(
  hatenaId: string,
  dbBinding: D1Database,
): Promise<ChatThreadSummary[]> {
  const db = getDb(dbBinding);
  const rows = await db.query.chatThreads.findMany({
    where: eq(chatThreads.hatenaId, hatenaId),
    orderBy: [desc(chatThreads.updatedAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    query: row.query ?? undefined,
    url: row.url ?? undefined,
    title: row.title ?? undefined,
    updatedAt: row.updatedAt,
    messageCount: row.messageCount,
    lastMessagePreview: row.lastMessagePreview ?? undefined,
  }));
}

export async function getChatThreadForHatenaAccount(
  hatenaId: string,
  threadId: string,
  dbBinding: D1Database,
): Promise<ChatThreadRecord | null> {
  const db = getDb(dbBinding);
  const row = await db.query.chatThreads.findFirst({
    where: and(eq(chatThreads.hatenaId, hatenaId), eq(chatThreads.id, threadId)),
  });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    query: row.query ?? undefined,
    url: row.url ?? undefined,
    title: row.title ?? undefined,
    updatedAt: row.updatedAt,
    messageCount: row.messageCount,
    lastMessagePreview: row.lastMessagePreview ?? undefined,
    messages: parseMessages(row.messages),
  };
}

export async function saveChatThreadForHatenaAccount(params: {
  threadId: string;
  userId: string;
  hatenaId: string;
  query?: string;
  url?: string;
  title?: string;
  messages: UIMessage[];
  dbBinding: D1Database;
}): Promise<void> {
  const db = getDb(params.dbBinding);
  const now = new Date();
  const lastMessagePreview = extractText(params.messages.at(-1));
  const existingThread = await db.query.chatThreads.findFirst({
    where: eq(chatThreads.id, params.threadId),
  });

  if (existingThread && existingThread.hatenaId !== params.hatenaId) {
    throw new Error("Thread does not belong to the current Hatena account");
  }

  if (existingThread) {
    await db
      .update(chatThreads)
      .set({
        userId: params.userId,
        hatenaId: params.hatenaId,
        query: params.query,
        url: params.url,
        title: params.title,
        messages: JSON.stringify(params.messages),
        messageCount: params.messages.length,
        lastMessagePreview: lastMessagePreview || null,
        updatedAt: now,
      })
      .where(eq(chatThreads.id, params.threadId));
    return;
  }

  await db.insert(chatThreads).values({
    id: params.threadId,
    userId: params.userId,
    hatenaId: params.hatenaId,
    query: params.query,
    url: params.url,
    title: params.title,
    messages: JSON.stringify(params.messages),
    messageCount: params.messages.length,
    lastMessagePreview: lastMessagePreview || null,
    createdAt: now,
    updatedAt: now,
  });
}
