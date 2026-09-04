import { z } from "zod";

export const FIT_LEVELS = ["excellent", "good", "moderate", "poor", "unknown"] as const;
export const RECOMMENDATIONS = [
  "APPLY_NOW",
  "STRONG_MATCH",
  "CONSIDER",
  "LOW_PRIORITY",
  "SKIP",
] as const;
export const SENIORITY_LEVELS = [
  "entry",
  "junior",
  "mid",
  "senior",
  "staff",
  "lead",
  "principal",
  "unknown",
] as const;
export const JOB_AI_STATUSES = [
  "NOT_ANALYZED",
  "QUEUED",
  "ANALYZING",
  "ANALYZED",
  "FAILED",
] as const;
export const QUEUE_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "RETRY_WAIT",
] as const;
export const QUEUE_PRIORITIES = ["MANUAL", "HIGH", "NORMAL", "LOW"] as const;

export type FitLevel = (typeof FIT_LEVELS)[number];
export type AiRecommendation = (typeof RECOMMENDATIONS)[number];
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];
export type JobAiStatus = (typeof JOB_AI_STATUSES)[number];
export type QueueStatus = (typeof QUEUE_STATUSES)[number];
export type QueuePriority = (typeof QUEUE_PRIORITIES)[number];

const fitLevel = z.preprocess((value) => String(value ?? "unknown").toLowerCase(), z.enum(FIT_LEVELS));
const recommendation = z.preprocess(
  (value) => String(value ?? "").toUpperCase().replace(/[\s-]+/g, "_"),
  z.enum(RECOMMENDATIONS)
);
const seniority = z.preprocess((value) => String(value ?? "unknown").toLowerCase(), z.enum(SENIORITY_LEVELS));
const stringList = z.array(z.coerce.string().min(1)).max(24).default([]);

export const jobAnalysisSchema = z.object({
  fitScore: z.coerce.number().min(0).max(100),
  recommendation: recommendation,
  summary: z.string().min(1).max(800),
  strengths: stringList,
  gaps: stringList,
  concerns: stringList,
  reasoning: z.string().min(1).max(2000),
  experienceFit: fitLevel,
  skillFit: fitLevel,
  roleFit: fitLevel,
  locationFit: fitLevel,
  isEarlyCareer: z.coerce.boolean(),
  requiresSignificantExperience: z.coerce.boolean(),
  requiredSkillsMatched: stringList,
  requiredSkillsMissing: stringList,
  preferredSkillsMatched: stringList,
  preferredSkillsMissing: stringList,
  seniority: seniority,
});

export const batchedJobAnalysisSchema = z.object({
  results: z
    .array(
      jobAnalysisSchema.extend({
        jobId: z.string().min(1),
      })
    )
    .min(1),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
export type BatchedJobAnalysis = z.infer<typeof batchedJobAnalysisSchema>;

export const JOB_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "fitScore",
    "recommendation",
    "summary",
    "strengths",
    "gaps",
    "concerns",
    "reasoning",
    "experienceFit",
    "skillFit",
    "roleFit",
    "locationFit",
    "isEarlyCareer",
    "requiresSignificantExperience",
    "requiredSkillsMatched",
    "requiredSkillsMissing",
    "preferredSkillsMatched",
    "preferredSkillsMissing",
    "seniority",
  ],
  properties: {
    fitScore: { type: "number", minimum: 0, maximum: 100 },
    recommendation: { type: "string", enum: [...RECOMMENDATIONS] },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    concerns: { type: "array", items: { type: "string" } },
    reasoning: { type: "string" },
    experienceFit: { type: "string", enum: [...FIT_LEVELS] },
    skillFit: { type: "string", enum: [...FIT_LEVELS] },
    roleFit: { type: "string", enum: [...FIT_LEVELS] },
    locationFit: { type: "string", enum: [...FIT_LEVELS] },
    isEarlyCareer: { type: "boolean" },
    requiresSignificantExperience: { type: "boolean" },
    requiredSkillsMatched: { type: "array", items: { type: "string" } },
    requiredSkillsMissing: { type: "array", items: { type: "string" } },
    preferredSkillsMatched: { type: "array", items: { type: "string" } },
    preferredSkillsMissing: { type: "array", items: { type: "string" } },
    seniority: { type: "string", enum: [...SENIORITY_LEVELS] },
  },
} as const;

export const BATCH_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["jobId", ...JOB_ANALYSIS_JSON_SCHEMA.required],
        properties: {
          jobId: { type: "string" },
          ...JOB_ANALYSIS_JSON_SCHEMA.properties,
        },
      },
    },
  },
} as const;

export class InvalidAiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAiResponseError";
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new InvalidAiResponseError("Gemini did not return JSON");
  }
}

export function parseJobAnalysis(text: string): JobAnalysis {
  const parsed = jobAnalysisSchema.safeParse(unwrapAnalysis(parseJsonObject(text)));
  if (!parsed.success) {
    throw new InvalidAiResponseError(
      `Gemini response failed schema validation: ${parsed.error.issues.slice(0, 3).map((i) => i.message).join("; ")}`
    );
  }
  return normalizeAnalysis(parsed.data);
}

function unwrapAnalysis(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record.analysis && typeof record.analysis === "object") return record.analysis;
  if (record.result && typeof record.result === "object") return record.result;
  return value;
}

export function parseBatchedJobAnalysis(text: string): { valid: Array<JobAnalysis & { jobId: string }>; invalid: string[] } {
  let raw: unknown;
  try {
    raw = parseJsonObject(text);
  } catch {
    throw new InvalidAiResponseError("Gemini batch response was not JSON");
  }
  const object = raw as { results?: unknown[] };
  const rows = Array.isArray(object?.results) ? object.results : Array.isArray(raw) ? raw : [raw];
  const valid: Array<JobAnalysis & { jobId: string }> = [];
  const invalid: string[] = [];
  for (const row of rows) {
    const parsed = jobAnalysisSchema.extend({ jobId: z.string().min(1) }).safeParse(row);
    if (parsed.success) valid.push({ ...normalizeAnalysis(parsed.data), jobId: parsed.data.jobId });
    else invalid.push(typeof row === "object" && row && "jobId" in row ? String((row as { jobId: unknown }).jobId) : "unknown");
  }
  if (!valid.length) {
    throw new InvalidAiResponseError("Gemini batch response contained no valid job analyses");
  }
  return { valid, invalid };
}

function normalizeAnalysis(analysis: JobAnalysis): JobAnalysis {
  return {
    ...analysis,
    fitScore: Math.round(Math.min(100, Math.max(0, analysis.fitScore))),
    strengths: uniqueTrim(analysis.strengths),
    gaps: uniqueTrim(analysis.gaps),
    concerns: uniqueTrim(analysis.concerns),
    requiredSkillsMatched: uniqueTrim(analysis.requiredSkillsMatched),
    requiredSkillsMissing: uniqueTrim(analysis.requiredSkillsMissing),
    preferredSkillsMatched: uniqueTrim(analysis.preferredSkillsMatched),
    preferredSkillsMissing: uniqueTrim(analysis.preferredSkillsMissing),
  };
}

function uniqueTrim(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = item.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.slice(0, 12);
}

export function queuePriorityRank(priority: QueuePriority): number {
  if (priority === "MANUAL") return 0;
  if (priority === "HIGH") return 10;
  if (priority === "LOW") return 80;
  return 50;
}
