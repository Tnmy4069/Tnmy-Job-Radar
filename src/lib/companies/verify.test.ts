import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOfficialApplicationUrl } from "../discovery/urls";

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
