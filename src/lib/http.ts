import {
  blockReasonMessage,
  classifyHttpBlock,
  shouldRetryHttpStatus,
  type BlockReason,
} from "@/lib/discovery/blocks";
import { JOB_RADAR_HEADERS, httpMaxRetries, httpTimeoutMs, maxRetryAfterMs } from "@/lib/discovery/config";
import { isAllowedByRobots } from "@/lib/discovery/robots";
import { throttleHost } from "@/lib/discovery/throttle";

export class HttpError extends Error {
  status: number;
  url: string;
  blockReason?: BlockReason;

  constructor(message: string, status: number, url: string, blockReason?: BlockReason) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
    this.blockReason = blockReason;
  }
}

export class SourceBlockError extends HttpError {
  reason: BlockReason;

  constructor(message: string, status: number, url: string, reason: BlockReason) {
    super(message, status, url, reason);
    this.name = "SourceBlockError";
    this.reason = reason;
  }
}

export type FetchRetryOptions = {
  retries?: number;
  timeoutMs?: number;
  retryOn?: number[];
  /** HTML/sitemap/browser fetches should set this. Official JSON APIs leave it false. */
  respectRobots?: boolean;
  skipThrottle?: boolean;
};

const TRANSIENT_STATUS = [408, 425, 429, 500, 502, 503, 504];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, maxRetryAfterMs());
  }
  const date = Date.parse(header);
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(date - Date.now(), 0), maxRetryAfterMs());
  }
  return null;
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  return parseRetryAfterMs(retryAfter) ?? 600 * 2 ** attempt;
}

function throwIfBlocked(url: string, response: Response, body: string) {
  const reason = classifyHttpBlock({
    status: response.status,
    body,
    headers: response.headers,
  });
  if (!reason) return;
  throw new SourceBlockError(`${blockReasonMessage(reason)}: ${url}`, response.status, url, reason);
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {}
): Promise<Response> {
  const retries = options.retries ?? httpMaxRetries();
  const timeoutMs = options.timeoutMs ?? httpTimeoutMs();
  const retryOn = options.retryOn ?? TRANSIENT_STATUS;

  if (options.respectRobots) {
    const allowed = await isAllowedByRobots(url);
    if (!allowed) {
      throw new SourceBlockError(`Disallowed by robots.txt: ${url}`, 403, url, "ACCESS_DENIED");
    }
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (!options.skipThrottle) {
      await throttleHost(url);
    }

    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (init.signal) {
      if (init.signal.aborted) controller.abort();
      else init.signal.addEventListener("abort", onAbort, { once: true });
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...JOB_RADAR_HEADERS,
          ...(init.headers ?? {}),
        },
      });

      const blocked = classifyHttpBlock({
        status: response.status,
        headers: response.headers,
      });
      const retryable =
        retryOn.includes(response.status) &&
        shouldRetryHttpStatus(response.status) &&
        blocked !== "BLOCKED_BY_CAPTCHA" &&
        blocked !== "BLOCKED_BY_ANTIBOT" &&
        blocked !== "ACCESS_DENIED";

      if (retryable && attempt < retries) {
        await sleep(backoffMs(attempt, response.headers.get("retry-after")));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const aborted = error instanceof Error && error.name === "AbortError";
      const retryNetwork = aborted || error instanceof TypeError;
      if (retryNetwork && attempt < retries) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      if (aborted) {
        throw new HttpError(`Request timed out after ${timeoutMs}ms`, 408, url);
      }
      throw error instanceof Error ? error : new Error("Request failed");
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", onAbort);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, init, { ...options, respectRobots: options.respectRobots ?? false });
  const text = await response.text();
  throwIfBlocked(url, response, text);
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status} ${response.statusText}`, response.status, url);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(`Invalid JSON from ${url}`, response.status, url);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  options: FetchRetryOptions = {}
): Promise<string> {
  const response = await fetchWithRetry(url, init, { ...options, respectRobots: options.respectRobots ?? true });
  const text = await response.text();
  throwIfBlocked(url, response, text);
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status} ${response.statusText}`, response.status, url);
  }
  return text;
}
