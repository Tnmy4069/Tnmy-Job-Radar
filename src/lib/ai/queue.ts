import { prisma } from "@/lib/db";
import {
  geminiBatchSize,
  geminiEnabled,
  geminiInitialConcurrency,
  geminiMaxConcurrency,
  geminiMinScore,
} from "./config";
import {
  analyzeJob,
  analyzeJobBatch,
  cachedAnalysisValid,
  isEligibleForAutoAnalysis,
  jobAnalysisHash,
  type AnalyzableJob,
} from "./analyze";
import { classifyGeminiError, backoffMs } from "./errors";
import { getAiMetrics, setAiConcurrency, setAiQueueLength, setQuotaExhausted } from "./metrics";
import { canDispatchAiRequest, getCircuitState } from "./circuit";
import { queuePriorityRank, type QueuePriority } from "./schema";
import { computePriorityScore, freshnessScore } from "./priority";

const jobSelect = {
  id: true,
  title: true,
  description: true,
  location: true,
  employmentType: true,
  skills: true,
  postedAt: true,
  relevanceScore: true,
  matchReasons: true,
  isActive: true,
  isRelevant: true,
  aiStatus: true,
  aiAnalysisHash: true,
  aiFitScore: true,
  company: { select: { name: true, priority: true } },
} as const;

let currentLimit = geminiInitialConcurrency();
let activeWorkers = 0;
let kicking = false;
let quotaPaused = false;

export function getAiWorkerState() {
  return {
    currentLimit,
    activeWorkers,
    quotaPaused,
    circuit: getCircuitState(),
    metrics: getAiMetrics(),
  };
}

export function resetAiWorkersForTests() {
  currentLimit = geminiInitialConcurrency();
  activeWorkers = 0;
  kicking = false;
  quotaPaused = false;
  setQuotaExhausted(false);
}

function companyPriorityRank(priority: string | null | undefined): number {
  if (priority === "A") return 0;
  if (priority === "B") return 1;
  if (priority === "C") return 2;
  return 3;
}

function sortEligible(jobs: AnalyzableJob[]): AnalyzableJob[] {
  return [...jobs].sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    const fresh = freshnessScore(b.postedAt) - freshnessScore(a.postedAt);
    if (fresh) return fresh;
    const pri = companyPriorityRank(a.company.priority) - companyPriorityRank(b.company.priority);
    if (pri) return pri;
    const aPosted = a.postedAt?.getTime() ?? 0;
    const bPosted = b.postedAt?.getTime() ?? 0;
    return bPosted - aPosted;
  });
}

export async function enqueueJob(
  job: AnalyzableJob,
  priority: QueuePriority = "NORMAL",
  options: { force?: boolean } = {}
) {
  const hash = jobAnalysisHash(job);
  if (!options.force && cachedAnalysisValid(job, hash)) return { queued: false, cacheHit: true, hash };

  const rank = queuePriorityRank(priority);
  const existing = await prisma.aiQueueItem.findFirst({
    where: { jobId: job.id, status: { in: ["QUEUED", "PROCESSING", "RETRY_WAIT"] } },
  });
  if (existing) {
    if (existing.analysisHash === hash && existing.priorityRank <= rank && !options.force) {
      return { queued: false, cacheHit: false, hash, id: existing.id };
    }
    await prisma.aiQueueItem.update({
      where: { id: existing.id },
      data: {
        analysisHash: hash,
        priority,
        priorityRank: Math.min(existing.priorityRank, rank),
        status: existing.status === "PROCESSING" ? existing.status : "QUEUED",
        nextAttemptAt: null,
      },
    });
    return { queued: true, cacheHit: false, hash, id: existing.id };
  }

  const created = await prisma.aiQueueItem.create({
    data: {
      jobId: job.id,
      status: "QUEUED",
      priority,
      priorityRank: rank,
      analysisHash: hash,
    },
  });
  await prisma.job.update({
    where: { id: job.id },
    data: { aiStatus: job.aiStatus === "ANALYZED" && !options.force ? job.aiStatus : "QUEUED" },
  });
  return { queued: true, cacheHit: false, hash, id: created.id };
}

