export const JOB_RADAR_HEADERS = {
  "User-Agent":
    "JobRadar/1.0 (+https://localhost; personal job discovery; respects robots; not a commercial scraper)",
  Accept: "application/json, text/html;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** HTTP fetch timeout. Spec range: 15–30 seconds. */
export function httpTimeoutMs(): number {
  return clamp(envNumber("HTTP_TIMEOUT_MS", 20_000), 15_000, 30_000);
}

/** Browser-rendered page timeout. Spec range: 30–60 seconds. */
export function browserTimeoutMs(): number {
  return clamp(envNumber("BROWSER_TIMEOUT_MS", 45_000), 30_000, 60_000);
}

/** Delay between requests to the same host. */
export function sourceRequestDelayMs(): number {
  return Math.max(0, envNumber("SOURCE_REQUEST_DELAY_MS", 500));
}

/** Extra attempts after the first try for transient failures. */
export function httpMaxRetries(): number {
  return clamp(envNumber("HTTP_MAX_RETRIES", 2), 0, 5);
}

/** Wall clock for one company so a hung source cannot stall the scan. */
export function companyScanTimeoutMs(): number {
  return Math.max(15_000, envNumber("COMPANY_SCAN_TIMEOUT_MS", 90_000));
}

export function maxRetryAfterMs(): number {
  return clamp(envNumber("HTTP_MAX_RETRY_AFTER_MS", 60_000), 1_000, 120_000);
}

export function maxPagesPerSource(): number {
  return clamp(envNumber("MAX_PAGES_PER_SOURCE", 50), 1, 200);
}

export function maxDetailPagesPerSource(): number {
  return clamp(envNumber("MAX_DETAIL_PAGES_PER_SOURCE", 40), 0, 80);
}

export function browserFetchEnabled(): boolean {
  if (process.env.VERCEL) return false;
  const value = (process.env.BROWSER_FETCH_ENABLED ?? "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
