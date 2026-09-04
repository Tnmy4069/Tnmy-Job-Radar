import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyHttpBlock, shouldRetryHttpStatus } from "./blocks";

const CAPTCHA_HTML = `<!doctype html>
<html><body>
  <div class="g-recaptcha" data-sitekey="test"></div>
  <p>Why do I have to complete a CAPTCHA?</p>
</body></html>`;

const CLOUDFLARE_HTML = `<!doctype html>
<html><title>Just a moment...</title>
<body>
  <h1>Attention Required! | Cloudflare</h1>
  <div id="cf-spinner" class="cf-browser-verification"></div>
  <script src="/cdn-cgi/challenge-platform/h/b/orchestrate/jsch/v1"></script>
</body></html>`;

const JOBS_HTML = `<!doctype html>
<html><body>
  <h1>Careers</h1>
  <script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>
</body></html>`;

describe("classifyHttpBlock", () => {
  it("classifies 429 as rate limited", () => {
    assert.equal(classifyHttpBlock({ status: 429 }), "RATE_LIMITED");
  });

  it("classifies 401/403 as access denied when the body is not a challenge", () => {
    assert.equal(classifyHttpBlock({ status: 401, body: "Unauthorized" }), "ACCESS_DENIED");
    assert.equal(classifyHttpBlock({ status: 403, body: "Forbidden" }), "ACCESS_DENIED");
  });

  it("classifies CAPTCHA pages even on HTTP 200", () => {
    assert.equal(classifyHttpBlock({ status: 200, body: CAPTCHA_HTML }), "BLOCKED_BY_CAPTCHA");
  });

  it("classifies Cloudflare challenge pages as anti-bot", () => {
    assert.equal(classifyHttpBlock({ status: 403, body: CLOUDFLARE_HTML }), "BLOCKED_BY_ANTIBOT");
    assert.equal(
      classifyHttpBlock({
        status: 403,
        headers: { "cf-mitigated": "challenge" },
      }),
      "BLOCKED_BY_ANTIBOT"
    );
  });

  it("does not treat a normal careers page as blocked", () => {
    assert.equal(classifyHttpBlock({ status: 200, body: JOBS_HTML }), null);
  });

  it("does not retry 401/403 and does retry 429/503", () => {
    assert.equal(shouldRetryHttpStatus(401), false);
    assert.equal(shouldRetryHttpStatus(403), false);
    assert.equal(shouldRetryHttpStatus(429), true);
    assert.equal(shouldRetryHttpStatus(503), true);
    assert.equal(shouldRetryHttpStatus(404), false);
  });
});
