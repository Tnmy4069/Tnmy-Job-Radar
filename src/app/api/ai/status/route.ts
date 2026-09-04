import { json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { geminiEnabled, geminiMinScore, geminiModel } from "@/lib/ai/config";
import { getAiMetrics } from "@/lib/ai/metrics";
import { getAiWorkerState } from "@/lib/ai/queue";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const [queued, processing, failed, analyzed, applyNow, strong, consider, low, skip] = await Promise.all([
    prisma.aiQueueItem.count({ where: { status: { in: ["QUEUED", "RETRY_WAIT"] } } }),
    prisma.aiQueueItem.count({ where: { status: "PROCESSING" } }),
    prisma.job.count({ where: { aiStatus: "FAILED" } }),
    prisma.job.count({ where: { aiStatus: "ANALYZED" } }),
    prisma.job.count({ where: { aiRecommendation: "APPLY_NOW" } }),
    prisma.job.count({ where: { aiRecommendation: "STRONG_MATCH" } }),
    prisma.job.count({ where: { aiRecommendation: "CONSIDER" } }),
    prisma.job.count({ where: { aiRecommendation: "LOW_PRIORITY" } }),
    prisma.job.count({ where: { aiRecommendation: "SKIP" } }),
  ]);

  const workers = getAiWorkerState();
  return json({
    enabled: geminiEnabled(),
    model: geminiModel(),
    minScore: geminiMinScore(),
    queue: queued,
    processing,
    analyzed,
    failed,
    recommendations: {
      APPLY_NOW: applyNow,
      STRONG_MATCH: strong,
      CONSIDER: consider,
      LOW_PRIORITY: low,
      SKIP: skip,
    },
    workers: {
      current: workers.activeWorkers,
      limit: workers.currentLimit,
      quotaPaused: workers.quotaPaused,
      circuit: workers.circuit,
    },
    metrics: getAiMetrics(),
  });
}
