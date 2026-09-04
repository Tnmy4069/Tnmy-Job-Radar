import { getAdapter, toCompanySource } from "@/lib/adapters/registry";
import { UnsupportedSourceError } from "@/lib/adapters/types";
import { companyScanTimeoutMs } from "@/lib/discovery/config";
import { DeadlineError, withDeadline } from "@/lib/discovery/deadline";
import { mergeDescription } from "@/lib/discovery/description";
import { prisma } from "@/lib/db";
import { buildSearchText, jobFingerprint } from "@/lib/hash";
import { HttpError, SourceBlockError } from "@/lib/http";
import { normalizeLocation } from "@/lib/location";
import { getPreferences } from "@/lib/preferences";
import { scoreJob } from "@/lib/relevance/engine";
import { sanitizeJobHtml } from "@/lib/sanitize";
import { scheduleAiAfterScan } from "@/lib/ai/scan-hook";

type ScanTrigger = "manual" | "scheduled" | "cron";

const MISSING_SCAN_THRESHOLD = 3;
const CONCURRENCY = Math.min(3, Math.max(1, Number(process.env.SCAN_CONCURRENCY ?? 2) || 2));

let running = false;
let currentRunId: string | null = null;

export function isScanRunning() {
  return running;
}

export function getCurrentRunId() {
  return currentRunId;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(workers);
  return results;
}

export async function startScan(trigger: ScanTrigger = "manual", companySlug?: string) {
  if (running) {
    return { ok: false as const, message: "Scan already in progress", running: true };
  }

  running = true;
  const run = await prisma.scanRun.create({
    data: { trigger, status: "running" },
  });
  currentRunId = run.id;

  void runScanBody(run.id, trigger, companySlug).catch((error) => {
    console.error("[scan]", error);
  });

  return { ok: true as const, runId: run.id, running: true };
}

/** Blocking scan used by CLI scripts. */
export async function runScan(trigger: ScanTrigger = "manual", companySlug?: string) {
  if (running) {
    return { ok: false, message: "A scan is already running" };
  }

  running = true;
  const run = await prisma.scanRun.create({
    data: { trigger, status: "running" },
  });
  currentRunId = run.id;

  try {
    return await runScanBody(run.id, trigger, companySlug);
  } finally {
    running = false;
    currentRunId = null;
  }
}

