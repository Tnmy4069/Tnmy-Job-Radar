import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resetRobotsCacheForTests } from "../discovery/robots";
import { resetThrottleForTests } from "../discovery/throttle";
import { fetchOfficialJobs } from "./official-pipeline";
import type { CompanySource } from "./types";

const originalFetch = globalThis.fetch;

const COMPANY: CompanySource = {
  id: "1",
  name: "Acme",
  slug: "acme",
  careersUrl: "https://careers.example.com/jobs",
  sourceType: "generic",
  sourceConfig: {},
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetThrottleForTests();
  resetRobotsCacheForTests();
  process.env.SOURCE_REQUEST_DELAY_MS = "0";
});

describe("fetchOfficialJobs", () => {
  it("delegates when the careers URL is an official Greenhouse board", async () => {
    process.env.SOURCE_REQUEST_DELAY_MS = "0";
    const requested: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(JSON.stringify({ jobs: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await fetchOfficialJobs({
      ...COMPANY,
      careersUrl: "https://boards.greenhouse.io/acme",
    });
    assert.equal(result.detectedSourceType, "greenhouse");
    assert.ok(requested.some((url) => url.includes("boards-api.greenhouse.io")));
  });

  it("parses JSON-LD from an official careers HTML page", async () => {
    process.env.SOURCE_REQUEST_DELAY_MS = "0";
    const html = `<html><body>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Backend Engineer","url":"https://careers.example.com/jobs/99","description":"<h2>Requirements</h2><p>Go and SQL</p>"}</script>
    </body></html>`;
    globalThis.fetch = (async () => new Response(html, { status: 200 })) as typeof fetch;
    const result = await fetchOfficialJobs(COMPANY);
    assert.equal(result.jobs[0]?.title, "Backend Engineer");
    assert.match(result.jobs[0]?.description ?? "", /Requirements/);
    assert.equal(result.unsupported, undefined);
  });

  it("marks a JS shell as unsupported without inventing jobs", async () => {
    process.env.SOURCE_REQUEST_DELAY_MS = "0";
    const html = `<html><body><div id="root"></div><script src="/app.js"></script></body></html>`;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/robots.txt") || url.includes("sitemap")) {
        return new Response("User-agent: *\nAllow: /\n", { status: 200 });
      }
      return new Response(html, { status: 200 });
    }) as typeof fetch;
    const result = await fetchOfficialJobs(COMPANY);
    assert.equal(result.jobs.length, 0);
    assert.equal(result.jsShell, true);
    assert.equal(result.unsupported, true);
  });
});
