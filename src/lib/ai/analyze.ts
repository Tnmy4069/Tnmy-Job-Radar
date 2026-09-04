import { prisma } from "@/lib/db";
import { parseJsonArray, stringifyJson } from "@/lib/utils";
import {
  geminiDailyMaxJobs,
  geminiDailyMaxTokens,
  geminiEnabled,
  geminiMaxRetries,
  geminiMinScore,
  geminiModel,
} from "./config";
import { generateGeminiAnalysis } from "./client";
import { normalizeJobDescription } from "./description";
import { disagreementFlag } from "./disagreement";
import { classifyGeminiError, GeminiError, backoffMs } from "./errors";
import { computeAiAnalysisHash } from "./hash";
import {
  recordAiCacheHit,
  recordAiFailure,
  recordAiRequest,
  recordAiRetry,
  recordAiSuccess,
  getAiMetrics,
} from "./metrics";
import { canDispatchAiRequest, recordCircuitFailure, recordCircuitSuccess } from "./circuit";
import { computePriorityScore } from "./priority";
import { buildAnalysisUserPrompt, buildJobPayload, currentPromptVersion } from "./prompt";
import { InvalidAiResponseError, parseBatchedJobAnalysis, parseJobAnalysis, type JobAnalysis } from "./schema";
import { analysisFromJob } from "./dto";

export { analysisFromJob };

export type AnalyzableJob = {
  id: string;
  title: string;
  description: string;
  location: string;
  employmentType: string;
  skills: string;
  postedAt: Date | null;
  relevanceScore: number;
  matchReasons: string;
  isActive: boolean;
  isRelevant: boolean;
  aiStatus: string | null;
  aiAnalysisHash: string | null;
  aiFitScore: number | null;
  company: { name: string; priority?: string | null };
};

export type AnalyzeOptions = {
  force?: boolean;
  overrideThreshold?: boolean;
  persist?: boolean;
};

export type AnalyzeOutcome = {
  jobId: string;
  cacheHit: boolean;
  skipped?: "disabled" | "below_threshold" | "inactive" | "irrelevant";
  analysis: JobAnalysis | null;
  model?: string;
  hash: string;
  disagreement?: ReturnType<typeof disagreementFlag>;
  error?: string;
};

function skillsOf(job: AnalyzableJob): string[] {
  return parseJsonArray(job.skills);
}

export function jobAnalysisHash(job: AnalyzableJob): string {
  return computeAiAnalysisHash({
    jobId: job.id,
    title: job.title,
    description: job.description,
    skills: skillsOf(job),
    location: job.location,
    employmentType: job.employmentType,
  });
}

export function isEligibleForAutoAnalysis(job: AnalyzableJob, minScore = geminiMinScore()): boolean {
  return job.isActive && job.isRelevant && job.relevanceScore >= minScore;
}

export function cachedAnalysisValid(job: AnalyzableJob, hash = jobAnalysisHash(job)): boolean {
  return job.aiStatus === "ANALYZED" && !!job.aiAnalysisHash && job.aiAnalysisHash === hash && job.aiFitScore != null;
}

function dailyBudgetReached(): boolean {
  const metrics = getAiMetrics();
  const maxJobs = geminiDailyMaxJobs();
  const maxTokens = geminiDailyMaxTokens();
  if (maxJobs != null && metrics.dailyJobs >= maxJobs) return true;
  if (maxTokens != null && metrics.dailyTokens >= maxTokens) return true;
  return false;
}

