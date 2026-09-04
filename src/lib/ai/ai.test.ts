import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { parseBatchedJobAnalysis, parseJobAnalysis, InvalidAiResponseError } from "./schema";
import { computeAiAnalysisHash } from "./hash";
import { computePriorityScore, freshnessScore } from "./priority";
import { classifyGeminiError, GeminiError, parseRetryAfterMs } from "./errors";
import { canDispatchAiRequest, getCircuitState, recordCircuitFailure, recordCircuitSuccess, resetCircuitForTests } from "./circuit";
import { resetAiMetricsForTests, recordAiSuccess, getAiMetrics, recordAiCacheHit } from "./metrics";
import { disagreementFlag } from "./disagreement";
import { normalizeJobDescription } from "./description";
import { GEMINI_SYSTEM_INSTRUCTION } from "./prompt";
import { setGeminiTransportForTests } from "./client";
import { analyzeJob, isEligibleForAutoAnalysis, jobAnalysisHash, type AnalyzableJob } from "./analyze";
import { runPostScanAi } from "./scan-hook";
import { resetCandidateProfileCacheForTests } from "./profile";
import { geminiApiKey, geminiEnabled } from "./config";

function sampleAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    fitScore: 92,
    recommendation: "APPLY_NOW",
    summary: "Strong early-career full-stack match.",
    strengths: ["TypeScript", "React", "Node.js"],
    gaps: ["Kubernetes"],
    concerns: [],
    reasoning: "Title and requirements align with a 0-2 year software engineer.",
    experienceFit: "excellent",
    skillFit: "excellent",
    roleFit: "excellent",
    locationFit: "excellent",
    isEarlyCareer: true,
    requiresSignificantExperience: false,
    requiredSkillsMatched: ["TypeScript", "React"],
    requiredSkillsMissing: [],
    preferredSkillsMatched: [],
    preferredSkillsMissing: ["Kubernetes"],
    seniority: "entry",
    ...overrides,
  };
}

function sampleJob(overrides: Partial<AnalyzableJob> = {}): AnalyzableJob {
  return {
    id: "job-1",
    title: "Software Engineer I",
    description: "Build APIs with TypeScript and React. 0-2 years experience. Internships are a plus.",
    location: "Bengaluru, India",
    employmentType: "full-time",
    skills: JSON.stringify(["TypeScript", "React"]),
    postedAt: new Date(),
    relevanceScore: 88,
    matchReasons: JSON.stringify(["Software Engineer title"]),
    isActive: true,
    isRelevant: true,
    aiStatus: "NOT_ANALYZED",
    aiAnalysisHash: null,
    aiFitScore: null,
    company: { name: "Example", priority: "A" },
    ...overrides,
  };
}

const envKeys = [
  "GEMINI_API_KEY",
  "GEMINI_API_Key",
  "GEMINI_ENABLED",
  "GEMINI_MIN_SCORE",
  "GEMINI_MAX_RETRIES",
  "GEMINI_DAILY_MAX_JOBS",
  "CANDIDATE_PROFILE_VERSION",
];
const envBackup = new Map<string, string | undefined>();

function setEnv(key: string, value: string | undefined) {
  if (!envBackup.has(key)) envBackup.set(key, process.env[key]);
  if (value == null) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const key of envKeys) {
    if (!envBackup.has(key)) continue;
    const prev = envBackup.get(key);
    if (prev == null) delete process.env[key];
    else process.env[key] = prev;
  }
  envBackup.clear();
  setGeminiTransportForTests(null);
  resetAiMetricsForTests();
  resetCircuitForTests();
  resetCandidateProfileCacheForTests();
});

describe("Gemini env", () => {
  it("reads GEMINI_API_Key as well as GEMINI_API_KEY", () => {
    setEnv("GEMINI_API_KEY", undefined);
    setEnv("GEMINI_API_Key", "alias-key");
    assert.equal(geminiApiKey(), "alias-key");
    assert.equal(geminiEnabled(), true);
  });
});

