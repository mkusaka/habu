/**
 * Hatena Bookmark API body size limit utilities.
 *
 * The API has a ~1024 byte limit on URL-encoded POST body.
 * When exceeded, the body is truncated before OAuth signature verification,
 * causing a 401 Unauthorized error (signature mismatch).
 *
 * Body format: "url=<encoded_url>&comment=<encoded_comment>"
 */

/** Maximum body size accepted by Hatena Bookmark API */
export const HATENA_BODY_LIMIT = 1024;

/** Fixed overhead: "url=" (4 bytes) + "&comment=" (9 bytes) */
export const BODY_OVERHEAD = 13;

/** Calculate URL-encoded body size for a bookmark request */
export function calculateBodySize(url: string, comment: string): number {
  return BODY_OVERHEAD + encodeURIComponent(url).length + encodeURIComponent(comment).length;
}

/** Calculate max encoded comment length (bytes) for a given URL */
export function maxEncodedCommentLength(url: string): number {
  return HATENA_BODY_LIMIT - BODY_OVERHEAD - encodeURIComponent(url).length;
}

/** Check if bookmark body fits within Hatena's limit */
export function isBodyWithinLimit(url: string, comment: string): boolean {
  return calculateBodySize(url, comment) <= HATENA_BODY_LIMIT;
}

/** Calculate remaining bytes available for comment */
export function remainingCommentBytes(url: string, comment: string): number {
  return maxEncodedCommentLength(url) - encodeURIComponent(comment).length;
}
