import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const studySetsTable = pgTable("study_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  bestScore: integer("best_score").default(0).notNull(),
  progress: integer("progress").default(0).notNull(),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
});

export const documentsTable = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  studySetId: uuid("study_set_id")
    .notNull()
    .references(() => studySetsTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  objectPath: text("object_path").notNull().unique(),
  pageCount: integer("page_count"),
  processingStatus: text("processing_status").default("uploaded").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});

export const notesTable = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documentsTable.id, { onDelete: "cascade" }),
  studySetId: uuid("study_set_id")
    .notNull()
    .references(() => studySetsTable.id, { onDelete: "cascade" }),
  ownerId: text("owner_id").notNull(),
  page: integer("page").notNull(),
  selectedText: text("selected_text").notNull(),
  body: text("body").default("").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type StudySet = typeof studySetsTable.$inferSelect;
export type Document = typeof documentsTable.$inferSelect;
export type Note = typeof notesTable.$inferSelect;