import { AlertCircle, ArrowLeft, BookOpen, Brain, FileText, Gamepad2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import { Link, useParams } from "wouter";
import { useGetStudySet } from "@workspace/api-client-react";
import { AppShell, DocumentRow, ProgressBar } from "@/components/marginalia-ui";

function HubLoading() {
  return <AppShell><div className="mx-auto max-w-5xl space-y-6 px-5 py-10 md:px-10"><div className="h-5 w-32 animate-pulse rounded bg-muted" /><div className="h-52 animate-pulse rounded-3xl bg-muted" /><div className="h-72 animate-pulse rounded-3xl bg-muted" /></div></AppShell>;
}

export default function StudySetPage() {
  const { studySetId = "" } = useParams<{ studySetId: string }>();
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
          <div className="mt-5 rounded-3xl border border-border bg-card px-5 md:px-7">{set.documents.length ? set.documents.map((document) => <DocumentRow key={document.id} document={document} />) : <div className="py-14 text-center"><FileText className="mx-auto text-muted-foreground" size={32} /><p className="mt-3 font-serif text-xl font-bold">Nothing on the desk yet</p></div>}</div>
        </section>

        <section className="mt-12">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-secondary">coming into focus</p>
          <h2 className="mt-2 font-serif text-3xl font-bold">Choose how to return</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <ModeCard icon={BookOpen} title="Reader" copy="A calm, paper-colored space for slow pages and thoughtful marks." color="bg-accent" />
            <ModeCard icon={Brain} title="Recall" copy="Turn your notes into questions worth answering." color="bg-primary" />
            <ModeCard icon={Gamepad2} title="Practice" copy="A playful way to see what stayed with you." color="bg-secondary" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ModeCard({ icon: Icon, title, copy, color }: { icon: typeof BookOpen; title: string; copy: string; color: string }) {
  return <button type="button" disabled className="group rounded-2xl border border-border bg-card p-5 text-left opacity-90 hover:opacity-100 disabled:cursor-default" data-testid={`button-mode-${title.toLowerCase()}`}><span className={`grid h-12 w-12 place-items-center rounded-2xl ${color} ${color === "bg-primary" ? "text-primary-foreground" : "text-foreground"}`}><Icon size={23} /></span><h3 className="mt-6 flex items-center justify-between font-serif text-2xl font-bold">{title}<span className="rounded-full bg-muted px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">soon</span></h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></button>;
}