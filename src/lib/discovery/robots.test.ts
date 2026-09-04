import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUrlAllowedByRobotsFile, parseRobotsTxt } from "./robots";

const SAMPLE = `User-agent: *
Disallow: /search
Disallow: /private
Allow: /careers
Sitemap: https://example.com/sitemap.xml

User-agent: JobRadar
Disallow:
`;

describe("robots.txt", () => {
  it("parses sitemap and disallow rules for *", () => {
    const file = parseRobotsTxt(SAMPLE);
    assert.deepEqual(file.sitemaps, ["https://example.com/sitemap.xml"]);
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/search?q=eng", file, "Mozilla"), false);
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/private/jobs", file, "Mozilla"), false);
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/careers", file, "Mozilla"), true);
  });

  it("uses the JobRadar group when present", () => {
    const file = parseRobotsTxt(SAMPLE);
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/search", file, "JobRadar/1.0"), true);
  });

  it("treats Disallow: / as deny-all and a more specific Allow as an exception", () => {
    const file = parseRobotsTxt(`User-agent: *\nDisallow: /\nAllow: /jobs\n`);
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/about", file), false);
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/jobs/123", file), true);
  });

  it("allows everything when robots is empty", () => {
    const file = parseRobotsTxt("");
    assert.equal(isUrlAllowedByRobotsFile("https://example.com/anything", file), true);
  });
});
