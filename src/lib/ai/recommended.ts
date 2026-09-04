import type { Prisma } from "@prisma/client";
import { contains, prisma } from "@/lib/db";
import { geminiEnabled, geminiMinScore } from "./config";
import { analyzeJob, type AnalyzableJob } from "./analyze";
import { computePriorityScore } from "./priority";
import { JOB_CARD_SELECT } from "@/lib/jobs/list-select";
import { getCurrentUser } from "@/lib/auth";
import { getPreferences } from "@/lib/preferences";
import { passesInternationalFilter } from "@/lib/relevance/engine";

const RECOMMENDED_LIMIT = 12;
const ANALYZE_CAP = 6;

const INDIA_LOCATIONS_OR: Prisma.JobWhereInput[] = [
  { country: contains("India") },
  { city: contains("Bangalore") },
  { city: contains("Bengaluru") },
  { city: contains("Hyderabad") },
  { city: contains("Pune") },
  { city: contains("Mumbai") },
  { city: contains("Delhi") },
  { city: contains("Chennai") },
  { city: contains("Gurgaon") },
  { city: contains("Gurugram") },
  { city: contains("Noida") },
  { location: contains("India") },
  { AND: [{ remoteType: "remote" }, { location: contains("India") }] },
];

export async function getRecommendedJobs(limit = 16) {
  const take = Math.min(20, Math.max(8, limit));
  const user = await getCurrentUser();
  const prefs = await getPreferences(user && user.role !== "superadmin" ? user.id : null);

  const baseWhere: Prisma.JobWhereInput = {
    isActive: true,
    isRelevant: true,
    ...(!prefs.allowInternational ? { OR: INDIA_LOCATIONS_OR } : {}),
  };

  const analyzed = await prisma.job.findMany({
    where: { ...baseWhere, aiStatus: "ANALYZED" },
    select: JOB_CARD_SELECT,
    orderBy: [{ priorityScore: "desc" }, { aiFitScore: "desc" }, { postedAt: "desc" }],
    take: take * 2,
  });

  const filteredAnalyzed = analyzed.filter((job) =>
    passesInternationalFilter(job, prefs.allowInternational)
  );

  if (filteredAnalyzed.length >= take) return filteredAnalyzed.slice(0, take);

  const extra = await prisma.job.findMany({
    where: {
      ...baseWhere,
      id: { notIn: filteredAnalyzed.map((job) => job.id) },
    },
    select: JOB_CARD_SELECT,
    orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }],
    take: (take - filteredAnalyzed.length) * 2,
  });

  const filteredExtra = extra.filter((job) =>
    passesInternationalFilter(job, prefs.allowInternational)
  );

  return [...filteredAnalyzed, ...filteredExtra]
    .sort((a, b) => {
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
    })
    .slice(0, take);
}

export async function analyzeRecommendedJobs(limit = RECOMMENDED_LIMIT) {
  if (!geminiEnabled()) return { queued: 0, analyzed: 0 };
  const user = await getCurrentUser();
  const prefs = await getPreferences(user && user.role !== "superadmin" ? user.id : null);

  const candidates = await prisma.job.findMany({
    where: {
      isActive: true,
      isRelevant: true,
      relevanceScore: { gte: geminiMinScore() },
      ...(!prefs.allowInternational ? { OR: INDIA_LOCATIONS_OR } : {}),
      AND: [{ OR: [{ aiStatus: { not: "ANALYZED" } }, { aiFitScore: null }] }],
    },
    include: { company: { select: { name: true, priority: true } } },
    orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }],
    take: Math.min(ANALYZE_CAP, limit) * 2,
  });

  const filteredCandidates = candidates
    .filter((job) => passesInternationalFilter(job, prefs.allowInternational))
    .slice(0, Math.min(ANALYZE_CAP, limit));

  if (!filteredCandidates.length) return { queued: 0, analyzed: 0 };

  const results = await Promise.all(
    filteredCandidates.map((job) =>
      analyzeJob(job as AnalyzableJob, { persist: true, overrideThreshold: true }).catch(() => null)
    )
  );
  return {
    queued: filteredCandidates.length,
    analyzed: results.filter((row) => row && !row.error && (row.analysis || row.cacheHit)).length,
  };
}

