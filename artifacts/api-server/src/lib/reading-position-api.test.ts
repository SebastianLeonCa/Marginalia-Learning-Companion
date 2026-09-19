import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import express, { type Express, type RequestHandler } from "express";
import { inArray } from "drizzle-orm";
import {
  db,
  documentsTable,
  pool,
  studySetsTable,
} from "@workspace/db";
import { createStudySetsRouter } from "../routes/study-sets.ts";

const ownerId = `reading-position-test-${randomUUID()}`;

const testAuth: RequestHandler = (req, res, next) => {
  const userId = req.header("x-test-user");
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = userId;
  next();
};

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createStudySetsRouter(testAuth));
  return app;
}

async function withServer<T>(
  app: Express,
  callback: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    return await callback(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function request(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-test-user": ownerId,
      ...init.headers,
    },
  });
}

async function jsonObject(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

after(async () => {
  await db
    .delete(studySetsTable)
    .where(inArray(studySetsTable.ownerId, [ownerId]));
  await pool.end();
});

test("saved reading position stays aligned across detail, progress, and dashboard APIs", async () => {
  const [studySet] = await db
    .insert(studySetsTable)
    .values({ ownerId, title: "Reading position regression" })
    .returning();
  const [savedDocument] = await db
    .insert(documentsTable)
    .values([
      {
        studySetId: studySet.id,
        ownerId,
        name: "saved-paper.pdf",
        size: 100,
        objectPath: `reading-tests/${randomUUID()}/saved.pdf`,
        pageCount: 40,
      },
      {
        studySetId: studySet.id,
        ownerId,
        name: "unopened-paper.pdf",
        size: 100,
        objectPath: `reading-tests/${randomUUID()}/unopened.pdf`,
        pageCount: 60,
      },
    ])
    .returning();

  await withServer(makeApp(), async (baseUrl) => {
    const saved = await request(
      baseUrl,
      `/study-sets/${studySet.id}/documents/${savedDocument.id}/reading-position`,
      {
        method: "PATCH",
        body: JSON.stringify({ page: 18, pageCount: 40 }),
      },
    );
    assert.equal(saved.status, 200);
    const savedDetail = await jsonObject(saved);
    assert.equal(savedDetail.progress, 18);
    assert.equal(typeof savedDetail.lastOpenedAt, "string");
    const savedDocuments = savedDetail.documents as Array<
      Record<string, unknown>
    >;
    assert.equal(
      savedDocuments.find((document) => document.id === savedDocument.id)
        ?.currentPage,
      18,
    );

    const reopened = await request(baseUrl, `/study-sets/${studySet.id}`);
    assert.equal(reopened.status, 200);
    const reopenedDetail = await jsonObject(reopened);
    const reopenedDocuments = reopenedDetail.documents as Array<
      Record<string, unknown>
    >;
    assert.equal(
      reopenedDocuments.find((document) => document.id === savedDocument.id)
        ?.currentPage,
      18,
    );

    const dashboard = await request(baseUrl, "/dashboard/summary");
    assert.equal(dashboard.status, 200);
    const continueReading = (await jsonObject(dashboard))
      .continueReading as Record<string, unknown>;
    assert.equal(continueReading.studySetId, studySet.id);
    assert.equal(continueReading.documentId, savedDocument.id);
    assert.equal(continueReading.page, 18);
    assert.equal(continueReading.progress, 18);

    for (const [path, body, status] of [
      [
        `/study-sets/${studySet.id}/documents/${savedDocument.id}/reading-position`,
        { page: 0 },
        400,
      ],
      [
        `/study-sets/${studySet.id}/documents/not-a-uuid/reading-position`,
        { page: 1 },
        400,
      ],
      [
        `/study-sets/${studySet.id}/documents/${randomUUID()}/reading-position`,
        { page: 1 },
        404,
      ],
    ] as const) {
      const response = await request(baseUrl, path, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      assert.equal(response.status, status);
      assert.equal(typeof (await jsonObject(response)).error, "string");
    }
  });
});