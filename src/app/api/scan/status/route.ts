import { prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { getCurrentRunId, isScanRunning } from "@/lib/scanner/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const light = new URL(request.url).searchParams.get("light") === "1";
  const [latest, enabledTotal] = await Promise.all([
    prisma.scanRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        durationMs: true,
        companies: true,
        jobsFound: true,
        jobsNew: true,
        jobsRelevant: true,
        okCount: true,
        failedCount: true,
        unsupportedCount: true,
      },
    }),
    prisma.company.count({ where: { enabled: true } }),
  ]);

  if (light) {
    return json({
      running: isScanRunning(),
      runId: getCurrentRunId(),
      latest,
      companies: [],
      logs: [],
      summary: {
        enabledTotal,
        ok: latest?.okCount ?? 0,
        failed: latest?.failedCount ?? 0,
        unsupported: latest?.unsupportedCount ?? 0,
        blocked: 0,
        idle: 0,
      },
    });
  }

  const [companies, logs] = await Promise.all([
    prisma.company.findMany({
      where: { enabled: true },
      orderBy: { lastCheckedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        checkStatus: true,
        lastCheckedAt: true,
        lastError: true,
        lastBlockReason: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        failureCount: true,
        blockedCount: true,
        rateLimitCount: true,
        jobsFetched: true,
        jobsParsed: true,
        jobsRejected: true,
        averageLatencyMs: true,
        sourceType: true,
        sourceStatus: true,
        consecutiveFailures: true,
        sourceVerifiedAt: true,
        sourceNotes: true,
        priority: true,
      },
    }),
    prisma.scanLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { company: { select: { name: true, slug: true } } },
    }),
  ]);

  return json({
    running: isScanRunning(),
    runId: getCurrentRunId(),
    latest,
    companies,
    logs,
    summary: {
      enabledTotal,
      ok: companies.filter((c) => c.checkStatus === "ok").length,
      failed: companies.filter((c) => c.checkStatus === "failed").length,
      unsupported: companies.filter((c) => c.checkStatus === "unsupported").length,
      blocked: companies.filter((c) => c.checkStatus === "blocked").length,
      idle: companies.filter((c) => c.checkStatus === "idle").length,
    },
  });
}
