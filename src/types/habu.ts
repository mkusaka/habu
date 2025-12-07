// Hatena OAuth types
export interface HatenaTokens {
  accessToken: string;
  accessTokenSecret: string;
}

// Better Auth user payload extension
export interface HabuUser {
  id: string;
  email: string;
  name?: string;
  hatenaAccessToken?: string;
  hatenaAccessTokenSecret?: string;
}

// IndexedDB Queue types
export type QueueStatus = "queued" | "sending" | "done" | "error";

export interface BookmarkQueue {
  id?: number;
  url: string;
  title?: string;
  comment?: string;
  status: QueueStatus;
  createdAt: Date;
  updatedAt: Date;
  lastError?: string;
  nextRetryAt?: Date;
  retryCount: number;
  // AI-generated content (stored after successful bookmark creation)
  generatedComment?: string;
  generatedSummary?: string;
  generatedTags?: string[];
}

// API types
export interface BookmarkRequest {
  url: string;
  comment?: string;
}

export interface BookmarkResponse {
  success: boolean;
  error?: string;
  // Generated content (returned when AI generates summary/tags)
  generatedComment?: string;
  generatedSummary?: string;
  generatedTags?: string[];
}

// Suggest API types (generate without saving)
export interface SuggestRequest {
  url: string;
}

export interface PageMetadata {
  title?: string;
  description?: string;
  lang?: string;
  ogType?: string;
  siteName?: string;
  keywords?: string;
  author?: string;
}

export interface SuggestResponse {
  success: boolean;
  error?: string;
  summary?: string;
  tags?: string[];
  formattedComment?: string;
  // Raw content for preview
  markdown?: string;
  metadata?: PageMetadata;
}

// Hatena API types
export interface HatenaBookmarkApiResponse {
  url: string;
  comment?: string;
  tags?: string[];
  created?: string;
}

export interface HatenaTag {
  count: number;
  tag: string;
}

export interface HatenaTagsResponse {
  tags: HatenaTag[];
}
