import { parseJobDate } from "./dates";
import { normalizeDescription } from "./description";

export type ExtractedJob = {
  externalId?: string;
  title: string;
  description: string;
  location: string;
  employmentType?: string;
  department?: string;
  applicationUrl: string;
  postedAt?: Date | null;
  updatedAt?: Date | null;
  source: "jsonld" | "next-data" | "embedded-json";
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function locationFromNode(node: JsonRecord): string {
  const loc = node.jobLocation;
  const one = Array.isArray(loc) ? loc[0] : loc;
  if (isRecord(one) && isRecord(one.address)) {
    return [asString(one.address.addressLocality), asString(one.address.addressCountry)]
      .filter(Boolean)
      .join(", ");
  }
  return asString(node.location || node.city || node.jobLocation);
}

function jobFromRecord(node: JsonRecord, fallbackUrl: string, source: ExtractedJob["source"]): ExtractedJob | null {
  const title = asString(node.title || node.name || node.text);
  const applicationUrl = asString(
    node.absolute_url || node.applyUrl || node.hostedUrl || node.applicationUrl || node.url || fallbackUrl
  );
  if (!title || !applicationUrl) return null;
  return {
    externalId: asString(node.id || node.externalId || node.requisitionId || node.gh_jid) || undefined,
    title,
    description: normalizeDescription(
      asString(node.description || node.content || node.descriptionHtml || node.descriptionPlain)
    ),
    location: locationFromNode(node),
    employmentType: asString(
      node.employmentType || (isRecord(node.categories) ? node.categories.commitment : "")
    ),
    department: asString(node.department || (isRecord(node.categories) ? asString(node.categories.team) : "")),
    applicationUrl,
    postedAt: parseJobDate(
      asString(node.datePosted || node.publishedAt || node.updated_at || node.postedOn) ||
        (typeof node.createdAt === "number" ? node.createdAt : null)
    ),
    source,
  };
}

function flattenGraph(node: unknown): JsonRecord[] {
  if (Array.isArray(node)) return node.flatMap(flattenGraph);
  if (!isRecord(node)) return [];
  const graph = node["@graph"];
  if (Array.isArray(graph)) return graph.flatMap(flattenGraph);
  return [node];
}

export function extractJsonLdJobs(html: string, fallbackUrl: string): ExtractedJob[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const jobs: ExtractedJob[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as unknown;
      for (const node of flattenGraph(parsed)) {
        const type = node["@type"] ?? node.type;
        const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];
        if (!types.includes("JobPosting")) continue;
        const job = jobFromRecord(node, fallbackUrl, "jsonld");
        if (job) jobs.push(job);
      }
    } catch {
      // malformed JSON-LD is ignored
    }
  }
  return jobs;
}

export function extractNextDataJobs(html: string, fallbackUrl: string): ExtractedJob[] {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
  if (!match) return [];
  try {
    return walkJobRecords(JSON.parse(match[1]), fallbackUrl, "next-data");
  } catch {
    return [];
  }
}

function walkJobRecords(value: unknown, fallbackUrl: string, source: ExtractedJob["source"]): ExtractedJob[] {
  const bag: ExtractedJob[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown) => {
    if (!node || seen.has(node)) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;
    seen.add(node);
    const job = jobFromRecord(node, fallbackUrl, source);
    if (job && (node.url || node.applyUrl || node.hostedUrl || node.absolute_url)) {
      bag.push(job);
    }
    for (const child of Object.values(node)) walk(child);
  };
  walk(value);
  return bag;
}

export function extractEmbeddedJsonJobs(html: string, fallbackUrl: string): ExtractedJob[] {
  const jobs = [...extractJsonLdJobs(html, fallbackUrl), ...extractNextDataJobs(html, fallbackUrl)];
  const blobs = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  for (const blob of blobs) {
    const text = blob[1].trim();
    if (!text.startsWith("{") && !text.startsWith("[")) continue;
    if (text.length > 1_500_000) continue;
    try {
      jobs.push(...walkJobRecords(JSON.parse(text), fallbackUrl, "embedded-json"));
    } catch {
      // ignore non-JSON script bodies
    }
  }
  const unique = new Map<string, ExtractedJob>();
  for (const job of jobs) unique.set(`${job.applicationUrl}|${job.title}`, job);
  return [...unique.values()];
}

export function detectJsShell(html: string): boolean {
  const hay = html.toLowerCase();
  const hydration =
    hay.includes("__next_data__") ||
    hay.includes("data-reactroot") ||
    hay.includes('id="__nuxt"') ||
    hay.includes("data-server-rendered") ||
    /id=["']root["']/.test(hay) ||
    /id=["']app["']/.test(hay);
  const emptyList =
    /no jobs (found|available)/i.test(html) ||
    /job-list["'][^>]*>\s*<\/(div|ul|section)/i.test(html);
  const pagination = /load more|next page|aria-label=["']next/i.test(html);
  const short = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").trim()
    .length < 1500;
  return Boolean((hydration && (emptyList || pagination || short)) || (hydration && short));
}