async function runScanBody(runId: string, _trigger: ScanTrigger, companySlug?: string) {
  const started = Date.now();
  let jobsFound = 0;
  let jobsNew = 0;
  let jobsUpdated = 0;
  let jobsSkipped = 0;
  let jobsInactive = 0;
  let jobsRelevant = 0;
  let okCount = 0;
  let failedCount = 0;
  let unsupportedCount = 0;
  let errors = 0;

  try {
    const prefs = await getPreferences();
    const companies = await prisma.company.findMany({
      where: companySlug
        ? { slug: companySlug, enabled: true, sourceStatus: { notIn: ["UNSUPPORTED", "DISABLED"] } }
        : { enabled: true, sourceStatus: { notIn: ["UNSUPPORTED", "DISABLED"] } },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    });

    await mapPool(companies, CONCURRENCY, async (company) => {
      const companyStarted = Date.now();
      let fetched = 0;
      let normalized = 0;
      let relevant = 0;
      let newJobs = 0;
      let updatedJobs = 0;

      try {
        const adapter = getAdapter(company.sourceType);
        const source = toCompanySource(company);
        const result = await withDeadline(
          companyScanTimeoutMs(),
          () => adapter.fetchJobs(source),
          `Company scan timed out: ${company.slug}`
        );
        const now = new Date();

        if (result.detectedSourceType && result.detectedSourceType !== company.sourceType) {
          let config: Record<string, unknown> = {};
          try {
            config = JSON.parse(company.sourceConfig || "{}") as Record<string, unknown>;
          } catch {
            config = {};
          }
          await prisma.company.update({
            where: { id: company.id },
            data: {
              sourceType: result.detectedSourceType,
              sourceConfig: JSON.stringify({ ...config, ...(result.detectedSourceConfig ?? {}) }),
            },
          });
        }

        if (result.blockReason) {
          await prisma.company.update({
            where: { id: company.id },
            data: {
              lastCheckedAt: now,
              checkStatus: "blocked",
              lastError: result.warning ?? result.blockReason,
              lastBlockReason: result.blockReason,
              lastFailureAt: now,
              blockedCount: { increment: 1 },
              rateLimitCount: result.blockReason === "RATE_LIMITED" ? { increment: 1 } : undefined,
              consecutiveFailures: { increment: 1 },
            },
          });
          await prisma.scanLog.create({
            data: {
              runId,
              companyId: company.id,
              level: "error",
              status: "blocked",
              durationMs: Date.now() - companyStarted,
              fetched: 0,
              blockReason: result.blockReason,
              message: result.warning ?? result.blockReason,
            },
          });
          return;
        }

        const hashes = new Set<string>();
        const incoming = limitJobs(result.jobs);
        fetched = result.jobs.length;
        normalized = incoming.length;

        for (const job of incoming) {
          const loc = normalizeLocation(job.location, job.country);
          const hash = jobFingerprint({
            company: company.slug,
            title: job.title,
            location: loc.location,
            city: loc.city,
            applicationUrl: job.applicationUrl,
            externalId: job.externalId,
          });
          hashes.add(hash);

          const scored = scoreJob(
            {
              ...job,
              location: loc.location,
              country: loc.country,
            },
            prefs
          );
          const existing = await prisma.job.findUnique({ where: { hash } });
          const description = mergeDescription(
            sanitizeJobHtml(job.description || ""),
            existing?.description ?? ""
          );
          const searchText = buildSearchText({
            title: job.title,
            company: company.name,
            city: loc.city,
            country: loc.country,
            location: loc.location,
            skills: job.skills,
            description,
          });

          if (existing) {
            await prisma.job.update({
              where: { hash },
              data: {
                title: job.title,
                description,
                location: loc.location || existing.location,
                rawLocation: loc.rawLocation || existing.rawLocation,
                city: loc.city || existing.city,
                country: loc.country || existing.country,
                employmentType: job.employmentType || existing.employmentType,
                experienceLevel: job.experienceLevel || existing.experienceLevel,
                department: job.department || existing.department,
                team: job.team || existing.team,
                skills: JSON.stringify(job.skills?.length ? job.skills : JSON.parse(existing.skills || "[]")),
                salary: job.salary ?? existing.salary,
                remoteType: job.remoteType === "unknown" ? existing.remoteType : job.remoteType,
                applicationUrl: job.applicationUrl,
                sourceUrl: job.sourceUrl,
                externalId: job.externalId ?? existing.externalId,
                searchText,
                lastSeenAt: now,
                missingScanCount: 0,
                isActive: true,
                isNew: false,
                isRelevant: scored.isRelevant,
                relevanceScore: scored.score,
                matchReasons: JSON.stringify(scored.reasons),
                postedAt: job.postedAt ?? existing.postedAt,
                extractionConfidence: job.extractionConfidence ?? existing.extractionConfidence,
              },
            });
            jobsUpdated += 1;
            updatedJobs += 1;
          } else {
            await prisma.job.create({
              data: {
                companyId: company.id,
                title: job.title,
                description,
                location: loc.location,
                rawLocation: loc.rawLocation,
                city: loc.city,
                country: loc.country,
                employmentType: job.employmentType,
                experienceLevel: job.experienceLevel,
                department: job.department,
                team: job.team,
                skills: JSON.stringify(job.skills),
                salary: job.salary,
                remoteType: job.remoteType,
                applicationUrl: job.applicationUrl,
                sourceUrl: job.sourceUrl,
                sourceType: job.sourceType,
                externalId: job.externalId,
                searchText,
                postedAt: job.postedAt,
                lastSeenAt: now,
                isNew: true,
                isActive: true,
                isRelevant: scored.isRelevant,
                relevanceScore: scored.score,
                matchReasons: JSON.stringify(scored.reasons),
                hash,
                missingScanCount: 0,
                extractionConfidence: job.extractionConfidence,
              },
            });
            jobsNew += 1;
            newJobs += 1;
          }
          jobsFound += 1;
          if (scored.isRelevant) {
            jobsRelevant += 1;
            relevant += 1;
          }
        }

        // 3-miss stale detection — only when we got a successful non-empty fetch
        if (!result.unsupported && hashes.size > 0) {
          const missing = await prisma.job.findMany({
            where: {
              companyId: company.id,
              hash: { notIn: [...hashes] },
              isActive: true,
            },
            select: { id: true, missingScanCount: true },
          });

          for (const row of missing) {
            const next = row.missingScanCount + 1;
            if (next >= MISSING_SCAN_THRESHOLD) {
              await prisma.job.update({
                where: { id: row.id },
                data: {
                  missingScanCount: next,
                  isActive: false,
                  isNew: false,
                },
              });
              jobsInactive += 1;
            } else {
              await prisma.job.update({
                where: { id: row.id },
                data: { missingScanCount: next },
              });
              jobsSkipped += 1;
            }
          }
        }

        const latency = Date.now() - companyStarted;
        const diagnostics = result.diagnostics;
        const status = result.unsupported ? "unsupported" : "ok";
        if (status === "ok") okCount += 1;
        else unsupportedCount += 1;

        await prisma.company.update({
          where: { id: company.id },
          data: {
            lastCheckedAt: now,
            checkStatus: status,
            lastError: result.warning ?? null,
            lastBlockReason: null,
            lastSuccessAt: status === "ok" ? now : undefined,
            lastFailureAt: status === "ok" ? undefined : now,
            jobsFetched: diagnostics?.fetched ?? fetched,
            jobsParsed: diagnostics?.parsed ?? normalized,
            jobsRejected: diagnostics?.rejected ?? 0,
            averageLatencyMs: latency,
            consecutiveFailures: status === "ok" && hashes.size > 0 ? 0 : undefined,
            sourceStatus:
              status === "ok" && hashes.size > 0
                ? "VERIFIED"
                : status === "unsupported"
                  ? "UNSUPPORTED"
                  : undefined,
          },
        });
        const duplicates = diagnostics?.duplicates ?? 0;
        const rejected = diagnostics?.rejected ?? 0;
        const valid = diagnostics?.valid ?? normalized;
        await prisma.scanLog.create({
          data: {
            runId,
            companyId: company.id,
            level: result.unsupported ? "warn" : "info",
            status,
            durationMs: latency,
            fetched,
            normalized,
            parsed: diagnostics?.parsed ?? fetched,
            valid,
            rejected,
            duplicates,
            relevant,
            newJobs,
            updatedJobs,
            message: result.unsupported
              ? result.warning ?? "Unsupported source"
              : `Fetched: ${fetched} · Parsed: ${diagnostics?.parsed ?? fetched} · Valid: ${valid} · Duplicates: ${duplicates} · New: ${newJobs} · Updated: ${updatedJobs}`,
          },
        });
      } catch (error) {
        errors += 1;
        failedCount += 1;
        const message = formatScanError(error);
        const blocked = error instanceof SourceBlockError;
        const unsupported = error instanceof UnsupportedSourceError;
        const status = unsupported ? "unsupported" : blocked ? "blocked" : "failed";
        const blockReason = blocked ? error.reason : undefined;
        const nextFailures = (company.consecutiveFailures ?? 0) + (blocked || unsupported ? 0 : 1);
        await prisma.company.update({
          where: { id: company.id },
          data: {
            lastCheckedAt: new Date(),
            checkStatus: status,
            lastError: message,
            lastBlockReason: blockReason,
            lastFailureAt: new Date(),
            failureCount: blocked || unsupported ? undefined : { increment: 1 },
            blockedCount: blocked ? { increment: 1 } : undefined,
            rateLimitCount: blockReason === "RATE_LIMITED" ? { increment: 1 } : undefined,
            averageLatencyMs: Date.now() - companyStarted,
            consecutiveFailures: blocked || unsupported ? undefined : { increment: 1 },
            sourceStatus: unsupported ? "UNSUPPORTED" : nextFailures >= 3 ? "FAILED" : undefined,
          },
        });
        if (unsupported || blocked) {
          failedCount -= 1;
        }
        if (unsupported) {
          unsupportedCount += 1;
        }
        await prisma.scanLog.create({
          data: {
            runId,
            companyId: company.id,
            level: "error",
            status,
            durationMs: Date.now() - companyStarted,
            message,
            blockReason,
            details: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
          },
        });
      }

      await sleep(200);
    });

    const durationMs = Date.now() - started;
    await prisma.scanRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        finishedAt: new Date(),
        companies: companies.length,
        jobsFound,
        jobsNew,
        jobsUpdated,
        jobsSkipped,
        jobsInactive,
        jobsRelevant,
        okCount,
        failedCount,
        unsupportedCount,
        errors,
        durationMs,
      },
    });

    return {
      ok: true,
      runId,
      companies: companies.length,
      jobsFound,
      jobsNew,
      jobsUpdated,
      jobsInactive,
      jobsRelevant,
      okCount,
      failedCount,
      unsupportedCount,
      errors,
      durationMs,
    };
  } catch (error) {
    await prisma.scanRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        companies: 0,
        jobsFound,
        jobsNew,
        jobsUpdated,
        jobsSkipped,
        jobsInactive,
        jobsRelevant,
        okCount,
        failedCount,
        unsupportedCount,
        errors: errors + 1,
        durationMs: Date.now() - started,
      },
    });
    throw error;
  } finally {
    running = false;
    currentRunId = null;
    scheduleAiAfterScan();
  }
}

