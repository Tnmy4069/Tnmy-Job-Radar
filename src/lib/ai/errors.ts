import { InvalidAiResponseError } from "./schema";

export type GeminiFailureKind =
  | "rate_limit"
  | "quota_exhausted"
  | "timeout"
  | "server"
  | "network"
  | "invalid_response"
  | "disabled"
  | "missing_key"
  | "unknown";

export class GeminiError extends Error {
  readonly kind: GeminiFailureKind;
  readonly status: number | null;
  readonly retryAfterMs: number | null;
  readonly transient: boolean;
  readonly quotaExhausted: boolean;

  constructor(
    message: string,
    options: {
      kind: GeminiFailureKind;
      status?: number | null;
      retryAfterMs?: number | null;
      transient?: boolean;
      quotaExhausted?: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "GeminiError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.quotaExhausted = options.quotaExhausted ?? options.kind === "quota_exhausted";
    this.transient =
      options.transient ??
      (options.kind === "rate_limit" ||
        options.kind === "timeout" ||
        options.kind === "server" ||
        options.kind === "network");
  }
}

export function parseRetryAfterMs(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1000 ? Math.round(value) : Math.round(value * 1000);
  }
  const text = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    return Math.round(Number(text) * 1000);
  }
  const date = Date.parse(text);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

export function classifyGeminiError(error: unknown): GeminiError {
  if (error instanceof GeminiError) return error;
  if (error instanceof InvalidAiResponseError) {
    return new GeminiError(error.message, { kind: "invalid_response", transient: false, cause: error });
  }

  const status = extractStatus(error);
  const message = extractMessage(error);
  const lower = message.toLowerCase();
  let retryAfterMs = parseRetryAfterMs(extractRetryAfter(error));
  const retryIn = lower.match(/retry in (\d+(?:\.\d+)?)\s*s/);
  if (retryAfterMs == null && retryIn) {
    retryAfterMs = Math.round(Number(retryIn[1]) * 1000);
  }
  const quotaPerDay = /perday|per_day|rpd|free_tier_requests|GenerateRequestsPerDay/i.test(message);
  const quota =
    quotaPerDay ||
    (/quota|billing|resource.?exhausted|exceeded your current quota|daily.?limit|monthly.?limit/i.test(message) &&
      !/rate.?limit|too many requests|per minute|tokens per minute/i.test(message));

  if (error instanceof Error && error.name === "AbortError") {
    return new GeminiError("Gemini request timed out", { kind: "timeout", status, transient: true, cause: error });
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return new GeminiError(message || "Gemini request timed out", {
      kind: "timeout",
      status,
      transient: true,
      cause: error,
    });
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(message)) {
    if (quota) {
      return new GeminiError(message || "Gemini quota exhausted", {
        kind: "quota_exhausted",
        status: status ?? 429,
        retryAfterMs,
        quotaExhausted: true,
        transient: false,
        cause: error,
      });
    }
    return new GeminiError(message || "Gemini rate limited", {
      kind: "rate_limit",
      status: status ?? 429,
      retryAfterMs,
      transient: true,
      cause: error,
    });
  }
  if (quota || (status === 403 && /quota/i.test(message))) {
    return new GeminiError(message || "Gemini quota exhausted", {
      kind: "quota_exhausted",
      status,
      retryAfterMs,
      quotaExhausted: true,
      transient: false,
      cause: error,
    });
  }
  if (status === 408 || status === 500 || status === 502 || status === 503 || status === 504) {
    return new GeminiError(message || `Gemini HTTP ${status}`, {
      kind: "server",
      status,
      retryAfterMs,
      transient: true,
      cause: error,
    });
  }
  if (/fetch failed|network|econnreset|enotfound|socket/i.test(message)) {
    return new GeminiError(message || "Gemini network error", {
      kind: "network",
      transient: true,
      cause: error,
    });
  }
  return new GeminiError(message || "Gemini request failed", {
    kind: "unknown",
    status,
    transient: false,
    cause: error,
  });
}

export function backoffMs(attempt: number, retryAfterMs?: number | null): number {
  if (retryAfterMs && retryAfterMs > 0) return Math.min(retryAfterMs, 60_000);
  const exp = Math.min(16_000, 1000 * 2 ** Math.max(0, attempt));
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

function extractStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  for (const key of ["status", "statusCode", "code"]) {
    const value = record[key];
    if (typeof value === "number" && value >= 100 && value < 600) return value;
    if (typeof value === "string" && /^\d{3}$/.test(value)) return Number(value);
  }
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const code = (nested as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  return null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

function extractRetryAfter(error: unknown): string | number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  if (record.retryAfter != null) return record.retryAfter as string | number;
  if (record.retryAfterMs != null) return record.retryAfterMs as string | number;
  const headers = record.headers as Record<string, string> | undefined;
  if (headers) {
    return headers["retry-after"] ?? headers["Retry-After"] ?? null;
  }
  return null;
}
