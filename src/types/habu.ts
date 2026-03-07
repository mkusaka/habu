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
  // Skip AI generation even when no comment is provided
  skipAiGeneration?: boolean;
  // User-provided context for AI generation (e.g., page content, supplementary info)
  userContext?: string;
}

// API types
export interface BookmarkRequest {
  url: string;
  comment?: string;
  /** User-provided context for AI generation (e.g., page content, supplementary info) */
  userContext?: string;
  /** Skip AI generation even when no comment is provided */
  skipAiGeneration?: boolean;
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
  /** User-provided context for AI generation (e.g., page content, supplementary info) */
  userContext?: string;
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
  markdownError?: string;
  metadata?: PageMetadata;
  webContext?: string;
  // Body size info for Hatena API limit validation
  bodySize?: number;
  exceedsLimit?: boolean;
}

export interface HatenaTagsListResponse {
  success: boolean;
  error?: string;
  tags?: HatenaTag[];
  hatenaId?: string;
  missingWritePrivate?: boolean;
}

export interface TagCleanupBookmark {
  url: string;
  title: string;
  commentText: string;
  currentTags: string[];
  nextTags: string[];
  isPrivate: boolean;
  bookmarkedAt?: string;
  matchedSourceTags?: string[];
}

export type TagMappingAction = "update" | "delete" | "no_change";

export interface TagMappingCandidate {
  sourceTag: string;
  action: TagMappingAction;
  targetTag?: string;
  reason?: string;
  sourceCount?: number;
  targetCount?: number;
  suggested?: boolean;
}

export interface TagCleanupRequest {
  mode: "preview" | "apply";
  mappings: TagMappingCandidate[];
}

export interface TagCleanupCandidatesResponse {
  success: boolean;
  error?: string;
  candidates?: TagMappingCandidate[];
  missingWritePrivate?: boolean;
}

export interface TagCleanupFailure {
  url: string;
  title: string;
  error: string;
}

export interface TagCleanupResponse {
  success: boolean;
  error?: string;
  mappings?: TagMappingCandidate[];
  totalMatched?: number;
  preview?: TagCleanupBookmark[];
  updatedCount?: number;
  failed?: TagCleanupFailure[];
  missingWritePrivate?: boolean;
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
