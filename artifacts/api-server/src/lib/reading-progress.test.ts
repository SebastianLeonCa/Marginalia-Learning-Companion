import assert from "node:assert/strict";
import test from "node:test";
import {
  boundedReadingPosition,
  calculateReadingProgress,
  mostRecentlyOpenedDocument,
} from "./reading-progress.ts";
import {
  UpdateReadingPositionBody,
  UpdateReadingPositionParams,
} from "@workspace/api-zod";

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

test("saving a page bounds the position and updates aggregate set progress", () => {
  const savedAt = new Date("2026-09-19T12:00:00Z");
  const savedPage = boundedReadingPosition(80, 50);
  const documents = [
    { currentPage: savedPage, pageCount: 50, lastOpenedAt: savedAt },
    { currentPage: 1, pageCount: 50, lastOpenedAt: null },
  ];

  assert.equal(savedPage, 50);
  assert.equal(calculateReadingProgress(documents), 50);
  assert.equal(documents[0].lastOpenedAt, savedAt);
});

test("progress includes every opened document and ignores unopened defaults", () => {
  const openedAt = new Date("2026-09-19T12:00:00Z");

  assert.equal(
    calculateReadingProgress([
      { currentPage: 20, pageCount: 40, lastOpenedAt: openedAt },
      { currentPage: 15, pageCount: 60, lastOpenedAt: openedAt },
      { currentPage: 1, pageCount: 100, lastOpenedAt: null },
    ]),
    18,
  );
});

test("rejects invalid document identifiers and page inputs", () => {
  assert.equal(
    UpdateReadingPositionParams.safeParse({
      studySetId: "set-1",
      documentId: "",
    }).success,
    false,
  );
  assert.equal(UpdateReadingPositionBody.safeParse({ page: 0 }).success, false);
  assert.equal(
    UpdateReadingPositionBody.safeParse({ page: 2, pageCount: 0 }).success,
    false,
  );
});