export async function analyzeJob(job: AnalyzableJob, options: AnalyzeOptions = {}): Promise<AnalyzeOutcome> {
  const hash = jobAnalysisHash(job);
  if (!options.force && cachedAnalysisValid(job, hash)) {
    recordAiCacheHit();
    return {
      jobId: job.id,
      cacheHit: true,
      analysis: null,
      hash,
      disagreement: disagreementFlag(job.aiFitScore, job.relevanceScore),
    };
  }

  if (!geminiEnabled()) {
    return { jobId: job.id, cacheHit: false, skipped: "disabled", analysis: null, hash };
  }

  if (!options.overrideThreshold && !options.force && !isEligibleForAutoAnalysis(job)) {
    const skipped = !job.isActive ? "inactive" : !job.isRelevant ? "irrelevant" : "below_threshold";
    return { jobId: job.id, cacheHit: false, skipped, analysis: null, hash };
  }

  if (!canDispatchAiRequest()) {
    return {
      jobId: job.id,
      cacheHit: false,
      analysis: null,
      hash,
      error: "Gemini circuit breaker is open",
    };
  }
  if (!options.force && dailyBudgetReached()) {
    return {
      jobId: job.id,
      cacheHit: false,
      analysis: null,
      hash,
      error: "Gemini daily budget reached",
    };
  }

  if (options.persist !== false) {
    await prisma.job.update({
      where: { id: job.id },
      data: { aiStatus: "ANALYZING", aiError: null },
    });
  }

  const payload = buildJobPayload({
    id: job.id,
    companyName: job.company.name,
    title: job.title,
    description: normalizeJobDescription(job.description),
    location: job.location,
    employmentType: job.employmentType,
    postedAt: job.postedAt ? job.postedAt.toISOString() : null,
    skills: skillsOf(job),
    relevanceScore: job.relevanceScore,
    matchReasons: parseJsonArray(job.matchReasons),
  });

  const maxRetries = geminiMaxRetries();
  let attempt = 0;
  let lastError: GeminiError | null = null;

  while (attempt <= maxRetries) {
    const started = Date.now();
    recordAiRequest();
    try {
      const result = await generateGeminiAnalysis({
        user: buildAnalysisUserPrompt([payload]),
        batch: false,
      });
      let analysis;
      try {
        analysis = parseJobAnalysis(result.text);
      } catch (parseError) {
        const snippet = result.text.replace(/\s+/g, " ").slice(0, 180);
        throw new InvalidAiResponseError(
          `${parseError instanceof Error ? parseError.message : "invalid JSON"} :: ${snippet}`
        );
      }
      recordAiSuccess(Date.now() - started, result.tokens, 1);
      recordCircuitSuccess();
      if (options.persist !== false) {
        await persistAnalysis(job, analysis, hash, result.model);
      }
      return {
        jobId: job.id,
        cacheHit: false,
        analysis,
        model: result.model,
        hash,
        disagreement: disagreementFlag(analysis.fitScore, job.relevanceScore),
      };
    } catch (error) {
      const classified = classifyGeminiError(error);
      lastError = classified;
      if (classified.kind === "invalid_response") {
        recordAiFailure("invalid_response");
        break;
      }
      recordAiFailure(classified.kind);
      if (classified.quotaExhausted) {
        recordCircuitFailure();
        break;
      }
      if (!classified.transient || attempt >= maxRetries) {
        recordCircuitFailure();
        break;
      }
      recordAiRetry();
      await sleep(backoffMs(attempt, classified.retryAfterMs));
      attempt += 1;
    }
  }

  if (options.persist !== false) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        aiStatus: "FAILED",
        aiError: lastError?.message.slice(0, 400) ?? "Gemini analysis failed",
      },
    });
  }

  return {
    jobId: job.id,
    cacheHit: false,
    analysis: null,
    hash,
    error: lastError?.message ?? "Gemini analysis failed",
  };
}

