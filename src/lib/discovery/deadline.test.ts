import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DeadlineError, withDeadline } from "./deadline";

describe("withDeadline", () => {
  it("returns the function result when it finishes in time", async () => {
    assert.equal(await withDeadline(200, async () => 7), 7);
  });

  it("rejects when the function exceeds the wall clock", async () => {
    await assert.rejects(
      withDeadline(
        30,
        () => new Promise((resolve) => setTimeout(() => resolve("late"), 200)),
        "company timed out"
      ),
      (error: unknown) => {
        assert.ok(error instanceof DeadlineError);
        assert.equal((error as DeadlineError).message, "company timed out");
        return true;
      }
    );
  });
});
