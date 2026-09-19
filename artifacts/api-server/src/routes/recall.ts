import { and, eq } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler } from "express";
import {
  AnswerRecallQuestionBody,
  AnswerRecallQuestionParams,
  AnswerRecallQuestionResponse,
  CreateRecallQuizParams,
  CreateRecallQuizResponse,
} from "@workspace/api-zod";
import { db, documentsTable } from "@workspace/db";
import {
  extractPdfText,
  generateRecallQuestions,
  InsufficientPdfTextError,
  InvalidGeneratedQuizError,
  MAX_RECALL_PDF_BYTES,
  RecallPdfTooLargeError,
  RecallQuizStore,
  type GeneratedRecallQuestion,
} from "../lib/recall.ts";
import { requireAuth } from "../middlewares/auth.ts";

type OwnedDocument = {
  id: string;
  name: string;
  objectPath: string;
};

type RecallDependencies = {
  loadOwnedDocument: (
    studySetId: string,
    documentId: string,
    ownerId: string,
  ) => Promise<OwnedDocument | null>;
  loadDocumentBuffer: (document: OwnedDocument) => Promise<Buffer>;
  extractText: (buffer: Buffer) => Promise<string>;
  generateQuestions: (sourceText: string) => Promise<GeneratedRecallQuestion[]>;
  store: RecallQuizStore;
};

const defaultDependencies: RecallDependencies = {
  async loadOwnedDocument(studySetId, documentId, ownerId) {
    const [document] = await db
      .select({
        id: documentsTable.id,
        name: documentsTable.name,
        objectPath: documentsTable.objectPath,
      })
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.id, documentId),
          eq(documentsTable.studySetId, studySetId),
          eq(documentsTable.ownerId, ownerId),
        ),
      )
      .limit(1);
    return document ?? null;
  },
  async loadDocumentBuffer(document) {
    const { ObjectStorageService } = await import("../lib/objectStorage.ts");
    const objectStorageService = new ObjectStorageService();
    const objectFile = await objectStorageService.getObjectEntityFile(
      document.objectPath,
    );
    const [metadata] = await objectFile.getMetadata();
    if (Number(metadata.size ?? 0) > MAX_RECALL_PDF_BYTES) {
      throw new RecallPdfTooLargeError();
    }
    const [buffer] = await objectFile.download();
    return buffer;
  },
  extractText: extractPdfText,
  generateQuestions: generateRecallQuestions,
  store: new RecallQuizStore(),
};

export function createRecallRouter(
  authMiddleware: RequestHandler = requireAuth,
  overrides: Partial<RecallDependencies> = {},
): IRouter {
  const router: IRouter = Router();
  const dependencies = { ...defaultDependencies, ...overrides };
  const activeOwners = new Set<string>();
  const recentStarts = new Map<string, number[]>();

  function reserveGeneration(ownerId: string) {
    const now = Date.now();
    const starts = (recentStarts.get(ownerId) ?? []).filter(
      (startedAt) => startedAt > now - 10 * 60 * 1000,
    );
    recentStarts.set(ownerId, starts);
    if (activeOwners.has(ownerId) || starts.length >= 5) return false;
    activeOwners.add(ownerId);
    starts.push(now);
    return true;
  }

  router.post(
    "/study-sets/:studySetId/documents/:documentId/recall",
    authMiddleware,
    async (req, res): Promise<void> => {
      const params = CreateRecallQuizParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const ownerId = res.locals.userId as string;
      const document = await dependencies.loadOwnedDocument(
        params.data.studySetId,
        params.data.documentId,
        ownerId,
      );
      if (!document) {
        res.status(404).json({ error: "Document not found" });
        return;
      }
      if (!reserveGeneration(ownerId)) {
        res.status(429).json({
          error:
            "A Recall quiz is already being created, or too many were requested recently. Please wait and try again.",
        });
        return;
      }

      try {
        const buffer = await dependencies.loadDocumentBuffer(document);
        const sourceText = await dependencies.extractText(buffer);
        const questions = await dependencies.generateQuestions(sourceText);
        const quiz = dependencies.store.create({
          ownerId,
          documentId: document.id,
          documentName: document.name,
          questions,
        });
        res.json(CreateRecallQuizResponse.parse(quiz));
      } catch (error) {
        if (error instanceof Error && error.name === "ObjectNotFoundError") {
          res.status(404).json({ error: "Document not found" });
          return;
        }
        if (
          error instanceof InsufficientPdfTextError ||
          error instanceof RecallPdfTooLargeError
        ) {
          res.status(400).json({ error: error.message });
          return;
        }
        if (!(error instanceof InvalidGeneratedQuizError)) {
          req.log?.error({ err: error, documentId: document.id }, "Could not generate Recall quiz");
        }
        if (error instanceof Error && /PDF|password|format/i.test(error.message)) {
          res.status(400).json({
            error:
              "We could not read selectable text from this PDF. Try a text-based PDF instead of a scanned document.",
          });
          return;
        }
        res.status(422).json({
          error:
            error instanceof InvalidGeneratedQuizError
              ? "The quiz could not be created reliably from this PDF. Please try again."
              : "Recall is temporarily unable to create this quiz. Please try again.",
        });
      } finally {
        activeOwners.delete(ownerId);
      }
    },
  );

  router.post(
    "/recall/:quizId/questions/:questionId/answer",
    authMiddleware,
    async (req, res): Promise<void> => {
      const params = AnswerRecallQuestionParams.safeParse(req.params);
      const body = AnswerRecallQuestionBody.safeParse(req.body);
      if (!params.success || !body.success) {
        res.status(400).json({ error: "Choose a valid answer option" });
        return;
      }

      const result = dependencies.store.answer({
        ownerId: res.locals.userId as string,
        quizId: params.data.quizId,
        questionId: params.data.questionId,
        optionId: body.data.optionId,
      });
      if (result.status === "not-found") {
        res.status(404).json({ error: "Recall quiz or question not found" });
        return;
      }
      if (result.status === "invalid-option") {
        res.status(400).json({ error: "This option is not part of the question" });
        return;
      }
      if (result.status === "already-answered") {
        res.status(400).json({ error: "This question has already been answered" });
        return;
      }

      res.json(AnswerRecallQuestionResponse.parse(result.value));
    },
  );

  return router;
}

export default createRecallRouter();