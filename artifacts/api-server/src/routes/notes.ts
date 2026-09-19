import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler } from "express";
import {
  CreateDocumentNoteBody,
  CreateDocumentNoteParams,
  CreateDocumentNoteResponse,
  DeleteNoteParams,
  ExplainNoteParams,
  ExplainNoteResponse,
  ListDocumentNotesParams,
  ListDocumentNotesResponse,
  UpdateNoteBody,
  UpdateNoteParams,
  UpdateNoteResponse,
} from "@workspace/api-zod";
import { db, documentsTable, notesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.ts";

async function ownedDocument(documentId: string, ownerId: string) {
  const [document] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, documentId), eq(documentsTable.ownerId, ownerId)))
    .limit(1);
  return document ?? null;
}

function publicNote(note: typeof notesTable.$inferSelect) {
  const { ownerId: _ownerId, ...safeNote } = note;
  return safeNote;
}

function plainLanguageExplanation(selectedText: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\butilize[sd]?\b/gi, "use"],
    [/\bdemonstrate[sd]?\b/gi, "show"],
    [/\bapproximately\b/gi, "about"],
    [/\bconsequently\b/gi, "so"],
    [/\bnevertheless\b/gi, "even so"],
    [/\bfurthermore\b/gi, "also"],
    [/\btherefore\b/gi, "so"],
    [/\bhowever\b/gi, "but"],
    [/\bin order to\b/gi, "to"],
    [/\bwith regard to\b/gi, "about"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\ba significant number of\b/gi, "many"],
    [/\bhas the ability to\b/gi, "can"],
    [/\bis able to\b/gi, "can"],
    [/\bprior to\b/gi, "before"],
    [/\bsubsequent to\b/gi, "after"],
    [/\bcommence[sd]?\b/gi, "start"],
    [/\bterminate[sd]?\b/gi, "end"],
    [/\bindividuals\b/gi, "people"],
    [/\bmethodology\b/gi, "method"],
    [/\bconceptualize[sd]?\b/gi, "think about"],
    [/\bfacilitate[sd]?\b/gi, "help"],
    [/\bindicate[sd]?\b/gi, "show"],
    [/\bconstitute[sd]?\b/gi, "make up"],
    [/\bnumerous\b/gi, "many"],
    [/\bsufficient\b/gi, "enough"],
    [/\bsubsequently\b/gi, "later"],
  ];
  let passage = selectedText
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\([^)]*(?:19|20)\d{2}[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, replacement] of replacements) {
    passage = passage.replace(pattern, replacement);
  }
  const sentences = passage
    .split(/(?<=[.!?;])\s+/)
    .map((sentence) => sentence.replace(/;+/g, ".").trim())
    .filter(Boolean);
  const core = sentences.slice(0, 3).map((sentence) => {
    const clauses = sentence.split(/,\s+(?:which|while|although|whereas|because|since)\s+/i);
    const direct = clauses[0].replace(/^(?:In contrast|On the other hand|For example),?\s*/i, "").trim();
    return direct.length > 220 ? `${direct.slice(0, 217).replace(/\s+\S*$/, "")}…` : direct;
  });
  const mainIdea = core[0] || "The author is making a point about this topic.";
  const details = core.slice(1);
  return [
    `Main idea: ${mainIdea}`,
    details.length
      ? `Key supporting point${details.length > 1 ? "s" : ""}: ${details.join(" ")}`
      : "Put another way: focus on what the author says happens, why it happens, and what follows from it.",
  ].join("\n\n");
}

