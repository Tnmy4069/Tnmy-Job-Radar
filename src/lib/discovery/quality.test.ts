import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectAtsFromHtml, detectAtsFromUrl } from "./ats-detect";
import { rejectJob, extractionConfidence } from "./quality";
import { shouldStopPagination } from "./pagination";
import { filterOfficialJobUrls, parseSitemapXml } from "./sitemap";

describe("ATS detection", () => {
  it("detects official ATS hosts with high confidence", () => {
    assert.equal(detectAtsFromUrl("https://boards.greenhouse.io/acme")?.type, "greenhouse");
    assert.equal(detectAtsFromUrl("https://jobs.lever.co/acme")?.type, "lever");
    assert.equal(detectAtsFromUrl("https://jobs.ashbyhq.com/acme")?.type, "ashby");
    assert.equal(detectAtsFromUrl("https://acme.wd5.myworkdayjobs.com/External")?.type, "workday");
    assert.equal(detectAtsFromUrl("https://jobs.smartrecruiters.com/Acme")?.type, "smartrecruiters");
  });

  it("does not guess from a generic careers URL", () => {
    assert.equal(detectAtsFromUrl("https://careers.example.com/jobs"), null);
  });

  it("detects Greenhouse from page HTML", () => {
    const html = `<iframe src="https://boards.greenhouse.io/embed/job_board?for=stripe"></iframe>`;
    assert.deepEqual(detectAtsFromHtml(html, "https://stripe.com/jobs")?.config, { boardToken: "stripe" });
  });

  it("prefers host-related ATS tokens and ignores unrelated embeds", () => {
    const html = `
      <a href="https://jobs.ashbyhq.com/langfuse">Partner</a>
      <a href="https://jobs.ashbyhq.com/clickhouse">Careers</a>
    `;
    assert.deepEqual(detectAtsFromHtml(html, "https://clickhouse.com/careers")?.config, {
      boardToken: "clickhouse",
    });
    assert.equal(detectAtsFromHtml(html, "https://example.com/careers"), null);
  });
});

describe("quality", () => {
  it("rejects missing title or apply URL but not missing dates", () => {
    assert.equal(rejectJob({ title: "", applicationUrl: "https://x.com/j" }), "missing_title");
    assert.equal(rejectJob({ title: "Eng", applicationUrl: "" }), "missing_application_url");
    assert.equal(rejectJob({ title: "Eng", applicationUrl: "https://acme.com/jobs/1" }), null);
  });

  it("rejects aggregator identities", () => {
    assert.equal(
      rejectJob({
        title: "Eng",
        applicationUrl: "https://indeed.com/viewjob?jk=1",
        hiringOrganization: "Indeed",
        companyName: "Acme",
      }),
      "aggregator_identity"
    );
  });

  it("scores structured methods higher than partial HTML", () => {
    assert.ok(extractionConfidence("api") >= 95);
    assert.ok(extractionConfidence("jsonld") >= 90);
    assert.ok(extractionConfidence("partial") < 70);
  });
});

describe("pagination + sitemap", () => {
  it("stops on repeated ids, empty pages, and max pages", () => {
    const seen = new Set(["a"]);
    assert.equal(shouldStopPagination({ page: 2, batchIds: ["a"], seenIds: seen, batchSize: 1, pageSize: 20 }), true);
    assert.equal(shouldStopPagination({ page: 1, batchIds: [], seenIds: seen, batchSize: 0, pageSize: 20 }), true);
    assert.equal(
      shouldStopPagination({ page: 50, batchIds: ["b"], seenIds: seen, batchSize: 1, pageSize: 20, maxPages: 50 }),
      true
    );
  });

  it("keeps official job-like sitemap URLs", () => {
    const xml = `<?xml version="1.0"?><urlset><url><loc>https://careers.example.com/jobs/123</loc></url><url><loc>https://other.com/jobs/9</loc></url></urlset>`;
    const urls = filterOfficialJobUrls(parseSitemapXml(xml), "https://careers.example.com/");
    assert.deepEqual(urls, ["https://careers.example.com/jobs/123"]);
  });
});
