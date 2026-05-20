import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-6 border-b">
        <div className="text-xl font-semibold tracking-tight">ResumeAI</div>
        <nav className="flex gap-2">
          <Button asChild variant="ghost"><Link href="/login">Log in</Link></Button>
          <Button asChild><Link href="/signup">Get started</Link></Button>
        </nav>
      </header>
      <section className="flex-1 grid place-items-center px-6">
        <div className="max-w-2xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Score your resume against any job — in seconds.
          </h1>
          <p className="text-muted-fg text-lg">
            ResumeAI parses your resume and any job description, computes an ATS score,
            highlights missing skills, and tells you exactly what to improve.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild size="lg"><Link href="/signup">Try it free</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Log in</Link></Button>
          </div>
          <p className="text-xs text-muted-fg pt-4">
            Phase 1 — scoring &amp; recommendations. Optimizer and auto-apply coming next.
          </p>
        </div>
      </section>
      <footer className="p-6 text-center text-xs text-muted-fg border-t">© ResumeAI</footer>
    </main>
  );
}
