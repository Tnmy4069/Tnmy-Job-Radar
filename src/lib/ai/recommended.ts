import { prisma } from "@/lib/db";
import { computePriorityScore } from "./priority";

export async function getRecommendedJobs(limit = 16) {
  const take = Math.min(20, Math.max(10, limit));
  const jobs = await prisma.job.findMany({
    where: { isActive: true, isRelevant: true },
    include: { company: true },
    orderBy: [{ relevanceScore: "desc" }, { postedAt: "desc" }],
    take: 80,
  });

  const ranked = jobs
    .map((job) => {
      const priorityScore =
        job.priorityScore ??
        computePriorityScore({
          aiFitScore: job.aiFitScore,
          relevanceScore: job.relevanceScore,
          postedAt: job.postedAt,
        });
      return { job, priorityScore };
    })
    .sort((a, b) => {
      const aAi = a.job.aiStatus === "ANALYZED" ? 1 : 0;
      const bAi = b.job.aiStatus === "ANALYZED" ? 1 : 0;
      if (bAi !== aAi) return bAi - aAi;
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      const aFit = a.job.aiFitScore ?? -1;
      const bFit = b.job.aiFitScore ?? -1;
      if (bFit !== aFit) return bFit - aFit;
      return b.job.relevanceScore - a.job.relevanceScore;
    });

  return ranked.slice(0, take).map((row) => row.job);
}
