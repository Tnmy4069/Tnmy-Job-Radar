export class HttpError extends Error {
  status: number;
  url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const DEFAULT_HEADERS = {
  "User-Agent":
    "JobRadar/1.0 (+https://localhost; personal job discovery; respects robots; not a commercial scraper)",
  Accept: "application/json, text/html;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: { retries?: number; timeoutMs?: number; retryOn?: number[] } = {}
): Promise<Response> {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 25_000;
  const retryOn = options.retryOn ?? [408, 425, 429, 500, 502, 503, 504];

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          ...DEFAULT_HEADERS,
          ...(init.headers ?? {}),
        },
      });

      if (retryOn.includes(response.status) && attempt < retries) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : 600 * 2 ** attempt;
        await sleep(wait);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(600 * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options?: { retries?: number; timeoutMs?: number }
): Promise<T> {
  const response = await fetchWithRetry(url, init, options);
  if (!response.ok) {
    throw new HttpError(
      `HTTP ${response.status} ${response.statusText}`,
      response.status,
      url
    );
  }
  return (await response.json()) as T;
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  options?: { retries?: number; timeoutMs?: number }
): Promise<string> {
  const response = await fetchWithRetry(url, init, options);
  if (!response.ok) {
    throw new HttpError(
      `HTTP ${response.status} ${response.statusText}`,
      response.status,
      url
    );
  }
  return response.text();
}
