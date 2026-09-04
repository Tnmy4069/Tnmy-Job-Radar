export type AiMetricsSnapshot = {
  requests: number;
  successes: number;
  failures: number;
  retries: number;
  cacheHits: number;
  rateLimits: number;
  quotaErrors: number;
  timeouts: number;
  tokens: number;
  jobsAnalyzed: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  currentConcurrency: number;
  maxConcurrencyReached: number;
  queueLength: number;
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  quotaExhausted: boolean;
  dailyJobs: number;
  dailyTokens: number;
};

type InternalMetrics = {
  requests: number;
  successes: number;
  failures: number;
  retries: number;
  cacheHits: number;
  rateLimits: number;
  quotaErrors: number;
  timeouts: number;
  tokens: number;
  jobsAnalyzed: number;
  latencies: number[];
  currentConcurrency: number;
  maxConcurrencyReached: number;
  queueLength: number;
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  quotaExhausted: boolean;
  dailyJobs: number;
  dailyTokens: number;
  dailyDate: string;
};

const metrics: InternalMetrics = blankMetrics();

function blankMetrics(): InternalMetrics {
  return {
    requests: 0,
    successes: 0,
    failures: 0,
    retries: 0,
    cacheHits: 0,
    rateLimits: 0,
    quotaErrors: 0,
    timeouts: 0,
    tokens: 0,
    jobsAnalyzed: 0,
    latencies: [],
    currentConcurrency: 0,
    maxConcurrencyReached: 0,
    queueLength: 0,
    circuitState: "CLOSED",
    quotaExhausted: false,
    dailyJobs: 0,
    dailyTokens: 0,
    dailyDate: utcDay(),
  };
}

function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

function rollDaily() {
  const today = utcDay();
  if (metrics.dailyDate !== today) {
    metrics.dailyDate = today;
    metrics.dailyJobs = 0;
    metrics.dailyTokens = 0;
  }
}

export function recordAiRequest() {
  metrics.requests += 1;
}

export function recordAiSuccess(latencyMs: number, tokens = 0, jobCount = 1) {
  rollDaily();
  metrics.successes += 1;
  metrics.jobsAnalyzed += jobCount;
  metrics.tokens += tokens;
  metrics.dailyJobs += jobCount;
  metrics.dailyTokens += tokens;
  metrics.latencies.push(latencyMs);
  if (metrics.latencies.length > 400) metrics.latencies.shift();
}

export function recordAiFailure(kind?: string) {
  metrics.failures += 1;
  if (kind === "rate_limit") metrics.rateLimits += 1;
  if (kind === "quota_exhausted") {
    metrics.quotaErrors += 1;
    metrics.quotaExhausted = true;
  }
  if (kind === "timeout") metrics.timeouts += 1;
}

export function recordAiRetry() {
  metrics.retries += 1;
}

export function recordAiCacheHit() {
  metrics.cacheHits += 1;
}

export function setAiConcurrency(current: number) {
  metrics.currentConcurrency = current;
  metrics.maxConcurrencyReached = Math.max(metrics.maxConcurrencyReached, current);
}

export function setAiQueueLength(length: number) {
  metrics.queueLength = length;
}

export function setAiCircuitState(state: InternalMetrics["circuitState"]) {
  metrics.circuitState = state;
}

export function setQuotaExhausted(value: boolean) {
  metrics.quotaExhausted = value;
}

export function getAiMetrics(): AiMetricsSnapshot {
  rollDaily();
  const sorted = [...metrics.latencies].sort((a, b) => a - b);
  const avg = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  return {
    requests: metrics.requests,
    successes: metrics.successes,
    failures: metrics.failures,
    retries: metrics.retries,
    cacheHits: metrics.cacheHits,
    rateLimits: metrics.rateLimits,
    quotaErrors: metrics.quotaErrors,
    timeouts: metrics.timeouts,
    tokens: metrics.tokens,
    jobsAnalyzed: metrics.jobsAnalyzed,
    averageLatencyMs: avg,
    p95LatencyMs: p95,
    currentConcurrency: metrics.currentConcurrency,
    maxConcurrencyReached: metrics.maxConcurrencyReached,
    queueLength: metrics.queueLength,
    circuitState: metrics.circuitState,
    quotaExhausted: metrics.quotaExhausted,
    dailyJobs: metrics.dailyJobs,
    dailyTokens: metrics.dailyTokens,
  };
}

export function resetAiMetricsForTests() {
  Object.assign(metrics, blankMetrics());
}
