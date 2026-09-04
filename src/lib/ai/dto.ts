import { parseJsonArray } from "@/lib/utils";
import { disagreementFlag } from "@/lib/ai/disagreement";
import { computePriorityScore, freshnessScore } from "@/lib/ai/priority";
import type { JobAnalysis } from "@/lib/ai/schema";

export type JobAiDTO = {
  aiFitScore: number | null;
  aiRecommendation: string | null;
  aiSummary: string | null;
  aiStrengths: string[];
  aiGaps: string[];
  aiConcerns: string[];
  aiReasoning: string | null;
  aiExperienceFit: string | null;
  aiSkillFit: string | null;
  aiRoleFit: string | null;
  aiLocationFit: string | null;
  aiRequiredSkillsMatched: string[];
  aiRequiredSkillsMissing: string[];
  aiPreferredSkillsMatched: string[];
  aiPreferredSkillsMissing: string[];
  aiSeniority: string | null;
  aiIsEarlyCareer: boolean | null;
  aiRequiresSignificantExperience: boolean | null;
  aiStatus: string;
  aiAnalyzedAt: string | null;
  aiModel: string | null;
  priorityScore: number;
  freshnessScore: number;
  scoreDifference: number | null;
  disagreement: ReturnType<typeof disagreementFlag>;
};

export function serializeJobAi(job: {
  relevanceScore: number;
  postedAt: Date | null;
  aiFitScore?: number | null;
  aiRecommendation?: string | null;
  aiSummary?: string | null;
  aiStrengths?: string | null;
  aiGaps?: string | null;
  aiConcerns?: string | null;
  aiReasoning?: string | null;
  aiExperienceFit?: string | null;
  aiSkillFit?: string | null;
  aiRoleFit?: string | null;
  aiLocationFit?: string | null;
  aiRequiredSkillsMatched?: string | null;
  aiRequiredSkillsMissing?: string | null;
  aiPreferredSkillsMatched?: string | null;
  aiPreferredSkillsMissing?: string | null;
  aiSeniority?: string | null;
  aiIsEarlyCareer?: boolean | null;
  aiRequiresSignificantExperience?: boolean | null;
  aiStatus?: string | null;
  aiAnalyzedAt?: Date | null;
  aiModel?: string | null;
  priorityScore?: number | null;
}): JobAiDTO {
  const priorityScore =
    job.priorityScore ??
    computePriorityScore({
      aiFitScore: job.aiFitScore,
      relevanceScore: job.relevanceScore,
      postedAt: job.postedAt,
    });
  return {
    aiFitScore: job.aiFitScore ?? null,
    aiRecommendation: job.aiRecommendation ?? null,
    aiSummary: job.aiSummary ?? null,
    aiStrengths: parseJsonArray(job.aiStrengths),
    aiGaps: parseJsonArray(job.aiGaps),
    aiConcerns: parseJsonArray(job.aiConcerns),
    aiReasoning: job.aiReasoning ?? null,
    aiExperienceFit: job.aiExperienceFit ?? null,
    aiSkillFit: job.aiSkillFit ?? null,
    aiRoleFit: job.aiRoleFit ?? null,
    aiLocationFit: job.aiLocationFit ?? null,
    aiRequiredSkillsMatched: parseJsonArray(job.aiRequiredSkillsMatched),
    aiRequiredSkillsMissing: parseJsonArray(job.aiRequiredSkillsMissing),
    aiPreferredSkillsMatched: parseJsonArray(job.aiPreferredSkillsMatched),
    aiPreferredSkillsMissing: parseJsonArray(job.aiPreferredSkillsMissing),
    aiSeniority: job.aiSeniority ?? null,
    aiIsEarlyCareer: job.aiIsEarlyCareer ?? null,
    aiRequiresSignificantExperience: job.aiRequiresSignificantExperience ?? null,
    aiStatus: job.aiStatus ?? "NOT_ANALYZED",
    aiAnalyzedAt: job.aiAnalyzedAt ? job.aiAnalyzedAt.toISOString() : null,
    aiModel: job.aiModel ?? null,
    priorityScore,
    freshnessScore: freshnessScore(job.postedAt),
    scoreDifference: job.aiFitScore == null ? null : job.aiFitScore - job.relevanceScore,
    disagreement: disagreementFlag(job.aiFitScore, job.relevanceScore),
  };
}

export function analysisFromJob(job: {
  aiFitScore?: number | null;
  aiRecommendation?: string | null;
  aiSummary?: string | null;
  aiStrengths?: string | null;
  aiGaps?: string | null;
  aiConcerns?: string | null;
  aiReasoning?: string | null;
  aiExperienceFit?: string | null;
  aiSkillFit?: string | null;
  aiRoleFit?: string | null;
  aiLocationFit?: string | null;
  aiRequiredSkillsMatched?: string | null;
  aiRequiredSkillsMissing?: string | null;
  aiPreferredSkillsMatched?: string | null;
  aiPreferredSkillsMissing?: string | null;
  aiSeniority?: string | null;
  aiIsEarlyCareer?: boolean | null;
  aiRequiresSignificantExperience?: boolean | null;
}): JobAnalysis | null {
  if (job.aiFitScore == null || !job.aiRecommendation || !job.aiSummary || !job.aiReasoning) return null;
  return {
    fitScore: job.aiFitScore,
    recommendation: job.aiRecommendation as JobAnalysis["recommendation"],
    summary: job.aiSummary,
    strengths: parseJsonArray(job.aiStrengths),
    gaps: parseJsonArray(job.aiGaps),
    concerns: parseJsonArray(job.aiConcerns),
    reasoning: job.aiReasoning,
    experienceFit: (job.aiExperienceFit ?? "unknown") as JobAnalysis["experienceFit"],
    skillFit: (job.aiSkillFit ?? "unknown") as JobAnalysis["skillFit"],
    roleFit: (job.aiRoleFit ?? "unknown") as JobAnalysis["roleFit"],
    locationFit: (job.aiLocationFit ?? "unknown") as JobAnalysis["locationFit"],
    isEarlyCareer: Boolean(job.aiIsEarlyCareer),
    requiresSignificantExperience: Boolean(job.aiRequiresSignificantExperience),
    requiredSkillsMatched: parseJsonArray(job.aiRequiredSkillsMatched),
    requiredSkillsMissing: parseJsonArray(job.aiRequiredSkillsMissing),
    preferredSkillsMatched: parseJsonArray(job.aiPreferredSkillsMatched),
    preferredSkillsMissing: parseJsonArray(job.aiPreferredSkillsMissing),
    seniority: (job.aiSeniority ?? "unknown") as JobAnalysis["seniority"],
  };
}
