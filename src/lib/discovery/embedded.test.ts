import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractEmbeddedJsonJobs, extractJsonLdJobs, detectJsShell } from "./embedded";
import { mergeDescription, normalizeDescription } from "./description";

const JSON_LD = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer","description":"<h2>Responsibilities</h2><p>Build APIs.</p><h2>Requirements</h2><p>TypeScript.</p>","datePosted":"2026-09-01","url":"https://example.com/jobs/1","jobLocation":{"address":{"addressLocality":"Bengaluru","addressCountry":"India"}}}
</script>
</head><body><div id="root"></div></body></html>`;

const NEXT_DATA = `<html><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobs":[{"title":"Frontend Engineer","applyUrl":"https://example.com/jobs/2","location":"Pune","description":"Work on React"}]}}}</script><div id="__next"></div></html>`;

const JS_SHELL = `<html><body><div id="root"></div><script src="/app.js"></script></body></html>`;

describe("embedded extraction", () => {
  it("reads JSON-LD JobPosting including the full description", () => {
    const jobs = extractJsonLdJobs(JSON_LD, "https://example.com/careers");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].title, "Software Engineer");
    assert.match(jobs[0].description, /Responsibilities/);
    assert.match(jobs[0].description, /Requirements/);
    assert.equal(jobs[0].location, "Bengaluru, India");
  });

  it("walks __NEXT_DATA__ job objects", () => {
    const jobs = extractEmbeddedJsonJobs(NEXT_DATA, "https://example.com/careers");
    assert.ok(jobs.some((job) => job.title === "Frontend Engineer"));
  });

  it("detects a JS-only shell", () => {
    assert.equal(detectJsShell(JS_SHELL), true);
    assert.equal(
      detectJsShell(`<html><body><h1>Careers</h1>${"<p>Software engineer in Bangalore.</p>".repeat(40)}</body></html>`),
      false
    );
  });
});

describe("normalizeDescription", () => {
  it("keeps headings and drops cookie/nav copy", () => {
    const text = normalizeDescription(
      "<p>Accept cookies</p><h2>Responsibilities</h2><p>Ship features.</p><p>Privacy Policy</p>"
    );
    assert.match(text, /Responsibilities/);
    assert.match(text, /Ship features/);
    assert.doesNotMatch(text, /Accept cookies/);
  });

  it("does not replace a stored description with empty or thin text", () => {
    assert.equal(mergeDescription("", "Full role description here"), "Full role description here");
    assert.equal(
      mergeDescription("Short", "A much longer official job description"),
      "A much longer official job description"
    );
  });
});
