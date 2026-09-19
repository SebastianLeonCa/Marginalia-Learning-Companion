import { and, asc, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateStudySetBody,
  CreateStudySetResponse,
  GetDashboardSummaryResponse,
  GetStudySetParams,
  GetStudySetResponse,
  ListStudySetsResponse,
  UpdateReadingPositionBody,
  UpdateReadingPositionParams,
  UpdateReadingPositionResponse,
} from "@workspace/api-zod";
import { db, documentsTable, notesTable, studySetsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { mostRecentlyOpenedDocument } from "../lib/reading-progress";

const router: IRouter = Router();

function summaryFromStudySet(
  studySet: typeof studySetsTable.$inferSelect,
  documentCount: number,
) {
  return {
    id: studySet.id,
    title: studySet.title,
    createdAt: studySet.createdAt,
    updatedAt: studySet.updatedAt,
    documentCount,
    noteCount: 0,
    bestScore: studySet.bestScore,
    progress: studySet.progress,
    lastOpenedAt: studySet.lastOpenedAt,
  };
}

async function getStudySetDetail(studySetId: string, userId: string) {
  const [studySet] = await db
    .select()
    .from(studySetsTable)
    .where(
      and(eq(studySetsTable.id, studySetId), eq(studySetsTable.ownerId, userId)),
    )
    .limit(1);

  if (!studySet) {
    return null;
  }

  const documents = await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.studySetId, studySet.id),
        eq(documentsTable.ownerId, userId),
      ),
    )
    .orderBy(asc(documentsTable.uploadedAt));

  const [noteTotals] = await db
    .select({ count: count(notesTable.id) })
    .from(notesTable)
    .where(and(eq(notesTable.studySetId, studySet.id), eq(notesTable.ownerId, userId)));

  return {
    ...summaryFromStudySet(studySet, documents.length),
    noteCount: Number(noteTotals?.count ?? 0),
    documents,
  };
}

function calculateProgress(
  documents: Array<Pick<typeof documentsTable.$inferSelect, "currentPage" | "lastOpenedAt" | "pageCount">>,
) {
  if (documents.length === 0) return 0;
  const totalPages = documents.reduce((total, document) => total + (document.pageCount ?? 1), 0);
  const pagesRead = documents.reduce(
    (total, document) =>
      total + (document.lastOpenedAt ? Math.min(document.currentPage, document.pageCount ?? 1) : 0),
    0,
  );
  return Math.min(100, Math.round((pagesRead / totalPages) * 100));
}

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const studySets = await db
    .select({
      id: studySetsTable.id,
      title: studySetsTable.title,
      progress: studySetsTable.progress,
      lastOpenedAt: studySetsTable.lastOpenedAt,
    })
    .from(studySetsTable)
    .where(eq(studySetsTable.ownerId, userId))
    .orderBy(desc(studySetsTable.lastOpenedAt), desc(studySetsTable.updatedAt));

  const [documentTotals] = await db
    .select({ count: count(documentsTable.id) })
    .from(documentsTable)
    .where(eq(documentsTable.ownerId, userId));
  const [noteTotals] = await db
    .select({ count: count(notesTable.id) })
    .from(notesTable)
    .where(eq(notesTable.ownerId, userId));

  const continueStudySet = studySets.find((studySet) => studySet.lastOpenedAt);
  const continueReading = continueStudySet
    ? await db
        .select({
          documentId: documentsTable.id,
          documentName: documentsTable.name,
          page: documentsTable.currentPage,
          lastOpenedAt: documentsTable.lastOpenedAt,
        })
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.studySetId, continueStudySet.id),
            eq(documentsTable.ownerId, userId),
          ),
        )
        .orderBy(asc(documentsTable.uploadedAt))
        .then((documents) => {
          const document = mostRecentlyOpenedDocument(documents);
          return document
            ? {
                studySetId: continueStudySet.id,
                documentId: document.documentId,
                studySetTitle: continueStudySet.title,
                documentName: document.documentName,
                progress: continueStudySet.progress,
                page: document.page,
              }
            : null;
        })
    : null;

  res.json(
    GetDashboardSummaryResponse.parse({
      totalStudySets: studySets.length,
      totalDocuments: Number(documentTotals?.count ?? 0),
      totalNotes: Number(noteTotals?.count ?? 0),
      totalPoints: 0,
      currentStreak: 0,
      flaggedCount: 0,
      continueReading,
    }),
  );
});

