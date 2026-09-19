import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import express, { type Express, type RequestHandler } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { db, documentsTable, notesTable, pool, studySetsTable } from "@workspace/db";
import { createNotesRouter } from "../routes/notes.ts";

const ownerA = `notes-test-a-${randomUUID()}`;
const ownerB = `notes-test-b-${randomUUID()}`;
const owners = [ownerA, ownerB];

const testAuth: RequestHandler = (req, res, next) => {
  const ownerId = req.header("x-test-user");
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = ownerId;
  next();
};

function makeApp(): Express {
  const app = express();
  app.use(express.json());
  app.use("/api", createNotesRouter(testAuth));
  return app;
}

async function withServer<T>(app: Express, callback: (baseUrl: string) => Promise<T>): Promise<T> {
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
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function request(baseUrl: string, ownerId: string, path: string, init: RequestInit = {}) {
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

async function jsonArray(response: Response): Promise<Array<Record<string, unknown>>> {
  return (await response.json()) as Array<Record<string, unknown>>;
}

after(async () => {
  await db.delete(studySetsTable).where(inArray(studySetsTable.ownerId, owners));
  await pool.end();
});

test("notes stay private through their full API lifecycle and survive an app refresh", async () => {
  const [setA, setB] = await db
    .insert(studySetsTable)
    .values([
      { ownerId: ownerA, title: "Owner A set" },
      { ownerId: ownerB, title: "Owner B set" },
    ])
    .returning();
  const [documentA, documentB] = await db
    .insert(documentsTable)
    .values([
      {
        studySetId: setA.id,
        ownerId: ownerA,
        name: "owner-a.pdf",
        size: 100,
        objectPath: `notes-tests/${randomUUID()}/a.pdf`,
        pageCount: 5,
      },
      {
        studySetId: setB.id,
        ownerId: ownerB,
        name: "owner-b.pdf",
        size: 100,
        objectPath: `notes-tests/${randomUUID()}/b.pdf`,
        pageCount: 5,
      },
    ])
    .returning();

  let noteId = "";
  await withServer(makeApp(), async (baseUrl) => {
    const created = await request(baseUrl, ownerA, `/documents/${documentA.id}/notes`, {
      method: "POST",
      body: JSON.stringify({
        page: 2,
        selectedText: "The author demonstrates approximately how this works.",
        body: "private first draft",
      }),
    });
    assert.equal(created.status, 201);
    const note = await jsonObject(created);
    noteId = note.id as string;
    assert.equal(note.body, "private first draft");
    assert.equal("ownerId" in note, false);

    const ownList = await request(baseUrl, ownerA, `/documents/${documentA.id}/notes`);
    assert.equal(ownList.status, 200);
    assert.deepEqual(
      (await jsonArray(ownList)).map((item) => item.id),
      [noteId],
    );

    for (const [method, path, body] of [
      ["GET", `/documents/${documentA.id}/notes`, undefined],
      ["POST", `/documents/${documentA.id}/notes`, { page: 1, selectedText: "intrusion", body: "intrusion" }],
      ["PATCH", `/notes/${noteId}`, { body: "changed by another owner" }],
      ["POST", `/notes/${noteId}/explanation`, undefined],
      ["DELETE", `/notes/${noteId}`, undefined],
    ] as const) {
      const response = await request(baseUrl, ownerB, path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, 404, `${method} ${path} must hide cross-account resources`);
      assert.match((await jsonObject(response)).error as string, /not found/i);
    }

    const ownerBList = await request(baseUrl, ownerB, `/documents/${documentB.id}/notes`);
    assert.equal(ownerBList.status, 200);
    assert.deepEqual(await ownerBList.json(), []);

    const updated = await request(baseUrl, ownerA, `/notes/${noteId}`, {
      method: "PATCH",
      body: JSON.stringify({ body: "saved edit" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await jsonObject(updated)).body, "saved edit");

    const explained = await request(baseUrl, ownerA, `/notes/${noteId}/explanation`, {
      method: "POST",
    });
    assert.equal(explained.status, 200);
    assert.match((await jsonObject(explained)).explanation as string, /Main idea:/);

    for (const [method, path] of [
      ["GET", "/documents/not-a-uuid/notes"],
      ["POST", "/documents/not-a-uuid/notes"],
      ["PATCH", "/notes/not-a-uuid"],
      ["POST", "/notes/not-a-uuid/explanation"],
      ["DELETE", "/notes/not-a-uuid"],
    ] as const) {
      const response = await request(baseUrl, ownerA, path, {
        method,
        ...(method === "POST" && path.includes("/documents/")
          ? {
              body: JSON.stringify({ page: 1, selectedText: "text", body: "" }),
            }
          : {}),
        ...(method === "PATCH" ? { body: JSON.stringify({ body: "edit" }) } : {}),
      });
      assert.equal(response.status, 400, `${method} ${path} must reject malformed identifiers`);
      const error = (await jsonObject(response)).error as string;
      assert.equal(typeof error, "string");
      assert.equal(error.includes(ownerA), false);
    }
  });

  await withServer(makeApp(), async (baseUrl) => {
    const refreshedList = await request(baseUrl, ownerA, `/documents/${documentA.id}/notes`);
    assert.equal(refreshedList.status, 200);
    const [persisted] = await jsonArray(refreshedList);
    assert.equal(persisted.id, noteId);
    assert.equal(persisted.body, "saved edit");
    assert.match(persisted.explanation as string, /Main idea:/);

    const deleted = await request(baseUrl, ownerA, `/notes/${noteId}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 204);
  });

  const [remaining] = await db
    .select()
    .from(notesTable)
    .where(and(eq(notesTable.id, noteId), eq(notesTable.ownerId, ownerA)));
  assert.equal(remaining, undefined);
});
