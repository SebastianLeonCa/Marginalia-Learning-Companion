import assert from "node:assert/strict";
import test from "node:test";
import { mostRecentlyOpenedDocument } from "./reading-progress.ts";

test("ignores unopened documents when choosing where to continue", () => {
  const latest = mostRecentlyOpenedDocument([
    { id: "never-opened", lastOpenedAt: null },
    { id: "older", lastOpenedAt: new Date("2026-09-18T10:00:00Z") },
    { id: "newer", lastOpenedAt: new Date("2026-09-19T10:00:00Z") },
  ]);

  assert.equal(latest?.id, "newer");
});

test("returns null when no document has been opened", () => {
  const latest = mostRecentlyOpenedDocument([
    { id: "first", lastOpenedAt: null },
    { id: "second", lastOpenedAt: null },
  ]);

  assert.equal(latest, null);
});