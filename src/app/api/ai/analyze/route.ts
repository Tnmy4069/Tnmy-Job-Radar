import { prisma } from "@/lib/db";
import { badRequest, json } from "@/lib/api";
import { analysisFromJob, analyzeJob, type AnalyzableJob } from "@/lib/ai/analyze";
import { batchRequestCap, geminiEnabled } from "@/lib/ai/config";
import { serializeJobAi } from "@/lib/ai/dto";
import { enqueueJob, kickAiWorkers } from "@/lib/ai/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    jobIds?: unknown;
    force?: boolean;
  };
  const jobIds = Array.isArray(body.jobIds)
    ? [...new Set(body.jobIds.map((id) => String(id)).filter(Boolean))]
    : [];
  if (!jobIds.length) return badRequest("jobIds required");
  if (jobIds.length > batchRequestCap()) {
    return badRequest(`Batch limited to ${batchRequestCap()} jobs`);
  }

  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    include: { company: { select: { name: true, priority: true } } },
  });
  const found = new Map(jobs.map((job) => [job.id, job]));
  const results = [];

  for (const id of jobIds) {
    const job = found.get(id);
    if (!job) {
      results.push({ jobId: id, error: "not found" });
      continue;
    }
    const outcome = await analyzeJob(job as AnalyzableJob, {
      force: Boolean(body.force),
      overrideThreshold: true,
    });
    const latest = await prisma.job.findUnique({ where: { id } });
    results.push({
      jobId: id,
      cacheHit: outcome.cacheHit,
      skipped: outcome.skipped,
      error: outcome.error,
      enabled: geminiEnabled(),
      analysis: outcome.analysis ?? (latest ? analysisFromJob(latest) : null),
      meta: latest ? serializeJobAi(latest) : null,
    });
  }

  return json({ ok: true, results });
}

export async function PUT() {
  if (!geminiEnabled()) return json({ ok: false, message: "Gemini disabled" }, 503);
  const { enqueueEligibleJobs } = await import("@/lib/ai/queue");
  const queued = await enqueueEligibleJobs();
  kickAiWorkers();
  return json({ ok: true, ...queued });
}
