import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, BookOpen, ChevronLeft, ChevronRight, ExternalLink, FileText, Highlighter, LockKeyhole, Pencil, RotateCcw, Sparkles, StickyNote, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardSummaryQueryKey, getGetStudySetQueryKey, getListDocumentNotesQueryKey, getListStudySetsQueryKey, useCreateDocumentNote, useDeleteNote, useExplainNote, useGetStudySet, useListDocumentNotes, useUpdateNote, useUpdateReadingPosition, type Note } from "@workspace/api-client-react";
import { Link, useLocation, useParams } from "wouter";
import { Document as PdfDocument, Page as PdfPage, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { AppShell } from "@/components/marginalia-ui";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function ReaderLoading() {
  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-73px)] bg-[#efe6d4] px-5 py-6 md:min-h-[100dvh] md:px-8 md:py-8">
        <div className="mx-auto max-w-[1500px] animate-pulse">
          <div className="h-4 w-36 rounded-full bg-[#d8cbb8]" />
          <div className="mt-7 h-12 w-2/3 rounded-2xl bg-[#d8cbb8]" />
          <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_250px]">
            <div className="h-56 rounded-3xl bg-[#d8cbb8]" />
            <div className="min-h-[65vh] rounded-[28px] bg-[#d8cbb8]" />
            <div className="h-64 rounded-3xl bg-[#d8cbb8]" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ReaderError({ onRetry }: { onRetry: () => void }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <AlertCircle size={30} />
        </span>
        <h1 className="mt-6 font-serif text-3xl font-bold">The reading room is quiet.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">We could not bring this study set to the desk. Your papers are safe; try opening the room again.</p>
        <button type="button" onClick={onRetry} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" data-testid="button-retry-reader">
          <RotateCcw size={16} /> Try again
        </button>
      </div>
    </AppShell>
  );
}

