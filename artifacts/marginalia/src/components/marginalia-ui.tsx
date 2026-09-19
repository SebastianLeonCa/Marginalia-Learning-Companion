import { useClerk, useUser } from "@clerk/react";
import type { ReactNode } from "react";
import { BookOpen, ChevronRight, FileText, Home, LogOut, Plus, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Document, StudySet } from "@workspace/api-client-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 ${compact ? "" : "w-fit"}`} data-testid="link-brand">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-primary text-primary-foreground scribble-border !shadow-none">
        <BookOpen size={19} strokeWidth={2.6} />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-foreground bg-accent" />
      </span>
      {!compact && <span className="font-serif text-2xl font-bold tracking-tight">marginalia</span>}
    </Link>
  );
}

export function TinyBotanical({ color = "hsl(var(--secondary))" }: { color?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 90" className="h-20 w-24" style={{ color }}>
      <path d="M47 84C50 67 51 50 51 31" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M52 44C29 45 18 34 19 16c19-1 31 7 33 28M50 61c21 3 31-6 32-22-17-4-28 3-32 22" fill="currentColor" opacity=".88" />
      <circle cx="52" cy="22" r="9" fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="3" />
    </svg>
  );
}

export function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute left-[8%] top-5 h-3 w-1.5 rotate-12 bg-primary" />
      <span className="absolute left-[16%] top-14 h-2 w-2 rotate-45 rounded-full bg-accent" />
      <span className="absolute right-[14%] top-7 h-3 w-1.5 -rotate-45 bg-secondary" />
      <span className="absolute right-[7%] top-20 h-2 w-5 rotate-12 bg-primary" />
      <span className="absolute left-[40%] top-1 h-2 w-2 rounded-full bg-blue" />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const initials = (user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "R").toUpperCase();
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="hidden w-[252px] shrink-0 flex-col bg-sidebar px-5 py-6 text-sidebar-foreground md:flex">
        <BrandMark />
        <div className="mt-12 flex-1">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.22em] text-sidebar-foreground/50">your desk</p>
          <nav className="space-y-1">
            <Link href="/home" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${location === "/home" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`} data-testid="link-home">
              <Home size={17} /> Home
            </Link>
            <Link href="/home#study-sets" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-study-sets">
              <BookOpen size={17} /> Study sets
            </Link>
          </nav>
          <div className="mt-10 rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
            <TinyBotanical color="hsl(var(--accent))" />
            <p className="mt-1 font-serif text-base font-semibold">A little each day.</p>
            <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/60">Small marks become a body of work.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-sidebar-border pt-5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-accent font-serif font-bold text-foreground">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.firstName ?? "Reader"}</p>
            <p className="truncate text-xs text-sidebar-foreground/50">private study room</p>
          </div>
          <button type="button" onClick={() => signOut({ redirectUrl: "/" })} className="rounded-lg p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Sign out" data-testid="button-sign-out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 md:hidden">
          <BrandMark compact />
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold">{initials}</span>
            <button type="button" onClick={() => signOut({ redirectUrl: "/" })} aria-label="Sign out" data-testid="button-mobile-sign-out"><LogOut size={17} /></button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-primary">{eyebrow}</p>}
        <h2 className="font-serif text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, note, color }: { label: string; value: number | string; note: string; color: "red" | "yellow" | "green" | "blue" }) {
  const fills = { red: "bg-primary", yellow: "bg-accent", green: "bg-secondary", blue: "bg-blue" };
  const text = color === "yellow" ? "text-foreground" : "text-primary-foreground";
  return (
    <div className={`${fills[color]} ${text} paper-card rounded-2xl p-5`}>
      <p className="text-[11px] font-bold uppercase tracking-[.16em] opacity-75">{label}</p>
      <p className="mt-3 font-serif text-4xl font-bold">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-75">{note}</p>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} /></div>;
}

export function StudySetCard({ set }: { set: StudySet }) {
  return (
    <Link href={`/study-sets/${set.id}`} className="paper-card group block rounded-2xl border border-border bg-card p-5" data-testid={`card-study-set-${set.id}`}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-foreground"><BookOpen size={20} /></span>
        <span className="text-xs font-bold text-muted-foreground">{set.progress}% read</span>
      </div>
      <h3 className="mt-5 line-clamp-2 font-serif text-xl font-bold">{set.title}</h3>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{set.documentCount} {set.documentCount === 1 ? "document" : "documents"}</span>
        <span>{set.noteCount} notes</span>
      </div>
      <ProgressBar value={set.progress} />
      <div className="mt-4 flex items-center justify-between text-xs font-semibold text-primary">
        <span>{set.lastOpenedAt ? "Continue reading" : "Start exploring"}</span>
        <ChevronRight className="transition-transform group-hover:translate-x-1" size={16} />
      </div>
    </Link>
  );
}

export function DocumentRow({ document }: { document: Document }) {
  const status = document.processingStatus === "ready" ? "Ready to read" : document.processingStatus === "processing" ? "Making sense of it…" : document.processingStatus.replace("_", " ");
  return (
    <div className="flex items-center gap-4 border-b border-border/70 py-4 last:border-0" data-testid={`row-document-${document.id}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText size={19} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{document.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{document.pageCount ? `${document.pageCount} pages · ` : ""}{Math.max(1, Math.round(document.size / 1024 / 1024 * 10) / 10)} MB</p>
      </div>
      <span className={`hidden rounded-full px-3 py-1 text-[11px] font-bold capitalize sm:inline-flex ${document.processingStatus === "ready" ? "bg-secondary/15 text-secondary" : "bg-accent text-foreground"}`}>{status}</span>
    </div>
  );
}

export function EmptyStudySets({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="motif-dots relative overflow-hidden rounded-3xl border-2 border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="mx-auto grid h-20 w-20 rotate-[-5deg] place-items-center rounded-[28px] bg-accent text-foreground scribble-border"><Sparkles size={32} /></div>
      <h3 className="mt-6 font-serif text-2xl font-bold">Your desk is waiting</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Start with one paper, a chapter, or the book that has been staring back at you.</p>
      <button type="button" onClick={onCreate} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:brightness-110" data-testid="button-empty-create"><Plus size={17} /> Make a study set</button>
    </div>
  );
}