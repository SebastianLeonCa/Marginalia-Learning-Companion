type SavedDocument = {
  currentPage: number;
};

type ContinueReading = {
  studySetId: string;
  documentId: string;
  documentName: string;
  page: number;
};

export function readerStartPage(document: SavedDocument) {
  return document.currentPage;
}

export function continueReadingCard(continueReading: ContinueReading) {
  return {
    href: `/study-sets/${continueReading.studySetId}/read/${continueReading.documentId}`,
    detail: `${continueReading.documentName} · page ${continueReading.page}`,
  };
}