describe("Gemini structured response", () => {
  it("accepts a valid analysis object", () => {
    const parsed = parseJobAnalysis(JSON.stringify(sampleAnalysis()));
    assert.equal(parsed.fitScore, 92);
    assert.equal(parsed.recommendation, "APPLY_NOW");
    assert.equal(parsed.seniority, "entry");
  });

  it("rejects invalid enums and scores", () => {
    assert.throws(
      () => parseJobAnalysis(JSON.stringify(sampleAnalysis({ recommendation: "HIRE_NOW", fitScore: 140 }))),
      InvalidAiResponseError
    );
  });

  it("keeps valid batch rows when one job fails validation", () => {
    const parsed = parseBatchedJobAnalysis(
      JSON.stringify({
        results: [
          { jobId: "a", ...sampleAnalysis() },
          { jobId: "b", fitScore: 12 },
        ],
      })
    );
    assert.equal(parsed.valid.length, 1);
    assert.equal(parsed.valid[0].jobId, "a");
    assert.deepEqual(parsed.invalid, ["b"]);
  });
});

describe("AI cache hash", () => {
  it("stays stable for unchanged job+profile+prompt", () => {
    const a = computeAiAnalysisHash({
      jobId: "1",
      title: "SDE",
      description: "Build APIs",
      skills: ["TypeScript"],
      location: "Pune",
      employmentType: "full-time",
      candidateProfileVersion: "1",
      promptVersion: "job-fit-v1",
    });
    const b = computeAiAnalysisHash({
      jobId: "1",
      title: "SDE",
      description: "Build APIs",
      skills: ["TypeScript"],
      location: "Pune",
      employmentType: "full-time",
      candidateProfileVersion: "1",
      promptVersion: "job-fit-v1",
    });
    assert.equal(a, b);
  });

  it("changes when the description changes", () => {
    const a = computeAiAnalysisHash({
      jobId: "1",
      title: "SDE",
      description: "Build APIs",
      skills: [],
      location: "Pune",
      employmentType: "full-time",
      candidateProfileVersion: "1",
      promptVersion: "job-fit-v1",
    });
    const b = computeAiAnalysisHash({
      jobId: "1",
      title: "SDE",
      description: "Build APIs and lead a team of 12",
      skills: [],
      location: "Pune",
      employmentType: "full-time",
      candidateProfileVersion: "1",
      promptVersion: "job-fit-v1",
    });
    assert.notEqual(a, b);
  });

  it("changes when the candidate profile version changes", () => {
    const a = computeAiAnalysisHash({
      jobId: "1",
      title: "SDE",
      description: "x",
      skills: [],
      location: "Pune",
      employmentType: "full-time",
      candidateProfileVersion: "1",
      promptVersion: "job-fit-v1",
    });
    const b = computeAiAnalysisHash({
      jobId: "1",
      title: "SDE",
      description: "x",
      skills: [],
      location: "Pune",
      employmentType: "full-time",
      candidateProfileVersion: "2",
      promptVersion: "job-fit-v1",
    });
    assert.notEqual(a, b);
  });
});

describe("priority and freshness", () => {
  it("does not invent freshness when postedAt is missing", () => {
    assert.equal(freshnessScore(null), 0);
  });

  it("combines AI, rule, and freshness scores", () => {
    const score = computePriorityScore({
      aiFitScore: 90,
      relevanceScore: 80,
      postedAt: new Date(),
    });
    assert.ok(score > 80);
    assert.ok(score <= 100);
  });
});

