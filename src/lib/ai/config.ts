function envString(name: string, fallback = ""): string {
  const value = process.env[name];
  return value == null || value.trim() === "" ? fallback : value.trim();
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value == null || value.trim() === "") return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Accepts GEMINI_API_KEY and the nonstandard GEMINI_API_Key alias. Never log the value. */
export function geminiApiKey(): string {
  return envString("GEMINI_API_KEY") || envString("GEMINI_API_Key");
}

export function geminiEnabled(): boolean {
  if (!envBool("GEMINI_ENABLED", true)) return false;
  return geminiApiKey().length > 0;
}

export function geminiModel(): string {
  return envString("GEMINI_MODEL", "gemini-3.5-flash-lite");
}

export function geminiFallbackModel(): string {
  return envString("GEMINI_FALLBACK_MODEL");
}

export function geminiMinScore(): number {
  return clamp(envNumber("GEMINI_MIN_SCORE", 70), 0, 100);
}

export function geminiMaxConcurrency(): number {
  return clamp(envNumber("GEMINI_MAX_CONCURRENCY", 10), 1, 20);
}

export function geminiInitialConcurrency(): number {
  return clamp(envNumber("GEMINI_INITIAL_CONCURRENCY", 5), 1, geminiMaxConcurrency());
}

export function geminiMaxRetries(): number {
  return clamp(envNumber("GEMINI_MAX_RETRIES", 3), 0, 6);
}

export function geminiBatchSize(): number {
  return clamp(envNumber("GEMINI_BATCH_SIZE", 5), 1, 10);
}

export function geminiTimeoutMs(): number {
  return clamp(envNumber("GEMINI_TIMEOUT_MS", 30_000), 5_000, 120_000);
}

export function geminiDailyMaxJobs(): number | null {
  const value = envNumber("GEMINI_DAILY_MAX_JOBS", 0);
  return value > 0 ? value : null;
}

export function geminiDailyMaxTokens(): number | null {
  const value = envNumber("GEMINI_DAILY_MAX_TOKENS", 0);
  return value > 0 ? value : null;
}

export function candidateProfileVersion(): string {
  return envString("CANDIDATE_PROFILE_VERSION", "1");
}

export function aiPromptVersion(): string {
  return envString("GEMINI_PROMPT_VERSION", "job-fit-v1");
}

export function priorityWeights() {
  const ai = envNumber("PRIORITY_AI_WEIGHT", 0.5);
  const rule = envNumber("PRIORITY_RULE_WEIGHT", 0.3);
  const freshness = envNumber("PRIORITY_FRESHNESS_WEIGHT", 0.2);
  const sum = ai + rule + freshness;
  if (sum <= 0) return { ai: 0.5, rule: 0.3, freshness: 0.2 };
  return { ai: ai / sum, rule: rule / sum, freshness: freshness / sum };
}

export function batchRequestCap(): number {
  return clamp(envNumber("GEMINI_MANUAL_BATCH_CAP", 25), 1, 50);
}

export const AI_CIRCUIT_FAILURE_THRESHOLD = 5;
export const AI_CIRCUIT_COOLDOWN_MS = 30_000;
export const AI_MAX_BACKOFF_MS = 16_000;
