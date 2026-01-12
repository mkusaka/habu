import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "./types";
import { addBookmark, addBookmarkSchema } from "./tools/add-bookmark";
import { getBookmark, getBookmarkSchema } from "./tools/get-bookmark";
import { listBookmarks, listBookmarksSchema } from "./tools/list-bookmarks";
import { deleteBookmark, deleteBookmarkSchema } from "./tools/delete-bookmark";
import { suggestComment, suggestCommentSchema } from "./tools/suggest-comment";

export interface McpEnv {
  HATENA_CONSUMER_KEY: string;
  HATENA_CONSUMER_SECRET: string;
}

export function createMcpServer(context: McpContext, env: McpEnv): McpServer {
  const server = new McpServer({
    name: "habu",
    version: "1.0.0",
  });

  // Register tools
  server.tool(
    "add_bookmark",
    "Add a URL to Hatena Bookmark. Can optionally include a comment and tags.",
    addBookmarkSchema.shape,
    async (params) => {
      const input = addBookmarkSchema.parse(params);
      const result = await addBookmark(input, context, env);

      if (result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Bookmark added successfully!\nURL: ${result.data.url}\nComment: ${result.data.comment || "(no comment)"}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_bookmark",
    "Get information about a specific bookmark by URL.",
    getBookmarkSchema.shape,
    async (params) => {
      const input = getBookmarkSchema.parse(params);
      const result = await getBookmark(input, context, env);

      if (result.success) {
        const { data } = result;
        return {
          content: [
            {
              type: "text" as const,
              text: `URL: ${data.url}\nComment: ${data.comment || "(no comment)"}\nTags: ${data.tags.length > 0 ? data.tags.join(", ") : "(no tags)"}\nCreated: ${data.createdAt}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_bookmarks",
    "Get a list of your Hatena Bookmarks. Supports pagination with limit and offset.",
    listBookmarksSchema.shape,
    async (params) => {
      const input = listBookmarksSchema.parse(params);
      const result = await listBookmarks(input, context, env);

      if (result.success) {
        const { data } = result;
        const bookmarkList = data.bookmarks
          .map(
            (b, i) =>
              `${i + 1}. ${b.title}\n   URL: ${b.url}\n   Comment: ${b.comment || "(no comment)"}\n   Tags: ${b.tags.length > 0 ? b.tags.join(", ") : "(no tags)"}`,
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Bookmarks for ${data.username} (showing ${data.bookmarks.length} items):\n\n${bookmarkList}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "delete_bookmark",
    "Delete a bookmark by URL.",
    deleteBookmarkSchema.shape,
    async (params) => {
      const input = deleteBookmarkSchema.parse(params);
      const result = await deleteBookmark(input, context, env);

      if (result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Bookmark deleted successfully!\nURL: ${result.data.url}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "suggest_comment",
    "Generate an AI-powered summary and tags suggestion for a URL. Does not add the bookmark - use add_bookmark separately if you want to save it.",
    suggestCommentSchema.shape,
    async (params) => {
      const input = suggestCommentSchema.parse(params);
      const result = await suggestComment(input, context, env);

      if (result.success) {
        const { data } = result;
        return {
          content: [
            {
              type: "text" as const,
              text: `AI Suggestion Generated:\n\nSummary: ${data.summary}\nTags: ${data.tags.join(", ")}\n\nFormatted comment (ready to use with add_bookmark):\n${data.formattedComment}${data.canonicalUrl ? `\n\nCanonical URL: ${data.canonicalUrl}` : ""}`,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text" as const, text: `Error: ${result.error}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}
