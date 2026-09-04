import { prisma } from "@/lib/db";
import { json, notFound } from "@/lib/api";
import { analysisFromJob, analyzeJob, cachedAnalysisValid, jobAnalysisHash, type AnalyzableJob } from "@/lib/ai/analyze";
import { serializeJobAi } from "@/lib/ai/dto";
import { enqueueJob, kickAiWorkers } from "@/lib/ai/queue";
import { geminiEnabled } from "@/lib/ai/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { force?: boolean; queue?: boolean };
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { company: { select: { name: true, priority: true } } },
  });
  if (!job) return notFound("Job not found");

  const hash = jobAnalysisHash(job as AnalyzableJob);
  if (!body.force && cachedAnalysisValid(job as AnalyzableJob, hash)) {
    return json({
      ok: true,
      cacheHit: true,
      analysis: analysisFromJob(job),
      meta: serializeJobAi(job),
    });
  }

  if (body.queue) {
    await enqueueJob(job as AnalyzableJob, "MANUAL", { force: Boolean(body.force) });
    kickAiWorkers();
    return json({ ok: true, queued: true, cacheHit: false });
  }

  const outcome = await analyzeJob(job as AnalyzableJob, {
    force: Boolean(body.force),
    overrideThreshold: true,
  });
  const latest = await prisma.job.findUnique({ where: { id: jobId } });
  return json({
    ok: !outcome.error,
    cacheHit: outcome.cacheHit,
    skipped: outcome.skipped,
    error: outcome.error,
    enabled: geminiEnabled(),
    analysis: outcome.analysis ?? (latest ? analysisFromJob(latest) : null),
    meta: latest ? serializeJobAi(latest) : null,
  });
}
