export type TagFilterInput = string | readonly string[] | undefined;

export function normalizeTagFilters(input: TagFilterInput): string[] {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function appendTagFilters(params: URLSearchParams, tags: readonly string[]) {
  for (const tag of normalizeTagFilters(tags)) {
    params.append("tag", tag);
  }
}
