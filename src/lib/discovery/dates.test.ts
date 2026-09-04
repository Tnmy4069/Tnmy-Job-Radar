import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJobDate } from "./dates";

const NOW = new Date("2026-09-04T12:00:00.000Z");

describe("parseJobDate", () => {
  it("parses ISO dates", () => {
    const date = parseJobDate("2026-09-04T08:30:00.000Z", NOW);
    assert.ok(date);
    assert.equal(date.toISOString(), "2026-09-04T08:30:00.000Z");
  });

  it("parses millisecond and second timestamps", () => {
    const ms = Date.parse("2026-09-04T00:00:00.000Z");
    assert.equal(parseJobDate(ms, NOW)?.toISOString(), "2026-09-04T00:00:00.000Z");
    assert.equal(parseJobDate(Math.floor(ms / 1000), NOW)?.toISOString(), "2026-09-04T00:00:00.000Z");
  });

  it("parses relative posted strings", () => {
    assert.equal(parseJobDate("Posted today", NOW)?.toISOString().slice(0, 10), "2026-09-04");
    assert.equal(parseJobDate("Posted yesterday", NOW)?.toISOString().slice(0, 10), "2026-09-03");
    assert.equal(parseJobDate("3 days ago", NOW)?.toISOString().slice(0, 10), "2026-09-01");
    assert.equal(parseJobDate("1 week ago", NOW)?.toISOString().slice(0, 10), "2026-08-28");
  });

  it("parses named calendar dates", () => {
    assert.equal(parseJobDate("Sep 4, 2026", NOW)?.toISOString().slice(0, 10), "2026-09-04");
    assert.equal(parseJobDate("September 4, 2026", NOW)?.toISOString().slice(0, 10), "2026-09-04");
  });

  it("returns null instead of inventing a date", () => {
    assert.equal(parseJobDate("recently", NOW), null);
    assert.equal(parseJobDate("", NOW), null);
    assert.equal(parseJobDate(null, NOW), null);
  });
});