export async function rescoreStoredJobs() {
  const prefs = await getPreferences();
  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    include: { company: true },
  });
  const BATCH = 40;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const slice = jobs.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((job) => {
        const scored = scoreJob(
          {
            title: job.title,
            description: job.description,
            location: job.location,
            country: job.country,
            employmentType: job.employmentType,
            experienceLevel: job.experienceLevel,
            department: job.department,
            team: job.team,
            skills: JSON.parse(job.skills || "[]"),
            salary: job.salary ?? undefined,
            remoteType: (job.remoteType as "remote" | "hybrid" | "onsite" | "unknown") ?? "unknown",
            applicationUrl: job.applicationUrl,
            sourceUrl: job.sourceUrl,
            sourceType: job.sourceType,
            postedAt: job.postedAt ?? undefined,
          },
          prefs
        );
        const searchText = buildSearchText({
          title: job.title,
          company: job.company.name,
          city: job.city,
          country: job.country,
          location: job.location,
          skills: JSON.parse(job.skills || "[]"),
          description: job.description,
        });
        return prisma.job.update({
          where: { id: job.id },
          data: {
            relevanceScore: scored.score,
            isRelevant: scored.isRelevant,
            matchReasons: JSON.stringify(scored.reasons),
            searchText,
          },
        });
      })
    );
  }
}

function limitJobs<T extends { title: string }>(jobs: T[], max = 180): T[] {
  const engineering = jobs.filter((job) =>
    /engineer|developer|sde|software|frontend|backend|full[- ]stack|machine learning|\bai\b|\bml\b/i.test(
      job.title
    )
  );
  const pool = engineering.length ? engineering : jobs;
  return pool.slice(0, max);
}

function formatScanError(error: unknown): string {
  if (error instanceof SourceBlockError) {
    return `${error.reason}: ${error.url}`;
  }
  if (error instanceof DeadlineError) {
    return error.message;
  }
  if (error instanceof HttpError) {
    if (error.status === 429) return `RATE_LIMITED: ${error.url}`;
    if (error.status === 401 || error.status === 403) return `ACCESS_DENIED: ${error.url}`;
    if (error.status === 408) return `Timeout: ${error.url}`;
    return `${error.message} (${error.url})`;
  }
  if (error instanceof Error) return error.message;
  return "Unknown scan error";
}
