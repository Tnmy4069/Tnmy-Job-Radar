import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { resetRobotsCacheForTests } from "./discovery/robots";
import { resetThrottleForTests } from "./discovery/throttle";
import { HttpError, SourceBlockError, fetchJson, fetchText, fetchWithRetry } from "./http";

const CAPTCHA_HTML = `<html><body><div class="g-recaptcha"></div></body></html>`;
const CF_HTML = `<html><title>Just a moment...</title><body>Checking if the site connection is secure. cloudflare</body></html>`;

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function textResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html", ...headers },
  });
}

beforeEach(() => {
  process.env.SOURCE_REQUEST_DELAY_MS = "0";
  process.env.HTTP_MAX_RETRIES = "2";
  resetThrottleForTests();
  resetRobotsCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetThrottleForTests();
  resetRobotsCacheForTests();
  delete process.env.SOURCE_REQUEST_DELAY_MS;
  delete process.env.HTTP_MAX_RETRIES;
  delete process.env.HTTP_TIMEOUT_MS;
});

describe("fetchWithRetry / fetchJson / fetchText", () => {
  it("retries 429 and honors Retry-After seconds", async () => {
    const calls: string[] = [];
    let n = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      n += 1;
      if (n === 1) return jsonResponse({ error: "slow down" }, 429, { "Retry-After": "0" });
      return jsonResponse({ jobs: [] });
    }) as typeof fetch;

    const data = await fetchJson<{ jobs: unknown[] }>("https://api.example.com/jobs");
    assert.deepEqual(data.jobs, []);
    assert.equal(calls.length, 2);
  });

  it("does not retry 403 or 401", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return textResponse("Forbidden", 403);
    }) as typeof fetch;

    await assert.rejects(
      fetchText("https://careers.example.com/", {}, { respectRobots: false }),
      (error: unknown) => {
        assert.ok(error instanceof SourceBlockError);
        assert.equal(error.reason, "ACCESS_DENIED");
        assert.equal(error.status, 403);
        return true;
      }
    );
    assert.equal(calls, 1);
  });

  it("does not retry CAPTCHA responses", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return textResponse(CAPTCHA_HTML, 200);
    }) as typeof fetch;

    await assert.rejects(
      fetchText("https://careers.example.com/", {}, { respectRobots: false }),
      (error: unknown) => {
        assert.ok(error instanceof SourceBlockError);
        assert.equal(error.reason, "BLOCKED_BY_CAPTCHA");
        return true;
      }
    );
    assert.equal(calls, 1);
  });

  it("classifies Cloudflare challenge HTML as anti-bot", async () => {
    globalThis.fetch = (async () => textResponse(CF_HTML, 403)) as typeof fetch;
    await assert.rejects(
      fetchText("https://careers.example.com/", {}, { respectRobots: false }),
      (error: unknown) => {
        assert.ok(error instanceof SourceBlockError);
        assert.equal(error.reason, "BLOCKED_BY_ANTIBOT");
        return true;
      }
    );
  });

  it("retries timeouts then throws HttpError 408", async () => {
    let calls = 0;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }) as typeof fetch;

    await assert.rejects(
      fetchWithRetry("https://api.example.com/jobs", {}, { timeoutMs: 20, retries: 1, skipThrottle: true }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error.status, 408);
        return true;
      }
    );
    assert.equal(calls, 2);
  });

  it("does not fetch a path disallowed by robots.txt", async () => {
    const requested: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url.endsWith("/robots.txt")) {
        return textResponse("User-agent: *\nDisallow: /secret\n", 200);
      }
      return textResponse("should not be requested", 200);
    }) as typeof fetch;

    await assert.rejects(
      fetchText("https://example.com/secret/jobs"),
      (error: unknown) => {
        assert.ok(error instanceof SourceBlockError);
        assert.equal(error.reason, "ACCESS_DENIED");
        assert.match(error.message, /robots\.txt/);
        return true;
      }
    );
    assert.equal(
      requested.some((url) => url.includes("/secret/jobs")),
      false
    );
  });

  it("skips robots checks for official JSON APIs by default", async () => {
    const requested: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return jsonResponse({ ok: true });
    }) as typeof fetch;
    assert.deepEqual(await fetchJson("https://boards-api.greenhouse.io/v1/boards/acme/jobs"), { ok: true });
    assert.equal(
      requested.includes("https://boards-api.greenhouse.io/robots.txt"),
      false
    );
  });

  it("throws HttpError for empty 404 responses", async () => {
    globalThis.fetch = (async () => textResponse("missing", 404)) as typeof fetch;
    await assert.rejects(
      fetchText("https://example.com/none", {}, { respectRobots: false }),
      (error: unknown) => {
        assert.ok(error instanceof HttpError);
        assert.equal(error instanceof SourceBlockError, false);
        return true;
      }
    );
  });
});