export async function analyzeJobBatch(jobs: AnalyzableJob[], options: AnalyzeOptions = {}): Promise<AnalyzeOutcome[]> {
  if (jobs.length === 0) return [];
  if (jobs.length === 1) return [await analyzeJob(jobs[0], options)];

  const outcomes: AnalyzeOutcome[] = [];
  const toCall: AnalyzableJob[] = [];

  for (const job of jobs) {
    const hash = jobAnalysisHash(job);
    if (!options.force && cachedAnalysisValid(job, hash)) {
      recordAiCacheHit();
      outcomes.push({
        jobId: job.id,
        cacheHit: true,
        analysis: null,
        hash,
        disagreement: disagreementFlag(job.aiFitScore, job.relevanceScore),
      });
      continue;
    }
    if (!options.overrideThreshold && !options.force && !isEligibleForAutoAnalysis(job)) {
      const skipped = !job.isActive ? "inactive" : !job.isRelevant ? "irrelevant" : "below_threshold";
      outcomes.push({ jobId: job.id, cacheHit: false, skipped, analysis: null, hash });
      continue;
    }
    toCall.push(job);
  }

  if (!toCall.length) return outcomes;
  if (!geminiEnabled()) {
    return outcomes.concat(
      toCall.map((job) => ({
        jobId: job.id,
        cacheHit: false,
        skipped: "disabled" as const,
        analysis: null,
        hash: jobAnalysisHash(job),
      }))
    );
  }

  const started = Date.now();
  recordAiRequest();
  try {
    const payloads = toCall.map((job) =>
      buildJobPayload({
        id: job.id,
        companyName: job.company.name,
        title: job.title,
        description: normalizeJobDescription(job.description),
        location: job.location,
        employmentType: job.employmentType,
        postedAt: job.postedAt ? job.postedAt.toISOString() : null,
        skills: skillsOf(job),
        relevanceScore: job.relevanceScore,
        matchReasons: parseJsonArray(job.matchReasons),
      })
    );
    const result = await generateGeminiAnalysis({
      user: buildAnalysisUserPrompt(payloads),
      batch: true,
    });
    const parsed = parseBatchedJobAnalysis(result.text);
    recordAiSuccess(Date.now() - started, result.tokens, parsed.valid.length);
    recordCircuitSuccess();

    const byId = new Map(parsed.valid.map((row) => [row.jobId, row]));
    for (const job of toCall) {
      const analysis = byId.get(job.id);
      const hash = jobAnalysisHash(job);
      if (!analysis) {
        outcomes.push(await analyzeJob(job, options));
        continue;
      }
      if (options.persist !== false) {
        await persistAnalysis(job, analysis, hash, result.model);
      }
      outcomes.push({
        jobId: job.id,
        cacheHit: false,
        analysis,
        model: result.model,
        hash,
        disagreement: disagreementFlag(analysis.fitScore, job.relevanceScore),
      });
    }
    return outcomes;
  } catch (error) {
    const classified = classifyGeminiError(error);
    recordAiFailure(classified.kind);
    if (classified.quotaExhausted) {
      recordCircuitFailure();
      return outcomes.concat(
        toCall.map((job) => ({
          jobId: job.id,
          cacheHit: false,
          analysis: null,
          hash: jobAnalysisHash(job),
          error: classified.message,
        }))
      );
    }
    const singles: AnalyzeOutcome[] = [];
    for (const job of toCall) {
      singles.push(await analyzeJob(job, options));
    }
    return outcomes.concat(singles);
  }
}

export async function persistAnalysis(
  job: AnalyzableJob,
  analysis: JobAnalysis,
  hash: string,
  model = geminiModel()
) {
  const priorityScore = computePriorityScore({
    aiFitScore: analysis.fitScore,
    relevanceScore: job.relevanceScore,
    postedAt: job.postedAt,
  });
  await prisma.job.update({
    where: { id: job.id },
    data: {
      aiFitScore: analysis.fitScore,
      aiRecommendation: analysis.recommendation,
      aiSummary: analysis.summary,
      aiStrengths: stringifyJson(analysis.strengths),
      aiGaps: stringifyJson(analysis.gaps),
      aiConcerns: stringifyJson(analysis.concerns),
      aiReasoning: analysis.reasoning,
      aiExperienceFit: analysis.experienceFit,
      aiSkillFit: analysis.skillFit,
      aiRoleFit: analysis.roleFit,
      aiLocationFit: analysis.locationFit,
      aiRequiredSkillsMatched: stringifyJson(analysis.requiredSkillsMatched),
      aiRequiredSkillsMissing: stringifyJson(analysis.requiredSkillsMissing),
      aiPreferredSkillsMatched: stringifyJson(analysis.preferredSkillsMatched),
      aiPreferredSkillsMissing: stringifyJson(analysis.preferredSkillsMissing),
      aiSeniority: analysis.seniority,
      aiIsEarlyCareer: analysis.isEarlyCareer,
      aiRequiresSignificantExperience: analysis.requiresSignificantExperience,
      aiStatus: "ANALYZED",
      aiAnalyzedAt: new Date(),
      aiModel: model,
      aiPromptVersion: currentPromptVersion(),
      aiAnalysisHash: hash,
      aiError: null,
      priorityScore,
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
