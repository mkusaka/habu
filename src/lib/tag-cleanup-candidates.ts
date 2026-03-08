import type { HatenaTag, TagMappingAction, TagMappingCandidate } from "@/types/habu";

interface GeneratedTagMappingCandidate {
  sourceTag: string;
  action: TagMappingAction;
  targetTag?: string | null;
  reason: string;
}

export function normalizeCandidateAction(
  value: TagMappingAction,
  targetTag?: string | null,
): TagMappingAction {
  if (value === "update" && targetTag?.trim()) return value;
  return "delete";
}

export function materializeTagCleanupCandidates(
  generatedCandidates: GeneratedTagMappingCandidate[],
  tagInventory: HatenaTag[],
): TagMappingCandidate[] {
  const inventoryMap = new Map(tagInventory.map((tag) => [tag.tag.toLowerCase(), tag]));
  const usedSources = new Set<string>();
  const candidates: TagMappingCandidate[] = [];

  for (const item of generatedCandidates) {
    const sourceTag = item.sourceTag.trim();
    const sourceMeta = inventoryMap.get(sourceTag.toLowerCase());
    if (!sourceMeta) continue;

    const sourceKey = sourceTag.toLowerCase();
    if (usedSources.has(sourceKey)) continue;
    usedSources.add(sourceKey);

    const targetTag = item.targetTag?.trim();
    const action = normalizeCandidateAction(item.action, targetTag);
    const targetMeta = targetTag ? inventoryMap.get(targetTag.toLowerCase()) : undefined;

    candidates.push({
      sourceTag: sourceMeta.tag,
      action,
      targetTag: action === "update" ? targetTag : undefined,
      reason: item.reason,
      sourceCount: sourceMeta.count,
      targetCount: targetMeta?.count ?? 0,
      suggested: true,
    });
  }

  return candidates;
}
