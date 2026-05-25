import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Search, MessageSquare, Sparkles, Lock, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DocGPT — Chat with your documents using AI" },
      { name: "description", content: "Upload PDFs, DOCX, and text files. Get instant answers, summaries, and semantic search across your entire library." },
      { property: "og:title", content: "DocGPT — AI Document Intelligence" },
      { property: "og:description", content: "Upload PDFs, DOCX, and text files. Get instant answers powered by RAG." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-display text-4xl font-sans">DocGPT</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative gradient-hero">
        <div className="mx-auto max-w-5xl px-6 pt-24 pb-32 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Powered by retrieval-augmented generation
          </div>
          <h1 className="font-display text-6xl leading-[1.05] md:text-7xl">
            Your documents,{" "}
            <span className="gradient-text italic">finally searchable</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload PDFs, DOCX, and text files. Ask questions in plain English.
            DocGPT finds the answers across your entire library — with citations.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground glow-border transition hover:opacity-90"
            >
              Start for free
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="rounded-full border border-border bg-surface px-6 py-3 text-sm hover:bg-surface-elevated"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Demo card */}
        <div className="mx-auto -mt-12 max-w-4xl px-6 pb-24">
          <div className="glass rounded-2xl p-2 shadow-2xl">
            <div className="rounded-xl bg-surface p-6">
              <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-destructive/70" />
                <div className="h-2 w-2 rounded-full bg-primary/40" />
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="ml-2">chat.docgpt.app</span>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-xs">You</div>
                  <p className="pt-1">What were the key risks flagged in the Q3 audit report?</p>
                </div>
                <div className="flex gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs text-primary-foreground">L</div>
                  <div className="space-y-2 pt-1">
                    <p>Three risks were flagged <span className="text-primary">[Source 1]</span>:</p>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      <li>Concentration risk in supplier base</li>
                      <li>FX exposure on EU receivables</li>
                      <li>Cybersecurity controls in legacy systems</li>
                    </ul>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3 text-primary" />
                      Q3-2025-Audit.pdf · p.12
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <h2 className="font-display text-4xl md:text-5xl">Everything you need to <span className="italic gradient-text">think faster</span></h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: FileText, title: "Multi-format upload", desc: "PDFs, DOCX, plain text — drop it in and DocGPT handles the rest." },
            { icon: Search, title: "Semantic search", desc: "Find concepts, not just keywords. Vector search across every chunk." },
            { icon: MessageSquare, title: "Chat with citations", desc: "Every answer cites the exact source so you can verify in one click." },
            { icon: Sparkles, title: "Auto summaries", desc: "Every document gets an executive summary the moment it lands." },
            { icon: Lock, title: "Private by default", desc: "Your library is yours. Row-level security keeps it that way." },
            { icon: Zap, title: "Edge-fast", desc: "Built on serverless infrastructure for sub-second response times." },
          ].map((f) => (
            <div key={f.title} className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary/40 hover:bg-surface-elevated">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="rounded-2xl border border-border bg-surface p-12 gradient-hero">
          <h2 className="font-display text-4xl md:text-5xl">Stop searching. Start <span className="italic gradient-text">asking</span>.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Free to try. No credit card required.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground glow-border"
          >
            Create your account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
          © 2026 DocGPT. Built By Deva.
        </div>
      </footer>
    </div>
  );
}
