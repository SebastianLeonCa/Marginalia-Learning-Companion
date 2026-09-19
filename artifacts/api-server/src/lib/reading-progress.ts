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