export function createNotesRouter(authMiddleware: RequestHandler = requireAuth): IRouter {
  const router: IRouter = Router();

  router.get("/documents/:documentId/notes", authMiddleware, async (req, res): Promise<void> => {
    const parsed = ListDocumentNotesParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ownerId = res.locals.userId as string;
    if (!(await ownedDocument(parsed.data.documentId, ownerId))) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const notes = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.documentId, parsed.data.documentId), eq(notesTable.ownerId, ownerId)))
      .orderBy(desc(notesTable.updatedAt));
    res.json(ListDocumentNotesResponse.parse(notes.map(publicNote)));
  });

  router.post("/documents/:documentId/notes", authMiddleware, async (req, res): Promise<void> => {
    const params = CreateDocumentNoteParams.safeParse(req.params);
    const body = CreateDocumentNoteBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const ownerId = res.locals.userId as string;
    const document = await ownedDocument(params.data.documentId, ownerId);
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    if (!body.data.selectedText.trim()) {
      res.status(400).json({ error: "Selected passage cannot be empty" });
      return;
    }
    if (document.pageCount !== null && body.data.page > document.pageCount) {
      res.status(400).json({ error: `Page must be between 1 and ${document.pageCount}` });
      return;
    }
    const [note] = await db
      .insert(notesTable)
      .values({
        ...body.data,
        selectedText: body.data.selectedText.trim(),
        body: body.data.body.trim(),
        documentId: document.id,
        studySetId: document.studySetId,
        ownerId,
      })
      .returning();
    res.status(201).json(CreateDocumentNoteResponse.parse(publicNote(note)));
  });

  router.patch("/notes/:noteId", authMiddleware, async (req, res): Promise<void> => {
    const params = UpdateNoteParams.safeParse(req.params);
    const body = UpdateNoteBody.safeParse(req.body);
    if (!params.success || !body.success || Object.keys(body.data).length === 0) {
      res.status(400).json({ error: "Provide at least one valid note field" });
      return;
    }
    if (body.data.selectedText !== undefined && !body.data.selectedText.trim()) {
      res.status(400).json({ error: "Selected passage cannot be empty" });
      return;
    }
    const ownerId = res.locals.userId as string;
    const [existing] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, params.data.noteId), eq(notesTable.ownerId, ownerId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    if (body.data.page !== undefined) {
      const document = await ownedDocument(existing.documentId, ownerId);
      if (!document || (document.pageCount !== null && body.data.page > document.pageCount)) {
        res.status(400).json({ error: "Page is outside this document" });
        return;
      }
    }
    const values = {
      ...body.data,
      ...(body.data.selectedText !== undefined ? { selectedText: body.data.selectedText.trim() } : {}),
      ...(body.data.selectedText !== undefined ? { explanation: null } : {}),
      ...(body.data.body !== undefined ? { body: body.data.body.trim() } : {}),
      updatedAt: new Date(),
    };
    const [note] = await db
      .update(notesTable)
      .set(values)
      .where(and(eq(notesTable.id, params.data.noteId), eq(notesTable.ownerId, ownerId)))
      .returning();
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.json(UpdateNoteResponse.parse(publicNote(note)));
  });

  router.delete("/notes/:noteId", authMiddleware, async (req, res): Promise<void> => {
    const parsed = DeleteNoteParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [deleted] = await db
      .delete(notesTable)
      .where(and(eq(notesTable.id, parsed.data.noteId), eq(notesTable.ownerId, res.locals.userId as string)))
      .returning({ id: notesTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    res.status(204).end();
  });

  router.post("/notes/:noteId/explanation", authMiddleware, async (req, res): Promise<void> => {
    const parsed = ExplainNoteParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const ownerId = res.locals.userId as string;
    const [existing] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, parsed.data.noteId), eq(notesTable.ownerId, ownerId)))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Note not found" });
      return;
    }
    const [note] = await db
      .update(notesTable)
      .set({
        explanation: plainLanguageExplanation(existing.selectedText),
        updatedAt: new Date(),
      })
      .where(and(eq(notesTable.id, existing.id), eq(notesTable.ownerId, ownerId)))
      .returning();
    res.json(ExplainNoteResponse.parse(publicNote(note)));
  });

  return router;
}

const router = createNotesRouter();

export default router;
