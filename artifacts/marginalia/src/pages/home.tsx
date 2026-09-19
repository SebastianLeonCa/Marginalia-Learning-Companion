import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { AlertCircle, ArrowRight, Check, FilePlus2, Flame, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useCreateStudySet, useGetDashboardSummary, useListStudySets, useRequestUploadUrl } from "@workspace/api-client-react";
import { AppShell, Confetti, EmptyStudySets, ProgressBar, SectionHeading, StatCard, StudySetCard } from "@/components/marginalia-ui";

type SelectedFile = { file: File; objectPath?: string; status: "queued" | "uploading" | "uploaded" | "error" };

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadUrl = useRequestUploadUrl();
  const createSet = useCreateStudySet();
  const queryClient = useQueryClient();
  const busy = uploadUrl.isPending || createSet.isPending || files.some((item) => item.status === "uploading");

  if (!open) return null;
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    setFiles((current) => [...current, ...pdfs].slice(0, 5).map((file) => typeof file === "object" && "file" in file ? file : { file, status: "queued" }));
    setError(pdfs.length !== incoming.length ? "Only PDF files can join a study set." : "");
  };
  const removeFile = (index: number) => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const submit = async () => {
    if (!title.trim() || files.length === 0) { setError("Give your study set a name and add at least one PDF."); return; }
    try {
      setError("");
      const uploaded: { name: string; size: number; objectPath: string }[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const selected = files[index];
        setFiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: "uploading" } : item));
        const signed = await uploadUrl.mutateAsync({ data: { name: selected.file.name, size: selected.file.size, contentType: selected.file.type || "application/pdf" } });
        const response = await fetch(signed.uploadURL, { method: "PUT", headers: { "Content-Type": selected.file.type || "application/pdf" }, body: selected.file });
        if (!response.ok) throw new Error("The file could not be uploaded.");
        uploaded.push({ name: selected.file.name, size: selected.file.size, objectPath: signed.objectPath });
        setFiles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, status: "uploaded", objectPath: signed.objectPath } : item));
      }
      const created = await createSet.mutateAsync({ data: { title: title.trim(), documents: uploaded } });
      await queryClient.invalidateQueries({ queryKey: ["/api/study-sets"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      setTitle(""); setFiles([]); onClose();
      setLocation(`/study-sets/${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
      setFiles((current) => current.map((item) => item.status === "uploading" ? { ...item, status: "error" } : item));
    }
  };
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative max-h-[90dvh] w-full max-w-xl overflow-auto rounded-3xl border-2 border-foreground bg-background p-6 shadow-[8px_8px_0_hsl(var(--foreground))] md:p-8">
        <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-lg p-2 hover:bg-muted" aria-label="Close upload dialog" data-testid="button-close-upload"><X size={18} /></button>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">new study set</p>
        <h2 className="mt-2 font-serif text-3xl font-bold">What are we reading?</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bundle up to five PDFs into one private little room.</p>
        <label className="mt-7 block text-sm font-bold" htmlFor="study-set-title">Study set name</label>
        <input id="study-set-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Methods & Memory" maxLength={160} className="mt-2 w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" data-testid="input-study-set-title" />
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(event) => addFiles(event.target.files)} data-testid="input-pdf-files" />
        <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-5 py-8 text-center hover:bg-primary/10" data-testid="button-choose-pdfs">
          <UploadCloud className="text-primary" size={28} /><span className="mt-3 font-bold">Choose PDF files</span><span className="mt-1 text-xs text-muted-foreground">Drop your reading here · up to 5 files</span>
        </button>
        {files.length > 0 && <div className="mt-4 space-y-2">{files.map((item, index) => <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-sm"><FilePlus2 size={16} className="text-primary" /><span className="min-w-0 flex-1 truncate font-medium">{item.file.name}</span>{item.status === "uploading" ? <Loader2 className="animate-spin text-primary" size={16} /> : item.status === "uploaded" ? <Check className="text-secondary" size={16} /> : <button type="button" onClick={() => removeFile(index)} className="p-1 text-muted-foreground hover:text-primary" aria-label={`Remove ${item.file.name}`} data-testid={`button-remove-file-${index}`}><X size={15} /></button>}</div>)}</div>}
        {error && <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary" role="alert" data-testid="status-upload-error"><AlertCircle size={16} />{error}</p>}
        <button type="button" disabled={busy} onClick={submit} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:cursor-wait disabled:opacity-60" data-testid="button-create-study-set">{busy ? <><Loader2 className="animate-spin" size={17} /> Making your room…</> : <>Create study set <ArrowRight size={17} /></>}</button>
      </div>
    </div>
  );
}

function HomeContent() {
  const { user } = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const summary = useGetDashboardSummary();
  const studySets = useListStudySets();
  const greeting = user?.firstName ? `Good to see you, ${user.firstName}.` : "Good to see you.";
  const sets = studySets.data ?? [];
  const loading = summary.isLoading || studySets.isLoading;
  const retry = () => { void summary.refetch(); void studySets.refetch(); };
  if (loading) return <AppShell><div className="mx-auto max-w-6xl space-y-7 px-5 py-10 md:px-10"><div className="h-8 w-56 animate-pulse rounded-lg bg-muted" /><div className="h-32 animate-pulse rounded-3xl bg-muted" /><div className="grid gap-4 md:grid-cols-4"><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="h-32 animate-pulse rounded-2xl bg-muted" /><div className="h-32 animate-pulse rounded-2xl bg-muted" /></div></div></AppShell>;
  if (summary.isError || studySets.isError) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><AlertCircle className="mx-auto text-primary" size={36} /><h1 className="mt-5 font-serif text-3xl font-bold">Your desk got a little tangled.</h1><p className="mt-2 text-sm text-muted-foreground">We couldn’t load your reading room just now.</p><button type="button" onClick={retry} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-retry-home"><RotateCcw size={16} /> Try again</button></div></AppShell>;
  const stats = summary.data!;
  return (
    <AppShell>
      <div className="relative mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
        {stats.currentStreak >= 5 && <Confetti />}
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">your reading room</p><h1 className="mt-2 font-serif text-4xl font-bold tracking-tight md:text-5xl">{greeting}</h1><p className="mt-2 text-sm text-muted-foreground">Here’s what’s growing on your desk.</p></div>
          <button type="button" onClick={() => setDialogOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[3px_3px_0_hsl(var(--foreground))] hover:-translate-y-0.5" data-testid="button-new-study-set"><FilePlus2 size={17} /> New study set</button>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Study sets" value={stats.totalStudySets} note="rooms of thinking" color="red" />
          <StatCard label="Documents" value={stats.totalDocuments} note="worth returning to" color="yellow" />
          <StatCard label="Notes made" value={stats.totalNotes} note={`${stats.flaggedCount} flagged for later`} color="green" />
          <StatCard label="Points gathered" value={stats.totalPoints} note="earned by showing up" color="blue" />
        </div>
        {stats.continueReading && <section className="mt-10 overflow-hidden rounded-3xl bg-secondary p-6 text-secondary-foreground md:p-8"><div className="flex flex-wrap items-center justify-between gap-6"><div><p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] opacity-75"><Flame size={15} /> Pick up where you left off</p><h2 className="mt-3 max-w-xl font-serif text-3xl font-bold">{stats.continueReading.studySetTitle}</h2><p className="mt-2 text-sm opacity-75">{stats.continueReading.documentName} · page {stats.continueReading.page}</p></div><Link href={`/study-sets/${stats.continueReading.studySetId}/read/${stats.continueReading.documentId}`} className="inline-flex items-center gap-2 rounded-xl bg-background px-5 py-3 text-sm font-bold text-foreground hover:-translate-y-0.5" data-testid="link-continue-reading">Continue reading <ArrowRight size={16} /></Link></div><div className="mt-7 flex items-center gap-4"><ProgressBar value={stats.continueReading.progress} /><span className="text-sm font-bold">{stats.continueReading.progress}%</span></div></section>}
        <section id="study-sets" className="mt-12"><SectionHeading eyebrow="your collection" title="Study sets"><button type="button" onClick={() => setDialogOpen(true)} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline" data-testid="button-add-study-set"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground"><FilePlus2 size={14} /></span> Add a set</button></SectionHeading>{sets.length > 0 ? <div className="mt-6 grid gap-4 lg:grid-cols-3">{sets.map((set) => <StudySetCard key={set.id} set={set} />)}</div> : <div className="mt-6"><EmptyStudySets onCreate={() => setDialogOpen(true)} /></div>}</section>
        <div className="mt-12 grid gap-5 md:grid-cols-[1.2fr_.8fr]">
          <div className="rounded-3xl border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-primary">momentum</p><h2 className="mt-2 font-serif text-2xl font-bold">Your current streak</h2></div><span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-foreground"><Flame size={22} /></span></div><p className="mt-5 font-serif text-5xl font-bold">{stats.currentStreak}<span className="ml-2 text-base font-sans font-semibold text-muted-foreground">days in a row</span></p><p className="mt-2 text-sm text-muted-foreground">A small, steady flame is still a flame.</p></div>
          <div className="rounded-3xl bg-primary p-6 text-primary-foreground"><p className="text-[11px] font-bold uppercase tracking-[.18em] opacity-75">tiny nudge</p><p className="mt-5 font-serif text-2xl font-bold leading-tight">The best annotation is the one you make before the thought gets away.</p><p className="mt-5 text-xs font-semibold opacity-70">— from the margins</p></div>
        </div>
      </div>
      <UploadDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </AppShell>
  );
}

export default HomeContent;