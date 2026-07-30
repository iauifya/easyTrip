import type {
  ConsensusSummary,
  ProposalReaction,
  ProposalReactionValue,
} from "@/types/collaboration";

export function summarizeConsensus(
  reactions: Pick<ProposalReaction, "value">[],
  activeMemberCount: number,
): ConsensusSummary {
  const counts: Record<ProposalReactionValue, number> = { must: 0, okay: 0, no: 0 };
  reactions.forEach(({ value }) => { counts[value] += 1; });
  const responses = counts.must + counts.okay + counts.no;

  let label: ConsensusSummary["label"] = "pending";
  if (responses >= activeMemberCount && counts.no > counts.must + counts.okay) label = "skip";
  else if (responses >= activeMemberCount && counts.no > 0) label = "conflict";
  else if (responses >= activeMemberCount && counts.no === 0) label = "popular";

  return { label, ...counts, responses };
}

export function getMustQuotaState(
  reactions: Pick<ProposalReaction, "userId" | "value">[],
  userId: string,
  enabled: boolean,
  limit: number,
) {
  const used = reactions.filter((item) => item.userId === userId && item.value === "must").length;
  return {
    used,
    remaining: enabled ? Math.max(0, limit - used) : Number.POSITIVE_INFINITY,
    isOver: enabled && used > limit,
    canAddMust: !enabled || used < limit,
  };
}
