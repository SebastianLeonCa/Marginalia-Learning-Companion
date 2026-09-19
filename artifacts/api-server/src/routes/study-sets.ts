import { and, asc, count, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateStudySetBody,
  CreateStudySetResponse,
  GetDashboardSummaryResponse,
  GetStudySetParams,
  GetStudySetResponse,
  ListStudySetsResponse,
} from "@workspace/api-zod";
import { db, documentsTable, studySetsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

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

  return {
    ...summaryFromStudySet(studySet, documents.length),
    documents,
  };
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

  const continueStudySet = studySets[0];
  const continueReading = continueStudySet
    ? await db
        .select({
          documentId: documentsTable.id,
          documentName: documentsTable.name,
        })
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.studySetId, continueStudySet.id),
            eq(documentsTable.ownerId, userId),
          ),
        )
        .orderBy(asc(documentsTable.uploadedAt))
        .limit(1)
        .then(([document]) =>
          document
            ? {
                studySetId: continueStudySet.id,
                documentId: document.documentId,
                studySetTitle: continueStudySet.title,
                documentName: document.documentName,
                progress: continueStudySet.progress,
                page: 1,
              }
            : null,
        )
    : null;

  res.json(
    GetDashboardSummaryResponse.parse({
      totalStudySets: studySets.length,
      totalDocuments: Number(documentTotals?.count ?? 0),
      totalNotes: 0,
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

  res.json(
    ListStudySetsResponse.parse(
      rows.map(({ studySet, documentCount }) =>
        summaryFromStudySet(studySet, Number(documentCount)),
      ),
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

export default router;