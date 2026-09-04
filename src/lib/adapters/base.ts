import { maxDetailPagesPerSource } from "@/lib/discovery/config";
import { looksLikeThinDescription, normalizeDescription } from "@/lib/discovery/description";
import type { ExtractedJob } from "@/lib/discovery/embedded";
import { extractionConfidence, rejectJob, type ExtractionMethod } from "@/lib/discovery/quality";
import { fetchText } from "@/lib/http";
import { completeJob } from "./normalize";
import type { AdapterDiagnostics, AdapterResult, CompanySource, NormalizedJob } from "./types";

export function extractedToNormalized(
  job: ExtractedJob,
  company: CompanySource,
  method: ExtractionMethod
): NormalizedJob {
  return completeJob({
    externalId: job.externalId,
    title: job.title,
    description: job.description,
    location: job.location,
    employmentType: job.employmentType ?? "",
    department: job.department ?? "",
    applicationUrl: job.applicationUrl,
    sourceUrl: company.careersUrl,
    sourceType: company.sourceType,
    postedAt: job.postedAt ?? undefined,
    extractionConfidence: extractionConfidence(method, {
      complete: Boolean(job.description && job.location && job.postedAt),
    }),
  });
}

export function filterValidJobs(
  jobs: NormalizedJob[],
  companyName: string
): { valid: NormalizedJob[]; diagnostics: AdapterDiagnostics } {
  const unique = new Map<string, NormalizedJob>();
  let rejected = 0;
  let duplicates = 0;
  for (const job of jobs) {
    const reason = rejectJob({
      title: job.title,
      applicationUrl: job.applicationUrl,
      companyName,
      description: job.description,
      externalId: job.externalId,
    });
    if (reason) {
      rejected += 1;
      continue;
    }
    const key = `${job.externalId ?? ""}|${job.applicationUrl}|${job.title}`;
    if (unique.has(key)) {
      duplicates += 1;
      continue;
    }
    unique.set(key, job);
  }
  const valid = [...unique.values()];
  return {
    valid,
    diagnostics: {
      fetched: jobs.length,
      parsed: jobs.length,
      valid: valid.length,
      rejected,
      duplicates,
    },
  };
}

export function finishResult(
  jobs: NormalizedJob[],
  company: CompanySource,
  method: ExtractionMethod,
  extra: Partial<AdapterResult> = {}
): AdapterResult {
  const { valid, diagnostics } = filterValidJobs(jobs, company.name);
  return {
    jobs: valid,
    extractionMethod: method,
    diagnostics,
    ...extra,
  };
}

export async function enrichThinJobs(
  jobs: NormalizedJob[],
  company: CompanySource
): Promise<NormalizedJob[]> {
  const cap = maxDetailPagesPerSource();
  let used = 0;
  const out: NormalizedJob[] = [];
  for (const job of jobs) {
    if (used >= cap || !looksLikeThinDescription(job.description)) {
      out.push(job);
      continue;
    }
    try {
      const html = await fetchText(job.applicationUrl, { headers: { Accept: "text/html" } });
      used += 1;
      const { extractJsonLdJobs } = await import("@/lib/discovery/embedded");
      const details = extractJsonLdJobs(html, job.applicationUrl);
      const match = details[0];
      const description = normalizeDescription(match?.description || html);
      out.push({
        ...job,
        description: description.length > job.description.length ? description : job.description,
        location: job.location || match?.location || "",
        employmentType: job.employmentType || match?.employmentType || job.employmentType,
        postedAt: job.postedAt ?? match?.postedAt ?? undefined,
      });
    } catch {
      out.push(job);
    }
  }
  return out;
}
