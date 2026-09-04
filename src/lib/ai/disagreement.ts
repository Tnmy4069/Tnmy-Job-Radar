export type AiDisagreementFlag = "REVIEW_RULE_ENGINE" | "POSSIBLE_FALSE_NEGATIVE" | null;

export function scoreDifference(aiFitScore: number, relevanceScore: number): number {
  return aiFitScore - relevanceScore;
}

export function disagreementFlag(aiFitScore: number | null | undefined, relevanceScore: number): AiDisagreementFlag {
  if (aiFitScore == null) return null;
  const diff = scoreDifference(aiFitScore, relevanceScore);
  if (Math.abs(diff) < 20) return null;
  if (diff <= -20) return "REVIEW_RULE_ENGINE";
  return "POSSIBLE_FALSE_NEGATIVE";
}
