import { getAdapter, toCompanySource } from "@/lib/adapters/registry";
import { UnsupportedSourceError } from "@/lib/adapters/types";
import { prisma } from "@/lib/db";
import { buildSearchText, jobFingerprint } from "@/lib/hash";
import { HttpError } from "@/lib/http";
import { normalizeLocation } from "@/lib/location";
import { getPreferences } from "@/lib/preferences";
import { scoreJob } from "@/lib/relevance/engine";
import { sanitizeJobHtml } from "@/lib/sanitize";

type ScanTrigger = "manual" | "scheduled" | "cron";

const MISSING_SCAN_THRESHOLD = 3;
const CONCURRENCY = 2;

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
      where: companySlug ? { slug: companySlug, enabled: true } : { enabled: true },
      orderBy: { name: "asc" },
    });

    await mapPool(companies, CONCURRENCY, async (company) => {
      const companyStarted = Date.now();
      let fetched = 0;
      let normalized = 0;
      let relevant = 0;
      let newJobs = 0;

      try {
        const adapter = getAdapter(company.sourceType);
        const source = toCompanySource(company);
        const result = await adapter.fetchJobs(source);
        const now = new Date();
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
          const description = sanitizeJobHtml(job.description || "");
          const searchText = buildSearchText({
            title: job.title,
            company: company.name,
            city: loc.city,
            country: loc.country,
            location: loc.location,
            skills: job.skills,
            description,
          });

          const existing = await prisma.job.findUnique({ where: { hash } });
          if (existing) {
            await prisma.job.update({
              where: { hash },
              data: {
                title: job.title,
                description: description || existing.description,
                location: loc.location || existing.location,
                rawLocation: loc.rawLocation || existing.rawLocation,
                city: loc.city || existing.city,
                country: loc.country || existing.country,
                employmentType: job.employmentType,
                experienceLevel: job.experienceLevel,
                department: job.department,
                team: job.team,
                skills: JSON.stringify(job.skills),
                salary: job.salary,
                remoteType: job.remoteType,
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
              },
            });
            jobsUpdated += 1;
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

        const status = result.unsupported ? "unsupported" : "ok";
        if (status === "ok") okCount += 1;
        else unsupportedCount += 1;

        await prisma.company.update({
          where: { id: company.id },
          data: {
            lastCheckedAt: now,
            checkStatus: status,
            lastError: result.warning ?? null,
          },
        });
        await prisma.scanLog.create({
          data: {
            runId,
            companyId: company.id,
            level: result.unsupported ? "warn" : "info",
            status,
            durationMs: Date.now() - companyStarted,
            fetched,
            normalized,
            relevant,
            newJobs,
            message: result.unsupported
              ? result.warning ?? "Unsupported source"
              : `Fetched ${incoming.length} jobs (${newJobs} new, ${relevant} relevant)`,
          },
        });
      } catch (error) {
        errors += 1;
        failedCount += 1;
        const message = formatScanError(error);
        await prisma.company.update({
          where: { id: company.id },
          data: {
            lastCheckedAt: new Date(),
            checkStatus: error instanceof UnsupportedSourceError ? "unsupported" : "failed",
            lastError: message,
          },
        });
        if (error instanceof UnsupportedSourceError) {
          unsupportedCount += 1;
          failedCount -= 1;
        }
        await prisma.scanLog.create({
          data: {
            runId,
            companyId: company.id,
            level: "error",
            status: error instanceof UnsupportedSourceError ? "unsupported" : "failed",
            durationMs: Date.now() - companyStarted,
            message,
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
  if (error instanceof HttpError) {
    if (error.status === 429) return `Rate limited: ${error.url}`;
    if (error.status === 401 || error.status === 403) return `Authentication issue: ${error.url}`;
    return `${error.message} (${error.url})`;
  }
  if (error instanceof Error) return error.message;
  return "Unknown scan error";
}
