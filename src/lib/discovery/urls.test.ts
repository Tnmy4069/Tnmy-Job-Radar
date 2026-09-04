import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jobFingerprint } from "../hash";
import { isOfficialApplicationUrl, normalizeApplicationUrl } from "./urls";

describe("normalizeApplicationUrl", () => {
  it("strips tracking params, fragments, and trailing slashes", () => {
    assert.equal(
      normalizeApplicationUrl("https://Careers.Example.com/jobs/123/?utm_source=x&fbclid=1#top"),
      "https://careers.example.com/jobs/123"
    );
  });

  it("keeps meaningful query params", () => {
    assert.equal(
      normalizeApplicationUrl("https://jobs.example.com/apply?gh_jid=99"),
      "https://jobs.example.com/apply?gh_jid=99"
    );
  });
});

describe("isOfficialApplicationUrl", () => {
  it("accepts official company and ATS URLs", () => {
    assert.equal(isOfficialApplicationUrl("https://boards.greenhouse.io/stripe/jobs/1"), true);
    assert.equal(isOfficialApplicationUrl("https://www.amazon.jobs/en/jobs/123"), true);
  });

  it("rejects aggregator URLs", () => {
    assert.equal(isOfficialApplicationUrl("https://www.indeed.com/viewjob?jk=1"), false);
    assert.equal(isOfficialApplicationUrl("https://www.linkedin.com/jobs/view/1"), false);
  });
});
describe("jobFingerprint", () => {
  it("uses the normalized URL when there is no external id", () => {
    const a = jobFingerprint({
      company: "acme",
      title: "Engineer",
      location: "Bangalore",
      applicationUrl: "https://jobs.acme.com/x?utm_campaign=ads",
    });
    const b = jobFingerprint({
      company: "acme",
      title: "Engineer",
      location: "Bangalore",
      applicationUrl: "https://jobs.acme.com/x/",
    });
    assert.equal(a, b);
  });
});
