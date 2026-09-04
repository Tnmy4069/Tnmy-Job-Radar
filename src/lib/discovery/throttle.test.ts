import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { resetThrottleForTests, throttleHost } from "./throttle";

afterEach(() => {
  resetThrottleForTests();
  delete process.env.SOURCE_REQUEST_DELAY_MS;
});

describe("throttleHost", () => {
  it("spaces requests to the same host", async () => {
    process.env.SOURCE_REQUEST_DELAY_MS = "40";
    const started = Date.now();
    await throttleHost("https://jobs.example.com/a");
    await throttleHost("https://jobs.example.com/b");
    assert.ok(Date.now() - started >= 35);
  });

  it("does not delay when SOURCE_REQUEST_DELAY_MS is 0", async () => {
    process.env.SOURCE_REQUEST_DELAY_MS = "0";
    const started = Date.now();
    await throttleHost("https://jobs.example.com/a");
    await throttleHost("https://jobs.example.com/b");
    assert.ok(Date.now() - started < 30);
  });
});