export default function ReaderPage() {
  const { studySetId = "", documentId = "" } = useParams<{ studySetId: string; documentId: string }>();
  const [, setLocation] = useLocation();
  const query = useGetStudySet(studySetId);
  const notesQuery = useListDocumentNotes(documentId);
  const queryClient = useQueryClient();
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [viewerWidth, setViewerWidth] = useState(900);
  const [renderedPageCount, setRenderedPageCount] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const [showComposer, setShowComposer] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [readingPage, setReadingPage] = useState(1);
  const [notePage, setNotePage] = useState(1);
  const [selectedText, setSelectedText] = useState("");
  const [body, setBody] = useState("");
  const refreshNotes = () => queryClient.invalidateQueries({ queryKey: getListDocumentNotesQueryKey(documentId) });
  const createNote = useCreateDocumentNote({ mutation: { onSuccess: () => { void refreshNotes(); resetComposer(); } } });
  const updateNote = useUpdateNote({ mutation: { onSuccess: () => { void refreshNotes(); resetComposer(); } } });
  const deleteNote = useDeleteNote({ mutation: { onSuccess: () => void refreshNotes() } });
  const explainNote = useExplainNote({ mutation: { onSuccess: () => void refreshNotes() } });
  const updateReadingPosition = useUpdateReadingPosition({
    mutation: {
      onSuccess: (detail) => {
        queryClient.setQueryData(getGetStudySetQueryKey(studySetId), detail);
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListStudySetsQueryKey() });
      },
    },
  });

  const saveReadingPosition = (nextPage: number, pageCount?: number) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() =>
        updateReadingPosition.mutateAsync({
          studySetId,
          documentId,
          data: { page: nextPage, ...(pageCount ? { pageCount } : {}) },
        }),
      );
  };

  const documents = query.data?.documents ?? [];
  const currentIndex = documents.findIndex((document) => document.id === documentId);
  const currentDocument = currentIndex >= 0 ? documents[currentIndex] : undefined;
  const previousDocument = currentIndex > 0 ? documents[currentIndex - 1] : undefined;
  const nextDocument = currentIndex >= 0 && currentIndex < documents.length - 1 ? documents[currentIndex + 1] : undefined;

  useEffect(() => {
    setViewerLoaded(false);
    setRenderedPageCount(null);
    setShowComposer(false);
    setEditingNote(null);
    setReadingPage(1);
    setNotePage(1);
    setSelectedText("");
    setBody("");
  }, [documentId]);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewerWidth(Math.max(280, Math.floor(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [currentDocument?.id]);

  function resetComposer() {
    setShowComposer(false);
    setEditingNote(null);
    setNotePage(1);
    setSelectedText("");
    setBody("");
  }

  function beginEdit(note: Note) {
    setEditingNote(note);
    setNotePage(note.page);
    setSelectedText(note.selectedText);
    setBody(note.body);
    setShowComposer(true);
  }

  function capturePdfSelection() {
    const viewer = viewerRef.current;
    const selection = window.getSelection();
    if (!viewer || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const selectionNode =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
    if (!selectionNode || !viewer.contains(selectionNode) || !selectionNode.closest(".react-pdf__Page__textContent")) return;

    const passage = selection.toString().replace(/\s+/g, " ").trim().slice(0, 5000);
    if (!passage) return;

    setEditingNote(null);
    setSelectedText(passage);
    setNotePage(readingPage);
    setBody("");
    setShowComposer(true);
  }

  function saveNote() {
    if (!selectedText.trim()) return;
    if (editingNote) {
      updateNote.mutate({ noteId: editingNote.id, data: { page: notePage, selectedText, body } });
    } else {
      createNote.mutate({ documentId, data: { page: notePage, selectedText, body } });
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))
      ) {
        return;
      }
      if (event.key === "ArrowLeft" && previousDocument) {
        event.preventDefault();
        setLocation(`/study-sets/${studySetId}/read/${previousDocument.id}`);
      }
      if (event.key === "ArrowRight" && nextDocument) {
        event.preventDefault();
        setLocation(`/study-sets/${studySetId}/read/${nextDocument.id}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextDocument, previousDocument, setLocation, studySetId]);

  useEffect(() => {
    if (!currentDocument) return;
    setReadingPage(currentDocument.currentPage);
    setNotePage(currentDocument.currentPage);
    saveReadingPosition(currentDocument.currentPage, currentDocument.pageCount ?? undefined);
  }, [currentDocument?.id]);

  const changeReadingPage = (nextPage: number) => {
    if (!currentDocument) return;
    const pageCount = renderedPageCount ?? currentDocument.pageCount;
    const boundedPage = Math.max(1, Math.min(nextPage, pageCount ?? nextPage));
    setReadingPage(boundedPage);
    setNotePage(boundedPage);
    saveReadingPosition(boundedPage, pageCount ?? undefined);
  };

  if (query.isLoading) return <ReaderLoading />;
  if (query.isError || !query.data) return <ReaderError onRetry={() => void query.refetch()} />;

  if (!currentDocument) {
    return (
      <AppShell>
        <div className="mx-auto max-w-xl px-5 py-24 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-foreground">
            <FileText size={28} />
          </span>
          <h1 className="mt-6 font-serif text-3xl font-bold">That paper is not in this room.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Choose a document from the study set desk to begin reading.</p>
          <Link href={`/study-sets/${studySetId}`} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" data-testid="link-reader-missing-back">
            <ArrowLeft size={16} /> Back to the study set
          </Link>
        </div>
      </AppShell>
    );
  }

  const objectUrl = currentDocument.objectPath
    ? `/api/storage${currentDocument.objectPath.startsWith("/") ? currentDocument.objectPath : `/${currentDocument.objectPath}`}`
    : "";
  const canReadPdf = currentDocument.processingStatus !== "processing";
  const pageCount = renderedPageCount ?? currentDocument.pageCount;

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-73px)] bg-[#efe6d4] px-4 py-5 md:min-h-[100dvh] md:px-8 md:py-7">
        <div className="mx-auto max-w-[1500px]">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link href={`/study-sets/${studySetId}`} className="group inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" data-testid="link-reader-back">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-border bg-card transition-transform group-hover:-translate-x-0.5"><ArrowLeft size={15} /></span>
              Back to the study set
            </Link>
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.16em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><LockKeyhole size={13} /> private reading room</span>
              <span className="hidden h-1 w-1 rounded-full bg-primary sm:block" />
              <span className="hidden sm:inline">{query.data.progress}% of set read</span>
            </div>
          </header>

          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">now reading · {currentIndex + 1} of {documents.length}</p>
              <h1 className="mt-2 truncate font-serif text-3xl font-bold tracking-tight text-foreground md:text-5xl" data-testid="text-reader-document-title">{currentDocument.name}</h1>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-reader-context">
                <BookOpen size={15} className="text-secondary" />
                {query.data.title}
                {currentDocument.pageCount ? <><span className="text-border">·</span>{currentDocument.pageCount} pages</> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {objectUrl && <a href={objectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" data-testid="link-open-pdf-new-tab"><ExternalLink size={14} /> <span className="hidden sm:inline">Open separately</span></a>}
              <span className="inline-flex items-center gap-2 rounded-xl bg-secondary/10 px-3 py-2 text-xs font-bold text-secondary"><LockKeyhole size={14} /> Just you</span>
            </div>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[218px_minmax(0,1fr)_238px] lg:items-start">
            <aside className="rounded-[24px] border border-border bg-[#f7f0e3] p-3 shadow-[0_8px_24px_hsl(235_34%_18%/.06)]" aria-label="Documents in this study set">
              <div className="flex items-center justify-between px-2 pb-2">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-muted-foreground">in this set</p>
                <span className="text-xs font-bold text-primary">{documents.length}</span>
              </div>
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
                {documents.map((document, index) => {
                  const active = document.id === currentDocument.id;
                  return (
                    <Link
                      key={document.id}
                      href={`/study-sets/${studySetId}/read/${document.id}`}
                      aria-current={active ? "page" : undefined}
                      className={`group flex min-w-[190px] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset lg:min-w-0 ${active ? "bg-primary text-primary-foreground shadow-[3px_3px_0_hsl(235_34%_18%/.16)]" : "text-foreground/70 hover:bg-accent/60 hover:text-foreground"}`}
                      data-testid={`link-reader-document-${document.id}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-primary-foreground/15" : "bg-primary/10 text-primary"}`}><FileText size={15} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{document.name}</span>
                        <span className={`mt-0.5 block text-[10px] font-medium ${active ? "text-primary-foreground/65" : "text-muted-foreground"}`}>{document.pageCount ? `${document.pageCount} pages` : "PDF document"} · {index + 1}</span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <div className="mt-3 hidden border-t border-border/70 px-2 pt-3 lg:block">
                <p className="text-[11px] leading-relaxed text-muted-foreground">Use <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">←</kbd> <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">→</kbd> to move between papers.</p>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="overflow-hidden rounded-[26px] border border-[#d5c7b2] bg-[#cfc2ae] shadow-[0_14px_34px_hsl(235_34%_18%/.13)]">
                <div className="flex items-center justify-between border-b border-[#b9aa95] bg-[#e6dac8] px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground/70"><span className="h-2 w-2 rounded-full bg-secondary" /> Selectable PDF view</div>
                  <span className="text-[10px] font-bold uppercase tracking-[.15em] text-muted-foreground">private file</span>
                </div>
                <div
                  ref={viewerRef}
                  className="relative min-h-[62vh] bg-[#bdb09d] p-2 sm:p-4"
                  onMouseUp={capturePdfSelection}
                  onKeyUp={capturePdfSelection}
                >
                  {!canReadPdf ? (
                    <div className="grid min-h-[60vh] place-items-center rounded-xl border-2 border-dashed border-[#a99b88] bg-[#e8dece] px-6 text-center">
                      <div className="max-w-sm">
                        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-foreground"><FileText size={27} /></span>
                        <h2 className="mt-5 font-serif text-2xl font-bold">{currentDocument.processingStatus === "processing" ? "This paper is still arriving." : "This paper needs a little attention."}</h2>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">The PDF viewer will open here once the document is ready to read.</p>
                        <span className="mt-5 inline-flex rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold capitalize text-foreground">{currentDocument.processingStatus.replace("_", " ")}</span>
                      </div>
                    </div>
                  ) : objectUrl ? (
                    <PdfDocument
                      key={currentDocument.id}
                      file={objectUrl}
                      onLoadSuccess={({ numPages }) => {
                        setViewerLoaded(true);
                        setRenderedPageCount(numPages);
                        const boundedPage = Math.min(readingPage, numPages);
                        if (boundedPage !== readingPage) {
                          setReadingPage(boundedPage);
                          setNotePage(boundedPage);
                        }
                        saveReadingPosition(boundedPage, numPages);
                      }}
                      loading={<div className="grid min-h-[60vh] place-items-center rounded-xl bg-[#e8dece]"><p className="text-xs font-semibold text-muted-foreground">Opening your paper…</p></div>}
                      error={<div className="grid min-h-[60vh] place-items-center rounded-xl bg-[#e8dece] px-6 text-center"><div><AlertCircle className="mx-auto text-primary" size={30} /><p className="mt-3 font-serif text-xl font-bold">This PDF could not be displayed.</p><p className="mt-2 text-sm text-muted-foreground">Try opening it separately or return to the study set.</p></div></div>}
                      className={`flex min-h-[60vh] justify-center overflow-auto rounded-xl transition-opacity duration-300 ${viewerLoaded ? "opacity-100" : "opacity-0"}`}
                    >
                      <PdfPage
                        pageNumber={readingPage}
                        width={Math.min(viewerWidth - 32, 920)}
                        renderAnnotationLayer
                        renderTextLayer
                        data-testid="controlled-pdf-page"
                      />
                    </PdfDocument>
                  ) : (
                    <div className="grid min-h-[60vh] place-items-center rounded-xl border-2 border-dashed border-[#a99b88] bg-[#e8dece] px-6 text-center">
                      <div><FileText className="mx-auto text-primary" size={34} /><p className="mt-4 font-serif text-xl font-bold">No private file path found.</p><p className="mt-2 text-sm text-muted-foreground">Return to the study set and try another document.</p></div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#e6dac8] px-4 py-3 text-xs text-muted-foreground">
                  <span>{canReadPdf ? "Select any text to start a note with this page attached." : "Preparing a quiet place for this paper."}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => changeReadingPage(readingPage - 1)} disabled={readingPage <= 1} className="rounded-lg p-1.5 font-bold hover:bg-card disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button>
                    <label className="flex items-center gap-1 font-bold text-foreground/70">Page <input type="number" min={1} max={pageCount ?? undefined} value={readingPage} onChange={(event) => changeReadingPage(Number(event.target.value) || 1)} className="w-16 rounded-lg border border-[#b9aa95] bg-[#f7f0e3] px-2 py-1 text-center text-foreground" data-testid="input-reading-page" /></label>
                    <span className="font-bold text-foreground/60">{pageCount ? `of ${pageCount}` : ""}</span>
                    <button type="button" onClick={() => changeReadingPage(readingPage + 1)} disabled={Boolean(pageCount && readingPage >= pageCount)} className="rounded-lg p-1.5 font-bold hover:bg-card disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                {previousDocument ? (
                  <Link href={`/study-sets/${studySetId}/read/${previousDocument.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold text-muted-foreground hover:bg-card hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-reader-previous"><ChevronLeft size={17} /> Previous</Link>
                ) : <span />}
                <span className="text-[11px] font-bold uppercase tracking-[.15em] text-muted-foreground">{currentIndex + 1} / {documents.length}</span>
                {nextDocument ? (
                  <Link href={`/study-sets/${studySetId}/read/${nextDocument.id}`} className="inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-bold text-primary hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="link-reader-next">Next paper <ChevronRight size={17} /></Link>
                ) : <span />}
              </div>
            </section>

            <aside className="rounded-[24px] border border-border bg-[#f7f0e3] p-4 shadow-[0_8px_24px_hsl(235_34%_18%/.06)]" aria-label="Annotation space">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-foreground"><Highlighter size={19} /></span>
                <span className="rounded-full bg-secondary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary">{notesQuery.data?.length ?? 0} private</span>
              </div>
              <h2 className="mt-4 font-serif text-2xl font-bold">Your margin</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Select a passage in the PDF to bring its text and page here automatically.</p>
              {!showComposer && <button type="button" onClick={() => setShowComposer(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground hover:brightness-110" data-testid="button-add-annotation"><StickyNote size={14} /> Save a passage</button>}
              {showComposer && (
                <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-3" data-testid="note-composer">
                  <div className="flex items-center justify-between"><p className="text-xs font-bold">{editingNote ? "Edit note" : "New note"}</p><button type="button" onClick={resetComposer} aria-label="Close note editor"><X size={15} /></button></div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Page<input type="number" min={1} max={currentDocument.pageCount ?? undefined} value={notePage} onChange={(event) => setNotePage(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground" data-testid="input-note-page" /></label>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Selected passage<textarea value={selectedText} onChange={(event) => setSelectedText(event.target.value)} rows={4} maxLength={5000} placeholder="Select text in the PDF or type a passage…" className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-2 py-2 text-sm normal-case tracking-normal text-foreground" data-testid="textarea-selected-passage" /></label>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your note<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={5000} placeholder="What do you want to remember?" className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-2 py-2 text-sm normal-case tracking-normal text-foreground" data-testid="textarea-note-body" /></label>
                  <button type="button" onClick={saveNote} disabled={!selectedText.trim() || createNote.isPending || updateNote.isPending} className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-note">{createNote.isPending || updateNote.isPending ? "Saving…" : "Save note"}</button>
                </div>
              )}
              <div className="mt-4 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                {notesQuery.isLoading && <p className="rounded-xl bg-[#efe6d4] p-3 text-xs text-muted-foreground">Loading your notes…</p>}
                {!notesQuery.isLoading && !notesQuery.data?.length && <div className="rounded-2xl border border-dashed border-[#cdbda6] bg-[#efe6d4] p-4"><StickyNote className="text-primary" size={19} /><p className="mt-3 text-sm font-bold">Your first mark is waiting.</p></div>}
                {notesQuery.data?.map((note) => (
                  <article key={note.id} className="rounded-2xl border border-border bg-card p-3" data-testid={`note-${note.id}`}>
                    <div className="flex items-center justify-between gap-2"><span className="rounded-full bg-accent px-2 py-1 text-[10px] font-bold">Page {note.page}</span><div className="flex gap-1"><button type="button" onClick={() => beginEdit(note)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Edit note"><Pencil size={13} /></button><button type="button" onClick={() => { if (window.confirm("Delete this note?")) deleteNote.mutate({ noteId: note.id }); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Delete note"><Trash2 size={13} /></button></div></div>
                    <blockquote className="mt-3 border-l-2 border-primary pl-2 text-xs italic leading-relaxed text-foreground/75">“{note.selectedText}”</blockquote>
                    {note.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.body}</p>}
                    {note.explanation && <div className="mt-3 rounded-xl bg-secondary/10 p-3"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary"><Sparkles size={12} /> Plain-language explanation</p><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{note.explanation}</p><p className="mt-3 border-t border-secondary/15 pt-2 text-[10px] font-bold text-muted-foreground">Reference: {currentDocument.name}, page {note.page}</p></div>}
                    <button type="button" onClick={() => explainNote.mutate({ noteId: note.id })} disabled={explainNote.isPending} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-secondary hover:underline disabled:opacity-50"><Sparkles size={13} /> {note.explanation ? "Regenerate explanation" : "Explain simply"}</button>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}