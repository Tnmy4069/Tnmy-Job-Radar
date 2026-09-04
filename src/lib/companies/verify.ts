import { getAdapter, toCompanySource } from "@/lib/adapters/registry";
import type { AdapterResult } from "@/lib/adapters/types";
import { detectAtsFromHtml, detectAtsFromUrl } from "@/lib/discovery/ats-detect";
import { companyScanTimeoutMs } from "@/lib/discovery/config";
import { withDeadline } from "@/lib/discovery/deadline";
import { prisma } from "@/lib/db";
import { isOfficialApplicationUrl } from "@/lib/discovery/urls";
import { fetchText, HttpError, SourceBlockError } from "@/lib/http";

export type SourceStatus = "VERIFIED" | "UNVERIFIED" | "UNSUPPORTED" | "FAILED" | "DISABLED";

export type VerifyResult = {
  company: string;
  slug: string;
  sourceStatus: SourceStatus;
  atsType: string;
  jobsFound: number;
  applicationUrlsValid: boolean;
  paginationWorking: boolean | null;
  error: string | null;
  verifiedAt: string | null;
  enabled: boolean;
};

const STRUCTURED = new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "workday"]);

export function evaluateJobs(result: AdapterResult): {
  jobsFound: number;
  applicationUrlsValid: boolean;
  usable: boolean;
} {
  const jobs = result.jobs.filter((job) => job.title?.trim());
  const validUrls = jobs.filter((job) => isOfficialApplicationUrl(job.applicationUrl));
  return {
    jobsFound: jobs.length,
    applicationUrlsValid: jobs.length > 0 && validUrls.length === jobs.length,
    usable: validUrls.length > 0,
  };
}

async function fetchWithAdapter(
  company: { id: string; name: string; slug: string; careersUrl: string },
  sourceType: string,
  sourceConfig: string
) {
  const adapter = getAdapter(sourceType);
  return withDeadline(
    companyScanTimeoutMs(),
    () =>
      adapter.fetchJobs(
        toCompanySource({
          ...company,
          sourceType,
          sourceConfig,
        })
      ),
    `Source verification timed out: ${company.slug}`
  );
}

/** When a configured ATS board 404s, rediscover from the official careers HTML once. */
async function rediscoverAtsFromCareersPage(careersUrl: string): Promise<{
  type: string;
  config: Record<string, unknown>;
} | null> {
  try {
    const html = await fetchText(careersUrl, {}, { respectRobots: true });
    const detected = detectAtsFromHtml(html, careersUrl) ?? detectAtsFromUrl(careersUrl);
    if (!detected || detected.confidence < 85) return null;
    return { type: detected.type, config: detected.config };
  } catch {
    return null;
  }
}

