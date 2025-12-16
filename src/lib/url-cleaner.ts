/**
 * URL Cleaner - removes tracking parameters and normalizes URLs
 */

// Known tracking parameters to remove
const TRACKING_PARAMS = new Set([
  // Google Analytics / Campaign
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "utm_creative_format",
  "utm_marketing_tactic",
  // Facebook
  "fbclid",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fb_ref",
  // Twitter/X
  "twclid",
  "s", // Twitter share param (e.g., ?s=20)
  "t", // Twitter t param
  // Google Ads
  "gclid",
  "gclsrc",
  "dclid",
  "gbraid",
  "wbraid",
  // Microsoft/Bing
  "msclkid",
  // Yahoo
  "yclid",
  // TikTok
  "ttclid",
  // LinkedIn
  "li_fat_id",
  // Mailchimp
  "mc_eid",
  "mc_cid",
  // HubSpot
  "_hsenc",
  "_hsmi",
  "__hstc",
  "__hsfp",
  "__hssc",
  "hsCtaTracking",
  // Marketo
  "mkt_tok",
  // Salesforce
  "sfmc_id",
  "sfmc_activityid",
  // Adobe
  "cid",
  "ecid",
  // Other common tracking
  "ref",
  "ref_",
  "source",
  "igshid", // Instagram
  "si", // Spotify/YouTube Music
  "_ga",
  "_gl",
  "zanpid",
  "irclickid",
  "affiliate_id",
  "aff_id",
  "partner_id",
  "click_id",
  // Japanese services
  "cxensepc", // Cxense (used by Japanese news sites)
  "cx_", // Cxense prefix
  "nr_email_referer",
  "_pjax", // PJAX navigation tracking
  // Generic tracking patterns
  "trk",
  "trkInfo",
  "originalReferer",
  "refId",
  "trackingId",
  "sc_channel",
  "sc_campaign",
  "sc_content",
  "sc_medium",
  "sc_outcome",
  "sc_geo",
  "sc_country",
]);

// Regex patterns for dynamic tracking params
const TRACKING_PARAM_PATTERNS = [
  /^utm_/i,
  /^fb_/i,
  /^_ga/i,
  /^_gl$/i,
  /^cx_/i,
  /^__hs/i,
  /^sfmc_/i,
  /^sc_/i,
  /^trk/i,
  /^ref[_-]?$/i,
];

/**
 * Check if a parameter name is a tracking parameter
 */
function isTrackingParam(param: string): boolean {
  const lowerParam = param.toLowerCase();

  // Check exact match
  if (TRACKING_PARAMS.has(lowerParam)) {
    return true;
  }

  // Check patterns
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(lowerParam));
}

/**
 * Clean a URL by removing tracking parameters
 * Returns the original URL if parsing fails
 */
export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Preserve hash
    const hash = parsed.hash;

    // Filter out tracking parameters
    const cleanParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams) {
      if (!isTrackingParam(key)) {
        cleanParams.append(key, value);
      }
    }

    // Rebuild URL
    parsed.search = cleanParams.toString();
    parsed.hash = hash;

    return parsed.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Normalize a canonical URL against the original URL
 * - If canonical is relative, resolve against original
 * - If canonical points to a different domain, ignore it (return original cleaned)
 * - Apply URL cleaning to canonical as well
 */
export function resolveCanonicalUrl(originalUrl: string, canonical: string | undefined): string {
  const cleanedOriginal = cleanUrl(originalUrl);

  if (!canonical) {
    return cleanedOriginal;
  }

  try {
    const originalParsed = new URL(cleanedOriginal);

    // Resolve relative canonical URLs
    const canonicalParsed = new URL(canonical, cleanedOriginal);

    // Only use canonical if it's on the same domain (or subdomain)
    // This prevents malicious pages from redirecting to unrelated sites
    const originalHost = originalParsed.hostname.replace(/^www\./, "");
    const canonicalHost = canonicalParsed.hostname.replace(/^www\./, "");

    if (originalHost !== canonicalHost) {
      // Different domain - ignore canonical, use cleaned original
      return cleanedOriginal;
    }

    // Clean the canonical URL too
    return cleanUrl(canonicalParsed.toString());
  } catch {
    // If canonical parsing fails, return cleaned original
    return cleanedOriginal;
  }
}
