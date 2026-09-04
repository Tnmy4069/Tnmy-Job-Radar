import { prisma } from "../src/lib/db";
import { geminiMinScore, geminiModel } from "../src/lib/ai/config";

async function main() {
  const minScore = geminiMinScore();
  const [relevant, eligible, analyzed, failed, queued, applyNow, strong, consider, low, skip] = await Promise.all([
    prisma.job.count({ where: { isActive: true, isRelevant: true } }),
    prisma.job.count({ where: { isActive: true, isRelevant: true, relevanceScore: { gte: minScore } } }),
    prisma.job.count({ where: { aiStatus: "ANALYZED" } }),
    prisma.job.count({ where: { aiStatus: "FAILED" } }),
    prisma.aiQueueItem.count({ where: { status: { in: ["QUEUED", "PROCESSING", "RETRY_WAIT"] } } }),
    prisma.job.count({ where: { aiRecommendation: "APPLY_NOW" } }),
    prisma.job.count({ where: { aiRecommendation: "STRONG_MATCH" } }),
    prisma.job.count({ where: { aiRecommendation: "CONSIDER" } }),
    prisma.job.count({ where: { aiRecommendation: "LOW_PRIORITY" } }),
    prisma.job.count({ where: { aiRecommendation: "SKIP" } }),
  ]);

  const samples = await prisma.job.findMany({
    where: {
      OR: [
        { title: { contains: "Full Stack (AI/Agents)" } },
        { title: { contains: "Intermediate Backend Engineer, India" } },
        { title: { contains: "PXT Case Management" } },
        { title: { contains: "Workers Deploy" } },
        { title: { contains: "Senior Software Engineer" } },
        { title: { contains: "Intermediate Support Engineer" } },
        { title: { contains: "Applications Engineer 2" } },
      ],
    },
    include: { company: { select: { name: true } } },
    orderBy: { aiAnalyzedAt: "desc" },
    take: 20,
  });

  console.log(
    JSON.stringify(
      {
        model: geminiModel(),
        minScore,
        relevant,
        eligible,
        analyzed,
        failed,
        queued,
        recommendations: {
          APPLY_NOW: applyNow,
          STRONG_MATCH: strong,
          CONSIDER: consider,
          LOW_PRIORITY: low,
          SKIP: skip,
        },
        samples: samples.map((job) => ({
          company: job.company.name,
          title: job.title,
          rule: job.relevanceScore,
          ai: job.aiFitScore,
          rec: job.aiRecommendation,
          experience: job.aiExperienceFit,
          role: job.aiRoleFit,
          skill: job.aiSkillFit,
          gaps: job.aiGaps,
          summary: job.aiSummary,
          status: job.aiStatus,
        })),
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