export async function verifyCompanySource(
  companyId: string,
  options: { enableIfVerified?: boolean } = {}
): Promise<VerifyResult> {
  const company = await prisma.company.findFirst({
    where: { OR: [{ id: companyId }, { slug: companyId }] },
  });
  if (!company) {
    throw new Error("Company not found");
  }

  const now = new Date();
  let sourceType = company.sourceType;
  let sourceConfig = company.sourceConfig;
  const detected = detectAtsFromUrl(company.careersUrl);
  if (company.sourceType === "generic" && detected) {
    sourceType = detected.type;
    sourceConfig = JSON.stringify({
      ...JSON.parse(company.sourceConfig || "{}"),
      ...detected.config,
    });
  }

  let result: AdapterResult | null = null;
  let error: string | null = null;
  let fetchError: unknown = null;
  try {
    result = await fetchWithAdapter(company, sourceType, sourceConfig);
  } catch (caught) {
    fetchError = caught;
    const notFound = caught instanceof HttpError && caught.status === 404;
    if (notFound && STRUCTURED.has(sourceType)) {
      const rediscovered = await rediscoverAtsFromCareersPage(company.careersUrl);
      const currentConfig = JSON.parse(sourceConfig || "{}") as Record<string, unknown>;
      const same =
        rediscovered &&
        rediscovered.type === sourceType &&
        JSON.stringify(rediscovered.config) === JSON.stringify(currentConfig);
      if (rediscovered && !same) {
        sourceType = rediscovered.type;
        sourceConfig = JSON.stringify({ ...currentConfig, ...rediscovered.config });
        try {
          result = await fetchWithAdapter(company, sourceType, sourceConfig);
          fetchError = null;
        } catch (retryCaught) {
          fetchError = retryCaught;
          result = null;
        }
      }
    }
  }

  if (!result) {
    const message = fetchError instanceof Error ? fetchError.message : "Verification failed";
    await prisma.company.update({
      where: { id: company.id },
      data: {
        sourceStatus: "FAILED",
        lastCheckedAt: now,
        lastFailureAt: now,
        lastError: message,
        lastBlockReason:
          fetchError instanceof SourceBlockError ? fetchError.reason : company.lastBlockReason,
        sourceNotes: message.slice(0, 500),
        consecutiveFailures: { increment: 1 },
      },
    });
    return {
      company: company.name,
      slug: company.slug,
      sourceStatus: "FAILED",
      atsType: sourceType,
      jobsFound: 0,
      applicationUrlsValid: false,
      paginationWorking: null,
      error: message,
      verifiedAt: null,
      enabled: company.enabled,
    };
  }

  const stats = evaluateJobs(result);
  let sourceStatus: SourceStatus;
  if (result.unsupported && !stats.usable) {
    sourceStatus = "UNSUPPORTED";
    error = result.warning ?? "Current adapters cannot parse this official source";
  } else if (!stats.usable) {
    sourceStatus = "FAILED";
    error = result.warning ?? "Official source returned no usable jobs";
  } else if (!stats.applicationUrlsValid) {
    sourceStatus = "FAILED";
    error = "Some application URLs were missing or not official";
  } else {
    sourceStatus = "VERIFIED";
  }

  const enableIfVerified = options.enableIfVerified !== false && sourceStatus === "VERIFIED";
  const persistType =
    sourceStatus === "VERIFIED" ? (result.detectedSourceType ?? sourceType) : company.sourceType;
  const persistConfig =
    sourceStatus === "VERIFIED"
      ? result.detectedSourceConfig
        ? JSON.stringify({
            ...JSON.parse(sourceConfig || "{}"),
            ...result.detectedSourceConfig,
          })
        : sourceConfig
      : company.sourceConfig;

  await prisma.company.update({
    where: { id: company.id },
    data: {
      sourceStatus,
      lastCheckedAt: now,
      lastError: error,
      sourceNotes: error ?? "",
      sourceVerifiedAt: sourceStatus === "VERIFIED" ? now : company.sourceVerifiedAt,
      lastSuccessAt: sourceStatus === "VERIFIED" ? now : company.lastSuccessAt,
      lastFailureAt: sourceStatus === "VERIFIED" ? company.lastFailureAt : now,
      consecutiveFailures: sourceStatus === "VERIFIED" ? 0 : { increment: 1 },
      jobsFetched: stats.jobsFound,
      jobsParsed: stats.jobsFound,
      enabled: enableIfVerified ? true : company.enabled,
      sourceType: persistType,
      sourceConfig: persistConfig,
    },
  });

  return {
    company: company.name,
    slug: company.slug,
    sourceStatus,
    atsType: persistType,
    jobsFound: stats.jobsFound,
    applicationUrlsValid: stats.applicationUrlsValid,
    paginationWorking: stats.jobsFound > 20 ? true : null,
    error,
    verifiedAt: sourceStatus === "VERIFIED" ? now.toISOString() : null,
    enabled: enableIfVerified ? true : company.enabled,
  };
}

export async function verifyCompanySources(options: { onlyUnverified?: boolean; enableIfVerified?: boolean } = {}) {
  const concurrency = Math.min(3, Math.max(1, Number(process.env.SOURCE_VERIFY_CONCURRENCY ?? 3) || 3));
  const where = options.onlyUnverified === false ? {} : { sourceStatus: { in: ["UNVERIFIED", "FAILED"] } };
  const companies = await prisma.company.findMany({
    where,
    select: { id: true, slug: true, sourceType: true, priority: true, name: true },
  });
  const structured = new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "workday", "amazon", "google"]);
  companies.sort((a, b) => {
    const as = structured.has(a.sourceType) ? 0 : 1;
    const bs = structured.has(b.sourceType) ? 0 : 1;
    if (as !== bs) return as - bs;
    return (a.priority ?? "B").localeCompare(b.priority ?? "B") || a.name.localeCompare(b.name);
  });

  const results: VerifyResult[] = [];
  let next = 0;
  async function worker() {
    while (next < companies.length) {
      const index = next++;
      const company = companies[index];
      try {
        results[index] = await verifyCompanySource(company.id, {
          enableIfVerified: options.enableIfVerified,
        });
        console.log(
          `[verify] ${company.slug} ${results[index].sourceStatus} jobs=${results[index].jobsFound}${results[index].error ? ` ${results[index].error}` : ""}`
        );
      } catch (error) {
        results[index] = {
          company: company.slug,
          slug: company.slug,
          sourceStatus: "FAILED",
          atsType: company.sourceType,
          jobsFound: 0,
          applicationUrlsValid: false,
          paginationWorking: null,
          error: error instanceof Error ? error.message : "Verification failed",
          verifiedAt: null,
          enabled: false,
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, companies.length) }, () => worker()));
  return results.filter(Boolean);
}