describe("Gemini errors", () => {
  it("classifies 429 with Retry-After as a rate limit", () => {
    const error = classifyGeminiError({
      status: 429,
      message: "Too many requests",
      headers: { "retry-after": "2" },
    });
    assert.equal(error.kind, "rate_limit");
    assert.equal(error.transient, true);
    assert.equal(parseRetryAfterMs("2"), 2000);
    assert.equal(error.retryAfterMs, 2000);
  });

  it("classifies quota exhaustion without retrying forever", () => {
    const error = classifyGeminiError({
      status: 429,
      message: "You exceeded your current quota for this project",
    });
    assert.equal(error.kind, "quota_exhausted");
    assert.equal(error.transient, false);
  });

  it("classifies 500, 503, and timeouts as transient", () => {
    assert.equal(classifyGeminiError({ status: 500, message: "boom" }).kind, "server");
    assert.equal(classifyGeminiError({ status: 503, message: "unavailable" }).kind, "server");
    assert.equal(classifyGeminiError(new GeminiError("timed out", { kind: "timeout" })).kind, "timeout");
  });
});

describe("circuit breaker", () => {
  it("opens after repeated failures and recovers on success", () => {
    for (let i = 0; i < 5; i++) recordCircuitFailure();
    assert.equal(getCircuitState(), "OPEN");
    assert.equal(canDispatchAiRequest(), false);
    resetCircuitForTests();
    recordCircuitSuccess();
    assert.equal(getCircuitState(), "CLOSED");
    assert.equal(canDispatchAiRequest(), true);
  });
});

describe("analyzeJob", () => {
  it("skips when Gemini is disabled", async () => {
    setEnv("GEMINI_ENABLED", "false");
    setEnv("GEMINI_API_KEY", "test-key");
    const result = await analyzeJob(sampleJob(), { persist: false });
    assert.equal(result.skipped, "disabled");
  });

  it("skips jobs below the AI threshold", async () => {
    setEnv("GEMINI_ENABLED", "true");
    setEnv("GEMINI_API_KEY", "test-key");
    setEnv("GEMINI_MIN_SCORE", "70");
    const job = sampleJob({ relevanceScore: 40, isRelevant: true });
    assert.equal(isEligibleForAutoAnalysis(job), false);
    const result = await analyzeJob(job, { persist: false });
    assert.equal(result.skipped, "below_threshold");
  });

  it("returns a cache hit when the analysis hash is unchanged", async () => {
    setEnv("GEMINI_API_KEY", "test-key");
    const job = sampleJob({ aiStatus: "ANALYZED", aiFitScore: 91 });
    const hash = jobAnalysisHash(job);
    const result = await analyzeJob({ ...job, aiAnalysisHash: hash }, { persist: false });
    assert.equal(result.cacheHit, true);
    assert.equal(getAiMetrics().cacheHits, 1);
  });

  it("parses a successful Gemini response", async () => {
    setEnv("GEMINI_API_KEY", "test-key");
    setEnv("GEMINI_ENABLED", "true");
    setGeminiTransportForTests({
      async generate() {
        return { text: JSON.stringify(sampleAnalysis()), model: "gemini-2.5-flash", tokens: 120 };
      },
    });
    const result = await analyzeJob(sampleJob(), { persist: false, overrideThreshold: true });
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.cacheHit, false);
    assert.equal(result.analysis?.recommendation, "APPLY_NOW");
    assert.equal(result.analysis?.fitScore, 92);
  });

  it("retries a transient 429 then succeeds", async () => {
    setEnv("GEMINI_API_KEY", "test-key");
    setEnv("GEMINI_MAX_RETRIES", "1");
    let calls = 0;
    setGeminiTransportForTests({
      async generate() {
        calls += 1;
        if (calls === 1) {
          throw { status: 429, message: "Too many requests", headers: { "retry-after": "0" } };
        }
        return { text: JSON.stringify(sampleAnalysis()), model: "gemini-2.5-flash", tokens: 10 };
      },
    });
    const result = await analyzeJob(sampleJob(), { persist: false, overrideThreshold: true });
    assert.equal(calls, 2);
    assert.equal(result.analysis?.fitScore, 92);
  });

  it("does not retry quota exhaustion", async () => {
    setEnv("GEMINI_API_KEY", "test-key");
    setEnv("GEMINI_MAX_RETRIES", "3");
    let calls = 0;
    setGeminiTransportForTests({
      async generate() {
        calls += 1;
        throw { status: 429, message: "You exceeded your current quota" };
      },
    });
    const result = await analyzeJob(sampleJob(), { persist: false, overrideThreshold: true });
    assert.equal(calls, 1);
    assert.match(result.error ?? "", /quota/i);
  });

  it("handles 500 and timeout without throwing out of analyzeJob", async () => {
    setEnv("GEMINI_API_KEY", "test-key");
    setEnv("GEMINI_MAX_RETRIES", "0");
    setGeminiTransportForTests({
      async generate() {
        throw { status: 500, message: "internal" };
      },
    });
    const failed = await analyzeJob(sampleJob(), { persist: false, overrideThreshold: true });
    assert.ok(failed.error);

    setGeminiTransportForTests({
      async generate() {
        throw new GeminiError("Gemini request timed out", { kind: "timeout" });
      },
    });
    const timeout = await analyzeJob(sampleJob(), { persist: false, overrideThreshold: true });
    assert.ok(timeout.error);
  });

  it("processes independent jobs concurrently", async () => {
    setEnv("GEMINI_API_KEY", "test-key");
    let inFlight = 0;
    let max = 0;
    setGeminiTransportForTests({
      async generate() {
        inFlight += 1;
        max = Math.max(max, inFlight);
        await new Promise((r) => setTimeout(r, 40));
        inFlight -= 1;
        return { text: JSON.stringify(sampleAnalysis()), model: "test", tokens: 1 };
      },
    });
    const jobs = [sampleJob({ id: "a" }), sampleJob({ id: "b" }), sampleJob({ id: "c" })];
    await Promise.all(jobs.map((job) => analyzeJob(job, { persist: false, overrideThreshold: true })));
    assert.ok(max >= 2);
  });
});