export async function enqueueEligibleJobs(limit = 400) {
  if (!geminiEnabled()) return { queued: 0, cacheHits: 0, skipped: 0 };

  const minScore = geminiMinScore();
  const rows = await prisma.job.findMany({
    where: {
      isActive: true,
      isRelevant: true,
      relevanceScore: { gte: minScore },
    },
    include: { company: { select: { name: true, priority: true } } },
    take: Math.max(limit, 50),
  });

  const eligible = sortEligible(rows as AnalyzableJob[]).filter((job) => isEligibleForAutoAnalysis(job, minScore));
  const seen = new Set<string>();
  let queued = 0;
  let cacheHits = 0;
  let skipped = 0;

  for (const job of eligible) {
    const hash = jobAnalysisHash(job);
    const key = `${job.id}:${hash}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    if (cachedAnalysisValid(job, hash)) {
      cacheHits += 1;
      continue;
    }
    const result = await enqueueJob(job, "NORMAL");
    if (result.cacheHit) cacheHits += 1;
    else if (result.queued) queued += 1;
    else skipped += 1;
  }

  await refreshQueueLength();
  return { queued, cacheHits, skipped, eligible: eligible.length };
}

export async function analyzeTopRelevantJobs() {
  const enqueued = await enqueueEligibleJobs();
  kickAiWorkers();
  return enqueued;
}

export function kickAiWorkers() {
  if (!geminiEnabled() || quotaPaused) return;
  if (kicking) {
    spawnWorkers();
    return;
  }
  kicking = true;
  spawnWorkers();
}

function spawnWorkers() {
  const max = geminiMaxConcurrency();
  currentLimit = Math.min(Math.max(currentLimit, 1), max);
  setAiConcurrency(currentLimit);
  while (activeWorkers < currentLimit && activeWorkers < max) {
    activeWorkers += 1;
    void runWorker().finally(() => {
      activeWorkers -= 1;
      if (activeWorkers === 0) kicking = false;
    });
  }
}

async function runWorker() {
  while (!quotaPaused && canDispatchAiRequest()) {
    if (activeWorkers > currentLimit) break;
    const item = await claimNext();
    if (!item) break;
    await processQueueItem(item);
  }
}

async function claimNext() {
  const now = new Date();
  const item = await prisma.aiQueueItem.findFirst({
    where: {
      OR: [{ status: "QUEUED" }, { status: "RETRY_WAIT", nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ priorityRank: "asc" }, { createdAt: "asc" }],
  });
  if (!item) return null;
  const claimed = await prisma.aiQueueItem.updateMany({
    where: { id: item.id, status: { in: ["QUEUED", "RETRY_WAIT"] } },
    data: { status: "PROCESSING", updatedAt: now },
  });
  if (claimed.count !== 1) return null;
  return item;
}

async function processQueueItem(item: { id: string; jobId: string; attemptCount: number; analysisHash: string }) {
  const job = await prisma.job.findUnique({
    where: { id: item.jobId },
    include: { company: { select: { name: true, priority: true } } },
  });
  if (!job) {
    await prisma.aiQueueItem.update({
      where: { id: item.id },
      data: { status: "FAILED", lastError: "Job missing" },
    });
    return;
  }

  const hash = jobAnalysisHash(job as AnalyzableJob);
  if (cachedAnalysisValid(job as AnalyzableJob, hash)) {
    await prisma.aiQueueItem.update({
      where: { id: item.id },
      data: { status: "COMPLETED", lastError: null },
    });
    return;
  }

  try {
    const batchSize = geminiBatchSize();
    if (batchSize > 1 && item.attemptCount === 0) {
      const extras = await claimBatchCompanions(item.jobId, batchSize - 1);
      if (extras.length) {
        const jobs = [job as AnalyzableJob];
        const extraJobs: AnalyzableJob[] = [];
        for (const extra of extras) {
          const row = await prisma.job.findUnique({
            where: { id: extra.jobId },
            include: { company: { select: { name: true, priority: true } } },
          });
          if (row) extraJobs.push(row as AnalyzableJob);
        }
        const outcomes = await analyzeJobBatch(jobs.concat(extraJobs), { persist: true });
        await completeBatch([item, ...extras], outcomes);
        onSuccess();
        return;
      }
    }

    const outcome = await analyzeJob(job as AnalyzableJob, { persist: true });
    await prisma.aiQueueItem.update({
      where: { id: item.id },
      data: {
        status: outcome.error ? "FAILED" : "COMPLETED",
        lastError: outcome.error ?? null,
        attemptCount: item.attemptCount + 1,
      },
    });
    if (outcome.error) onFailure(false);
    else onSuccess();
  } catch (error) {
    const classified = classifyGeminiError(error);
    if (classified.quotaExhausted) {
      quotaPaused = true;
      setQuotaExhausted(true);
      await prisma.aiQueueItem.update({
        where: { id: item.id },
        data: {
          status: "RETRY_WAIT",
          lastError: "quota exhausted",
          nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      return;
    }
    if (classified.kind === "rate_limit") on429();
    else onFailure(classified.transient);

    const retry = classified.transient && item.attemptCount < 6;
    await prisma.aiQueueItem.update({
      where: { id: item.id },
      data: retry
        ? {
            status: "RETRY_WAIT",
            attemptCount: item.attemptCount + 1,
            lastError: classified.message.slice(0, 400),
            nextAttemptAt: new Date(Date.now() + backoffMs(item.attemptCount, classified.retryAfterMs)),
          }
        : {
            status: "FAILED",
            attemptCount: item.attemptCount + 1,
            lastError: classified.message.slice(0, 400),
          },
    });
    if (!retry) {
      await prisma.job.update({
        where: { id: item.jobId },
        data: { aiStatus: "FAILED", aiError: classified.message.slice(0, 400) },
      });
    }
  } finally {
    await refreshQueueLength();
  }
}

async function claimBatchCompanions(excludeJobId: string, count: number) {
  if (count <= 0) return [];
  const rows = await prisma.aiQueueItem.findMany({
    where: {
      jobId: { not: excludeJobId },
      status: "QUEUED",
      priority: { in: ["NORMAL", "LOW", "HIGH"] },
    },
    orderBy: [{ priorityRank: "asc" }, { createdAt: "asc" }],
    take: count,
  });
  const claimed = [];
  for (const row of rows) {
    const result = await prisma.aiQueueItem.updateMany({
      where: { id: row.id, status: "QUEUED" },
      data: { status: "PROCESSING" },
    });
    if (result.count === 1) claimed.push(row);
  }
  return claimed;
}

async function completeBatch(
  items: Array<{ id: string; jobId: string }>,
  outcomes: Array<{ jobId: string; error?: string }>
) {
  const byId = new Map(outcomes.map((row) => [row.jobId, row]));
  for (const item of items) {
    const outcome = byId.get(item.jobId);
    await prisma.aiQueueItem.update({
      where: { id: item.id },
      data: {
        status: outcome?.error ? "FAILED" : "COMPLETED",
        lastError: outcome?.error ?? null,
      },
    });
  }
}

function onSuccess() {
  currentLimit = Math.min(geminiMaxConcurrency(), currentLimit + 1);
  setAiConcurrency(currentLimit);
  spawnWorkers();
}

function on429() {
  currentLimit = Math.max(1, Math.floor(currentLimit * 0.7) || currentLimit - 1);
  setAiConcurrency(currentLimit);
}

function onFailure(transient: boolean) {
  if (transient) {
    currentLimit = Math.max(1, currentLimit - 1);
    setAiConcurrency(currentLimit);
  }
}

async function refreshQueueLength() {
  const count = await prisma.aiQueueItem.count({
    where: { status: { in: ["QUEUED", "RETRY_WAIT", "PROCESSING"] } },
  });
  setAiQueueLength(count);
}

export async function resumeAiQueue() {
  quotaPaused = false;
  setQuotaExhausted(false);
  await prisma.aiQueueItem.updateMany({
    where: { status: "RETRY_WAIT" },
    data: { status: "QUEUED", nextAttemptAt: null },
  });
  kickAiWorkers();
}

export { computePriorityScore };
