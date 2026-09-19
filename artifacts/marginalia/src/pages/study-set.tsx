import { useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, Brain, FileText, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useGetStudySet } from "@workspace/api-client-react";
import { AppShell, DocumentRow, ProgressBar } from "@/components/marginalia-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function HubLoading() {
  return <AppShell><div className="mx-auto max-w-5xl space-y-6 px-5 py-10 md:px-10"><div className="h-5 w-32 animate-pulse rounded bg-muted" /><div className="h-52 animate-pulse rounded-3xl bg-muted" /><div className="h-72 animate-pulse rounded-3xl bg-muted" /></div></AppShell>;
}

export default function StudySetPage() {
  const { studySetId = "" } = useParams<{ studySetId: string }>();
  const [, setLocation] = useLocation();
  const [recallOpen, setRecallOpen] = useState(false);
  const query = useGetStudySet(studySetId);
  if (query.isLoading) return <HubLoading />;
  if (query.isError || !query.data) return <AppShell><div className="mx-auto max-w-xl px-5 py-24 text-center"><AlertCircle className="mx-auto text-primary" size={36} /><h1 className="mt-5 font-serif text-3xl font-bold">We lost the thread.</h1><p className="mt-2 text-sm text-muted-foreground">This study set isn’t available right now.</p><button type="button" onClick={() => void query.refetch()} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="button-retry-study-set"><RotateCcw size={16} /> Try again</button></div></AppShell>;
  const set = query.data;
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-10 md:py-12">
        <Link href="/home" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary" data-testid="link-back-home"><ArrowLeft size={16} /> Back to your desk</Link>
        <section className="relative mt-7 overflow-hidden rounded-3xl bg-blue p-7 text-background md:p-10">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[24px] border-accent/40" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-accent">study set · private room</p>
            <h1 className="mt-3 max-w-2xl font-serif text-4xl font-bold leading-tight md:text-6xl">{set.title}</h1>
            <div className="mt-7 flex flex-wrap items-center gap-6 text-sm font-semibold text-background/75"><span className="flex items-center gap-2"><FileText size={16} /> {set.documentCount} documents</span><span className="flex items-center gap-2"><Sparkles size={16} /> {set.noteCount} notes</span><span className="flex items-center gap-2"><LockKeyhole size={15} /> only you can see this</span></div>
            <div className="mt-8 max-w-xl"><div className="flex items-center justify-between text-xs font-bold"><span>your progress</span><span>{set.progress}%</span></div><div className="mt-2 h-3 rounded-full bg-background/20"><div className="h-full rounded-full bg-accent" style={{ width: `${set.progress}%` }} /></div></div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">the reading pile</p><h2 className="mt-2 font-serif text-3xl font-bold">Documents</h2></div><span className="text-sm font-semibold text-muted-foreground">{set.documents.length} tucked in here</span></div>
          <div className="mt-5 rounded-3xl border border-border bg-card px-5 md:px-7">{set.documents.length ? set.documents.map((document) => <DocumentRow key={document.id} document={document} studySetId={studySetId} />) : <div className="py-14 text-center"><FileText className="mx-auto text-muted-foreground" size={32} /><p className="mt-3 font-serif text-xl font-bold">Nothing on the desk yet</p></div>}</div>
        </section>

        <section className="mt-12">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-secondary">coming into focus</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">Choose how to return</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <ModeCard icon={BookOpen} title="Reader" copy="A calm, paper-colored space for slow pages and thoughtful marks." color="bg-accent" onClick={() => setLocation(`/study-sets/${studySetId}/read/${set.documents[0]?.id ?? ""}`)} disabled={!set.documents.length} />
            <ModeCard icon={Brain} title="Recall" copy="Choose one PDF and answer five questions grounded only in that document." color="bg-primary" onClick={() => setRecallOpen(true)} disabled={!set.documents.length} />
          </div>
        </section>
      </div>
      <Dialog open={recallOpen} onOpenChange={setRecallOpen}>
        <DialogContent className="rounded-3xl border-2 border-blue bg-background p-6 shadow-[6px_6px_0_#252944] sm:max-w-xl md:p-8">
          <DialogHeader>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-primary">Recall · five questions</p>
            <DialogTitle className="font-serif text-3xl font-bold">Choose one PDF</DialogTitle>
            <DialogDescription className="leading-relaxed">Recall uses only selectable text from the document you choose. Scanned PDFs without text cannot make a quiz yet.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            {set.documents.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setLocation(`/study-sets/${studySetId}/recall/${document.id}`)}
                className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                data-testid={`button-recall-document-${document.id}`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText size={20} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{document.name}</span><span className="mt-1 block text-xs text-muted-foreground">Private quiz from this document only</span></span>
                <ArrowRight className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" size={18} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ModeCard({ icon: Icon, title, copy, color, onClick, disabled }: { icon: typeof BookOpen; title: string; copy: string; color: string; onClick: () => void; disabled: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:border-primary disabled:cursor-not-allowed disabled:opacity-50" data-testid={`button-mode-${title.toLowerCase()}`}><span className={`grid h-12 w-12 place-items-center rounded-2xl ${color} ${color === "bg-primary" ? "text-primary-foreground" : "text-foreground"}`}><Icon size={23} /></span><h3 className="mt-6 flex items-center justify-between font-serif text-2xl font-bold">{title}<ArrowRight className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" size={18} /></h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></button>;
}