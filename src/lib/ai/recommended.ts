import { prisma } from "@/lib/db";
import { geminiEnabled, geminiMinScore } from "./config";
import { analyzeJob, type AnalyzableJob } from "./analyze";
import { computePriorityScore } from "./priority";
import { JOB_CARD_SELECT } from "@/lib/jobs/list-select";

const RECOMMENDED_LIMIT = 12;
const ANALYZE_CAP = 6;

export async function getRecommendedJobs(limit = 16) {
  const take = Math.min(20, Math.max(8, limit));
  const analyzed = await prisma.job.findMany({
    where: { isActive: true, isRelevant: true, aiStatus: "ANALYZED" },
    select: JOB_CARD_SELECT,
    orderBy: [{ priorityScore: "desc" }, { aiFitScore: "desc" }, { postedAt: "desc" }],
    take,
  });
  if (analyzed.length >= take) return analyzed;

  const extra = await prisma.job.findMany({
    where: {
      isActive: true,
      isRelevant: true,
      id: { notIn: analyzed.map((job) => job.id) },
    },
    select: JOB_CARD_SELECT,
    orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }],
    take: take - analyzed.length,
  });

  return [...analyzed, ...extra].sort((a, b) => {
    const aScore =
      a.priorityScore ??
      computePriorityScore({
        aiFitScore: a.aiFitScore,
        relevanceScore: a.relevanceScore,
        postedAt: a.postedAt,
      });
    const bScore =
      b.priorityScore ??
      computePriorityScore({
        aiFitScore: b.aiFitScore,
        relevanceScore: b.relevanceScore,
        postedAt: b.postedAt,
      });
    const aAi = a.aiStatus === "ANALYZED" ? 1 : 0;
    const bAi = b.aiStatus === "ANALYZED" ? 1 : 0;
    if (bAi !== aAi) return bAi - aAi;
    return bScore - aScore;
  });
}

export async function analyzeRecommendedJobs(limit = RECOMMENDED_LIMIT) {
  if (!geminiEnabled()) return { queued: 0, analyzed: 0 };
  const candidates = await prisma.job.findMany({
    where: {
      isActive: true,
      isRelevant: true,
      relevanceScore: { gte: geminiMinScore() },
      OR: [{ aiStatus: { not: "ANALYZED" } }, { aiFitScore: null }],
    },
    include: { company: { select: { name: true, priority: true } } },
    orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }],
    take: Math.min(ANALYZE_CAP, limit),
  });
  if (!candidates.length) return { queued: 0, analyzed: 0 };

  const results = await Promise.all(
    candidates.map((job) =>
      analyzeJob(job as AnalyzableJob, { persist: true, overrideThreshold: true }).catch(() => null)
    )
  );
  return {
    queued: candidates.length,
    analyzed: results.filter((row) => row && !row.error && (row.analysis || row.cacheHit)).length,
  };
}
