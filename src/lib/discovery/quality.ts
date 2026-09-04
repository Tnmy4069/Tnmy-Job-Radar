import { normalizeApplicationUrl } from "./urls";

export type ExtractionMethod = "api" | "json" | "jsonld" | "html" | "browser" | "partial";

export function extractionConfidence(method: ExtractionMethod, extra?: { complete?: boolean }): number {
  const complete = extra?.complete !== false;
  const table: Record<ExtractionMethod, [number, number]> = {
    api: [95, 100],
    json: [90, 98],
    jsonld: [90, 98],
    html: [70, 90],
    browser: [70, 90],
    partial: [40, 69],
  };
  const [low, high] = table[method];
  if (!complete || method === "partial") return Math.min(low, 69);
  return high;
}

export type QualityInput = {
  title?: string;
  applicationUrl?: string;
  companyName?: string;
  hiringOrganization?: string;
  description?: string;
  externalId?: string;
};

const AGGREGATORS = /\b(linkedin|indeed|glassdoor|ziprecruiter|monster\.com|naukri|foundit)\b/i;

export function rejectJob(job: QualityInput): string | null {
  const title = job.title?.trim() ?? "";
  const url = job.applicationUrl?.trim() ?? "";
  if (!title) return "missing_title";
  if (!url) return "missing_application_url";
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return "invalid_application_url";
  } catch {
    return "invalid_application_url";
  }

  const hiring = job.hiringOrganization?.trim() ?? "";
  if (hiring && AGGREGATORS.test(hiring)) return "aggregator_identity";
  if (hiring && job.companyName && !namesCompatible(job.companyName, hiring)) {
    return "inconsistent_company";
  }

  const desc = job.description?.trim() ?? "";
  if (desc && job.companyName && AGGREGATORS.test(desc.slice(0, 400)) && !desc.toLowerCase().includes(job.companyName.toLowerCase())) {
    return "unrelated_description";
  }

  if (!job.externalId && !normalizeApplicationUrl(url)) return "invalid_job_id";
  return null;
}

function namesCompatible(company: string, hiring: string): boolean {
  const a = normalizeName(company);
  const b = normalizeName(hiring);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|limited|corp|corporation|technologies|technology|software|india|pvt|private)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isAcceptableMissingField(field: "postedAt" | "location" | "skills"): boolean {
  return field === "postedAt" || field === "location" || field === "skills";
}
