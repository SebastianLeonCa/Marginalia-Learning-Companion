import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import express, { type Express, type RequestHandler } from "express";
import { createRecallRouter } from "../routes/recall.ts";
import {
  InsufficientPdfTextError,
  RecallQuizStore,
  prepareRecallSource,
  validateGeneratedRecallQuiz,
  type GeneratedRecallQuestion,
} from "./recall.ts";

const studySetId = randomUUID();
const documentId = randomUUID();

const questions: GeneratedRecallQuestion[] = Array.from(
  { length: 5 },
  (_, index) => ({
    prompt: `Grounded question ${index + 1}?`,
    options: [
      `Correct ${index + 1}`,
      `Distractor A${index + 1}`,
      `Distractor B${index + 1}`,
      `Distractor C${index + 1}`,
    ],
    correctOptionIndex: 0,
    explanation: `The document supports answer ${index + 1}.`,
    sourceQuote: `The document supports correct answer number ${index + 1} here`,
  }),
);

const testAuth: RequestHandler = (req, res, next) => {
  const ownerId = req.header("x-test-user");
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.locals.userId = ownerId;
  next();
};

function makeApp(extractText: () => Promise<string> = async () => "usable source") {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createRecallRouter(testAuth, {
      loadOwnedDocument: async (setId, docId, ownerId) =>
        setId === studySetId && docId === documentId && ownerId === "owner-a"
          ? {
              id: documentId,
              name: "private-source.pdf",
              objectPath: "/objects/private-source",
            }
          : null,
      loadDocumentBuffer: async () => Buffer.from("private pdf"),
      extractText,
      generateQuestions: async () => questions,
      store: new RecallQuizStore(),
    }),
  );
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

function request(
  baseUrl: string,
  ownerId: string,
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

test("generated Recall content must be exactly five distinct four-option questions", () => {
  const sourceText = questions.map((question) => question.sourceQuote).join(". ");
  const valid = validateGeneratedRecallQuiz({ questions }, sourceText);
  assert.equal(valid.length, 5);
  assert.equal(valid[0].options.length, 4);

  assert.throws(
    () => validateGeneratedRecallQuiz({ questions: questions.slice(0, 4) }, sourceText),
    /exactly five/i,
  );
  assert.throws(
    () =>
      validateGeneratedRecallQuiz({
        questions: questions.map((question, index) =>
          index === 0
            ? { ...question, options: ["same", "same", "third", "fourth"] }
            : question,
        ),
      }, sourceText),
    /duplicate/i,
  );
  assert.throws(
    () =>
      validateGeneratedRecallQuiz(
        {
          questions: questions.map((question, index) =>
            index === 0
              ? { ...question, sourceQuote: "This quote was never in the PDF text" }
              : question,
          ),
        },
        sourceText,
      ),
    /exact source quote/i,
  );
});

test("short or image-only PDF text is rejected before quiz generation", () => {
  assert.throws(() => prepareRecallSource(""), InsufficientPdfTextError);
  assert.throws(
    () => prepareRecallSource("scanned ".repeat(20)),
    InsufficientPdfTextError,
  );
  assert.ok(prepareRecallSource("substantive ".repeat(120)).length > 700);
});

test("Recall never exposes the answer key at creation and hides quizzes across owners", async () => {
  await withServer(makeApp(), async (baseUrl) => {
    const created = await request(
      baseUrl,
      "owner-a",
      `/study-sets/${studySetId}/documents/${documentId}/recall`,
      { method: "POST" },
    );
    assert.equal(created.status, 200);
    const quiz = (await created.json()) as {
      id: string;
      questions: Array<{
        id: string;
        options: Array<{ id: string; text: string }>;
        correctOptionId?: string;
      }>;
    };
    assert.equal(quiz.questions.length, 5);
    assert.equal(quiz.questions.some((question) => "correctOptionId" in question), false);

    const firstQuestion = quiz.questions[0];
    const blocked = await request(
      baseUrl,
      "owner-b",
      `/recall/${quiz.id}/questions/${firstQuestion.id}/answer`,
      {
        method: "POST",
        body: JSON.stringify({ optionId: firstQuestion.options[0].id }),
      },
    );
    assert.equal(blocked.status, 404);

    const answered = await request(
      baseUrl,
      "owner-a",
      `/recall/${quiz.id}/questions/${firstQuestion.id}/answer`,
      {
        method: "POST",
        body: JSON.stringify({ optionId: firstQuestion.options[0].id }),
      },
    );
    assert.equal(answered.status, 200);
    const feedback = (await answered.json()) as {
      correct: boolean;
      correctOptionId: string;
    };
    assert.equal(feedback.correct, true);
    assert.equal(feedback.correctOptionId, firstQuestion.options[0].id);

    const changedAnswer = await request(
      baseUrl,
      "owner-a",
      `/recall/${quiz.id}/questions/${firstQuestion.id}/answer`,
      {
        method: "POST",
        body: JSON.stringify({ optionId: firstQuestion.options[1].id }),
      },
    );
    assert.equal(changedAnswer.status, 400);
  });
});

test("Recall returns a clear error when selectable PDF text is unavailable", async () => {
  await withServer(
    makeApp(async () => {
      throw new InsufficientPdfTextError();
    }),
    async (baseUrl) => {
      const response = await request(
        baseUrl,
        "owner-a",
        `/study-sets/${studySetId}/documents/${documentId}/recall`,
        { method: "POST" },
      );
      assert.equal(response.status, 400);
      const body = (await response.json()) as { error: string };
      assert.match(body.error, /selectable text/i);
    },
  );
});