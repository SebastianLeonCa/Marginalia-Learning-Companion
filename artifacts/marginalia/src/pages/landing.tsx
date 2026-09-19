import { ArrowRight, BookOpen, Leaf, LockKeyhole, Quote, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { BrandMark, TinyBotanical } from "@/components/marginalia-ui";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <BrandMark />
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex" data-testid="link-landing-sign-in">Sign in</Link>
          <Link href="/sign-up" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110" data-testid="link-landing-sign-up">Open your desk</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-10 md:grid-cols-[1.05fr_.95fr] md:px-8 md:pb-28 md:pt-20">
          <div className="animate-float-in">
            <p className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> a private room for big ideas</p>
            <h1 className="max-w-xl font-serif text-[clamp(3.5rem,8vw,7.3rem)] font-bold leading-[.88] tracking-[-.06em]">Read deeply.<br /><span className="text-primary">Remember more.</span></h1>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">Marginalia turns dense papers and books into a study practice you’ll actually return to — one thoughtful session at a time.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/sign-up" className="inline-flex items-center gap-3 rounded-2xl bg-primary px-6 py-4 font-bold text-primary-foreground shadow-[4px_4px_0_hsl(var(--foreground))] hover:-translate-y-0.5" data-testid="button-landing-start">Start a study set <ArrowRight size={18} /></Link>
              <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LockKeyhole size={15} /> Your materials stay private</span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[500px] animate-float-in [animation-delay:120ms]">
            <div className="absolute -right-1 top-3 h-56 w-56 rounded-full bg-accent/80 blur-[1px]" />
            <div className="relative rotate-2 rounded-[2.5rem] border-2 border-foreground bg-[#f6e6c6] p-5 shadow-[8px_8px_0_hsl(var(--foreground))]">
              <div className="flex items-center justify-between border-b-2 border-foreground/15 pb-4">
                <span className="font-serif text-lg font-bold">today’s little harvest</span><span className="text-xs font-bold text-primary">04 / 12</span>
              </div>
              <div className="mt-6 rounded-2xl bg-[#fff5dc] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-secondary">currently reading</p>
                <h2 className="mt-3 font-serif text-3xl font-bold leading-tight">The Work of Art in the Age of Mechanical Reproduction</h2>
                <div className="mt-6 flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-[#ead8ae]"><div className="h-full w-[68%] rounded-full bg-primary" /></div><span className="text-sm font-bold">68%</span></div>
                <p className="mt-3 text-xs text-muted-foreground">page 14 of 21 · 12 min left</p>
              </div>
              <div className="mt-6 flex items-end justify-between">
                <div><p className="font-serif text-2xl font-bold">7 days</p><p className="text-xs font-medium text-muted-foreground">of showing up</p></div>
                <TinyBotanical color="hsl(var(--secondary))" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/80 bg-card/70 px-5 py-20 md:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-2xl"><p className="mb-3 text-[11px] font-bold uppercase tracking-[.2em] text-secondary">not another dashboard</p><h2 className="font-serif text-4xl font-bold leading-tight md:text-5xl">A small place to put your thinking.</h2></div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                { icon: BookOpen, color: "bg-primary", title: "Bring the hard stuff", copy: "Upload the papers, books, and notes that deserve more than a browser tab." },
                { icon: Sparkles, color: "bg-accent", title: "Make meaning stick", copy: "Return to your ideas with gentle prompts, progress, and a little momentum." },
                { icon: Leaf, color: "bg-secondary", title: "Keep your own trail", copy: "Your reading life belongs to you. Private materials, personal pace, no feed." },
              ].map(({ icon: Icon, color, title, copy }) => (
                <div key={title} className="paper-card rounded-2xl border border-border bg-background p-6">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${color} ${color === "bg-accent" ? "text-foreground" : "text-primary-foreground"}`}><Icon size={22} /></span>
                  <h3 className="mt-8 font-serif text-2xl font-bold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col items-center px-5 py-20 text-center md:px-8 md:py-28">
          <Quote className="text-primary" size={34} />
          <p className="mt-5 max-w-2xl font-serif text-3xl font-bold leading-tight md:text-5xl">“The margins are where the real conversation happens.”</p>
          <p className="mt-5 text-sm font-semibold text-muted-foreground">— a note to your future self</p>
          <Link href="/sign-up" className="mt-10 inline-flex items-center gap-2 rounded-xl border-2 border-foreground px-5 py-3 text-sm font-bold hover:bg-foreground hover:text-background" data-testid="link-landing-cta">Make room for reading <ArrowRight size={16} /></Link>
        </section>
      </main>
      <footer className="border-t border-border/70 px-5 py-8 text-center text-xs font-semibold text-muted-foreground">marginalia · a quiet place for loud ideas</footer>
    </div>
  );
}