export type { BookmarkUserContext } from "@/lib/bookmark-user-context";

interface ToolSuccess<T> {
  success: true;
  data: T;
}

interface ToolError {
  success: false;
  error: string;
}

export type ToolResult<T> = ToolSuccess<T> | ToolError;