router.get("/study-sets", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const rows = await db
    .select({
      studySet: studySetsTable,
      documentCount: count(documentsTable.id),
    })
    .from(studySetsTable)
    .leftJoin(documentsTable, eq(documentsTable.studySetId, studySetsTable.id))
    .where(eq(studySetsTable.ownerId, userId))
    .groupBy(studySetsTable.id)
    .orderBy(desc(studySetsTable.updatedAt));
  const noteRows = await db
    .select({
      studySetId: notesTable.studySetId,
      noteCount: count(notesTable.id),
    })
    .from(notesTable)
    .where(eq(notesTable.ownerId, userId))
    .groupBy(notesTable.studySetId);
  const noteCounts = new Map(noteRows.map((row) => [row.studySetId, Number(row.noteCount)]));

  res.json(
    ListStudySetsResponse.parse(
      rows.map(({ studySet, documentCount }) => ({
        ...summaryFromStudySet(studySet, Number(documentCount)),
        noteCount: noteCounts.get(studySet.id) ?? 0,
      })),
    ),
  );
});

router.post("/study-sets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateStudySetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const result = await db.transaction(async (tx) => {
    const [studySet] = await tx
      .insert(studySetsTable)
      .values({ ownerId: userId, title: parsed.data.title })
      .returning();

    const documents = await tx
      .insert(documentsTable)
      .values(
        parsed.data.documents.map((document) => ({
          studySetId: studySet.id,
          ownerId: userId,
          name: document.name,
          size: document.size,
          objectPath: document.objectPath,
          processingStatus: "uploaded",
        })),
      )
      .returning();

    return {
      ...summaryFromStudySet(studySet, documents.length),
      documents,
    };
  });

  res.status(201).json(CreateStudySetResponse.parse(result));
});

router.get("/study-sets/:studySetId", requireAuth, async (req, res): Promise<void> => {
  const parsed = GetStudySetParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const detail = await getStudySetDetail(
    parsed.data.studySetId,
    res.locals.userId as string,
  );
  if (!detail) {
    res.status(404).json({ error: "Study set not found" });
    return;
  }

  res.json(GetStudySetResponse.parse(detail));
});

router.patch(
  "/study-sets/:studySetId/documents/:documentId/reading-position",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = UpdateReadingPositionParams.safeParse(req.params);
    const body = UpdateReadingPositionBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const userId = res.locals.userId as string;
    const [document] = await db
      .select()
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.id, params.data.documentId),
          eq(documentsTable.studySetId, params.data.studySetId),
          eq(documentsTable.ownerId, userId),
        ),
      )
      .limit(1);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const pageCount = body.data.pageCount ?? document.pageCount;
    const page = Math.min(body.data.page, pageCount ?? body.data.page);
    const now = new Date();
    await db
      .update(documentsTable)
      .set({ currentPage: page, lastOpenedAt: now, pageCount })
      .where(eq(documentsTable.id, document.id));

    const setDocuments = await db
      .select({
        id: documentsTable.id,
        currentPage: documentsTable.currentPage,
        lastOpenedAt: documentsTable.lastOpenedAt,
        pageCount: documentsTable.pageCount,
      })
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.studySetId, params.data.studySetId),
          eq(documentsTable.ownerId, userId),
        ),
      );
    const progressDocuments = setDocuments.map((item) =>
      item.id === document.id
        ? { ...item, currentPage: page, lastOpenedAt: now, pageCount }
        : item,
    );
    await db
      .update(studySetsTable)
      .set({
        progress: calculateProgress(progressDocuments),
        lastOpenedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(studySetsTable.id, params.data.studySetId),
          eq(studySetsTable.ownerId, userId),
        ),
      );

    const detail = await getStudySetDetail(params.data.studySetId, userId);
    if (!detail) {
      res.status(404).json({ error: "Study set not found" });
      return;
    }
    res.json(UpdateReadingPositionResponse.parse(detail));
  },
);

export default router;