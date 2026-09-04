import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { browserFetchEnabled } from "./config";

describe("browserFetchEnabled", () => {
  it("is off by default and always off on Vercel", () => {
    const previous = process.env.BROWSER_FETCH_ENABLED;
    const vercel = process.env.VERCEL;
    delete process.env.BROWSER_FETCH_ENABLED;
    delete process.env.VERCEL;
    assert.equal(browserFetchEnabled(), false);

    process.env.BROWSER_FETCH_ENABLED = "true";
    process.env.VERCEL = "1";
    assert.equal(browserFetchEnabled(), false);

    delete process.env.VERCEL;
    process.env.BROWSER_FETCH_ENABLED = "true";
    assert.equal(browserFetchEnabled(), true);

    if (previous == null) delete process.env.BROWSER_FETCH_ENABLED;
    else process.env.BROWSER_FETCH_ENABLED = previous;
    if (vercel == null) delete process.env.VERCEL;
    else process.env.VERCEL = vercel;
  });
});
