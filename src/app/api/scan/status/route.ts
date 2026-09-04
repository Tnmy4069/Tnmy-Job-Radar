import { prisma } from "@/lib/db";
import { json } from "@/lib/api";
import { getCurrentRunId, isScanRunning } from "@/lib/scanner/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const [latest, companies, logs] = await Promise.all([
    prisma.scanRun.findFirst({ orderBy: { startedAt: "desc" } }),
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
        sourceType: true,
      },
    }),
    prisma.scanLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { company: { select: { name: true, slug: true } } },
    }),
  ]);

  const enabledTotal = await prisma.company.count({ where: { enabled: true } });

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
      idle: companies.filter((c) => c.checkStatus === "idle").length,
    },
  });
}