describe("quality guardrails", () => {
  it("prompt distinguishes internship mentions from internship jobs", () => {
    assert.match(GEMINI_SYSTEM_INSTRUCTION, /internship/i);
    assert.match(GEMINI_SYSTEM_INSTRUCTION, /preferred experience/i);
  });

  it("prompt treats support and senior roles conservatively", () => {
    assert.match(GEMINI_SYSTEM_INSTRUCTION, /Technical Support Engineer/);
    assert.match(GEMINI_SYSTEM_INSTRUCTION, /Staff/);
  });

  it("required vs preferred skills are separate fields", () => {
    const parsed = parseJobAnalysis(
      JSON.stringify(
        sampleAnalysis({
          requiredSkillsMissing: ["TypeScript"],
          preferredSkillsMissing: ["Kubernetes"],
          fitScore: 78,
          recommendation: "CONSIDER",
        })
      )
    );
    assert.deepEqual(parsed.requiredSkillsMissing, ["TypeScript"]);
    assert.deepEqual(parsed.preferredSkillsMissing, ["Kubernetes"]);
  });
});

describe("description truncation", () => {
  it("keeps requirements instead of only the opening paragraph", () => {
    const text = `${"About the company. ".repeat(400)}\nRequirements\nMust know TypeScript and React\nPreferred\nKubernetes`;
    const out = normalizeJobDescription(text);
    assert.match(out, /TypeScript/);
    assert.ok(out.length <= 7000);
  });
});

describe("disagreement", () => {
  it("flags large AI vs rule gaps", () => {
    assert.equal(disagreementFlag(55, 91), "REVIEW_RULE_ENGINE");
    assert.equal(disagreementFlag(88, 61), "POSSIBLE_FALSE_NEGATIVE");
    assert.equal(disagreementFlag(80, 78), null);
  });
});

describe("scanner isolation", () => {
  it("post-scan AI failures do not throw", async () => {
    setEnv("GEMINI_ENABLED", "false");
    await runPostScanAi();
  });
});

describe("metrics", () => {
  it("records cache hits and latency", () => {
    recordAiCacheHit();
    recordAiSuccess(1800, 40, 1);
    const snap = getAiMetrics();
    assert.equal(snap.cacheHits, 1);
    assert.equal(snap.averageLatencyMs, 1800);
  });
});
