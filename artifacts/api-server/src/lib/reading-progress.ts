export function mostRecentlyOpenedDocument<T extends { lastOpenedAt: Date | null }>(
  documents: T[],
) {
  return documents.reduce<T | null>((latest, document) => {
    if (!document.lastOpenedAt) return latest;
    if (!latest?.lastOpenedAt || document.lastOpenedAt > latest.lastOpenedAt) {
      return document;
    }
    return latest;
  }, null);
}

type ReadingProgressDocument = {
  currentPage: number;
  lastOpenedAt: Date | null;
  pageCount: number | null;
};

export function boundedReadingPosition(
  page: number,
  pageCount: number | null,
) {
  return Math.min(page, pageCount ?? page);
}

export function calculateReadingProgress(
  documents: ReadingProgressDocument[],
) {
  if (documents.length === 0) return 0;

  const totalPages = documents.reduce(
    (total, document) => total + (document.pageCount ?? 1),
    0,
  );
  const pagesRead = documents.reduce(
    (total, document) =>
      total +
      (document.lastOpenedAt
        ? Math.min(document.currentPage, document.pageCount ?? 1)
        : 0),
    0,
  );

  return Math.min(100, Math.round((pagesRead / totalPages) * 100));
}