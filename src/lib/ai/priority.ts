import { daysAgo } from "@/lib/utils";
import { priorityWeights } from "./config";

/** Freshness uses postedAt only. Missing postedAt does not invent recency. */
export function freshnessScore(postedAt: Date | string | null | undefined): number {
  const days = daysAgo(postedAt);
  if (days == null) return 0;
  if (days <= 1) return 100;
  if (days <= 3) return 90;
  if (days <= 7) return 75;
  if (days <= 14) return 55;
  if (days <= 30) return 30;
  return 10;
}

export function computePriorityScore(input: {
  aiFitScore: number | null | undefined;
  relevanceScore: number;
  postedAt: Date | string | null | undefined;
}): number {
  const weights = priorityWeights();
  const rule = clampScore(input.relevanceScore);
  const freshness = freshnessScore(input.postedAt);
  if (input.aiFitScore == null) {
    const remaining = weights.rule + weights.freshness;
    if (remaining <= 0) return rule;
    return round1((weights.rule / remaining) * rule + (weights.freshness / remaining) * freshness);
  }
  return round1(weights.ai * clampScore(input.aiFitScore) + weights.rule * rule + weights.freshness * freshness);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function recommendationLabel(recommendation: string | null | undefined): string {
  switch (recommendation) {
    case "APPLY_NOW":
      return "Apply Now";
    case "STRONG_MATCH":
      return "Strong match";
    case "CONSIDER":
      return "Consider";
    case "LOW_PRIORITY":
      return "Low priority";
    case "SKIP":
      return "Skip";
    default:
      return "";
  }
}

export function recommendationGlyph(recommendation: string | null | undefined): string {
  switch (recommendation) {
    case "APPLY_NOW":
      return "🔥";
    case "STRONG_MATCH":
      return "✨";
    case "CONSIDER":
      return "🟡";
    case "LOW_PRIORITY":
      return "○";
    case "SKIP":
      return "–";
    default:
      return "";
  }
}
