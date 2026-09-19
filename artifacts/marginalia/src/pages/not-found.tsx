import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-5">
      <div className="w-full max-w-md rounded-3xl border-2 border-foreground bg-card p-8 text-center shadow-[6px_6px_0_hsl(var(--foreground))]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent text-foreground"><Compass size={30} /></span>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[.2em] text-primary">a page in the margins</p>
        <h1 className="mt-2 font-serif text-4xl font-bold">Nothing here yet.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">This path wandered off the page. Let’s take you back to your desk.</p>
        <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground" data-testid="link-not-found-home"><ArrowLeft size={16} /> Return home</Link>
      </div>
    </div>
  );
}
