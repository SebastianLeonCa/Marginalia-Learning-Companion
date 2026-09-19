import assert from "node:assert/strict";
import test from "node:test";
import {
  continueReadingCard,
  readerStartPage,
} from "./reading-position.ts";

test("reopening a document starts from its saved page", () => {
  assert.equal(readerStartPage({ currentPage: 17 }), 17);
});

test("the Home continue card links to the saved document and shows its page", () => {
  const card = continueReadingCard({
    studySetId: "set-42",
    documentId: "document-7",
    documentName: "Attention Is All You Need.pdf",
    page: 17,
  });

  assert.deepEqual(card, {
    href: "/study-sets/set-42/read/document-7",
    detail: "Attention Is All You Need.pdf · page 17",
  });
});