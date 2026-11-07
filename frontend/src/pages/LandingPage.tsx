import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Lock,
  GitBranch,
  Sparkles,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const DEMO_STEPS = [
  { id: 1, label: "Scanning SEC index for AAPL FY2025 10-K", duration: "142ms" },
  { id: 2, label: "Retrieved 4 passages: Item 7 (MD&A) & Item 8 (Note 2 Segment Info)", duration: "320ms" },
  { id: 3, label: "Reciprocal Rank Fusion: dense pgvector (1536d) + lexical BM25 tsvector", duration: "485ms" },
  { id: 4, label: "PydanticAI agent synthesizing grounded financial metrics", duration: "1.4s" },
  { id: 5, label: "Deterministic Grounding Validator: 2/2 citations verified against chunks", duration: "18ms" },
];

const COVERAGE_DATA = [
  { ticker: "AAPL", name: "Apple Inc.", cik: "0000320193", fy: "FY2025", period: "10-K Annual Report", items: "Items 1, 1A, 7, 7A, 8" },
  { ticker: "MSFT", name: "Microsoft Corporation", cik: "0000789019", fy: "FY2024", period: "10-K Annual Report", items: "Items 1, 1A, 7, 7A, 8" },
  { ticker: "NVDA", name: "NVIDIA Corporation", cik: "0001045810", fy: "FY2025", period: "10-K Annual Report", items: "Items 1, 1A, 7, 7A, 8" },
  { ticker: "AMZN", name: "Amazon.com, Inc.", cik: "0001018724", fy: "FY2024", period: "10-K Annual Report", items: "Items 1, 1A, 7, 7A, 8" },
  { ticker: "GOOGL", name: "Alphabet Inc.", cik: "0001652044", fy: "FY2024", period: "10-K Annual Report", items: "Items 1, 1A, 7, 7A, 8" },
];

export const LandingPage: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeCitationPreview, setActiveCitationPreview] = useState<number | null>(null);

  // Non-blocking async check for existing user session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    }).catch(() => {
      // Ignore background session check error
    });
  }, []);

  // Product demo step cycle animation (static data, no API calls)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < DEMO_STEPS.length ? prev + 1 : prev));
    }, 900);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-surface-950 text-slate-100 flex flex-col selection:bg-accent/30 selection:text-white">
      {/* Top Navigation */}
      <header className="h-16 border-b border-surface-800/80 bg-surface-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent-glow border border-accent/30 flex items-center justify-center text-accent">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="font-serif text-base font-bold text-white tracking-tight">
              Driftwood Capital
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-800 text-slate-300 border border-surface-700">
              Copilot
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-3 sm:gap-6 text-xs">
          <a
            href="#how-it-works"
            className="text-slate-400 hover:text-white transition hidden md:inline-block"
          >
            How It Works
          </a>
          <a
            href="#trust"
            className="text-slate-400 hover:text-white transition hidden md:inline-block"
          >
            Grounding & Trust
          </a>
          <a
            href="#coverage"
            className="text-slate-400 hover:text-white transition hidden sm:inline-block"
          >
            Filings Coverage
          </a>
          <a
            href="#architecture"
            className="text-slate-400 hover:text-white transition hidden lg:inline-block"
          >
            Architecture
          </a>

          <Link
            to={session ? "/app" : "/signin"}
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-lg bg-accent text-surface-950 font-semibold hover:bg-accent-hover transition duration-150 min-h-[44px] shadow-sm"
          >
            <span>{session ? "Open workspace" : "Sign in"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="px-4 sm:px-8 pt-16 sm:pt-24 pb-16 max-w-6xl mx-auto text-center space-y-8">
          <div className="space-y-4 max-w-4xl mx-auto">
            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12]">
              SEC 10-K research copilot with guaranteed factual grounding.
            </h1>
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Query audited SEC filings with hybrid vector and lexical retrieval. Every financial metric links directly to the exact verbatim passage in EDGAR. Zero hallucinations.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
            <Link
              to={session ? "/app" : "/signin"}
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-accent text-surface-950 font-semibold text-sm hover:bg-accent-hover transition duration-150 shadow-md min-h-[44px]"
            >
              <span>{session ? "Open workspace" : "Sign in to workspace"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 py-3 px-5 rounded-xl bg-surface-900 border border-surface-800 text-slate-200 text-sm hover:bg-surface-850 hover:text-white transition duration-150 min-h-[44px]"
            >
              <span>See how it works</span>
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Interactive Product Demo (Static Data) */}
          <div className="mt-12 text-left max-w-4xl mx-auto rounded-2xl border border-surface-800 bg-surface-900/90 shadow-2xl overflow-hidden">
            {/* Terminal Window Chrome */}
            <div className="px-4 py-3 bg-surface-950 border-b border-surface-800 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono text-slate-400">
                  driftwood-research-terminal — session #sec-7402
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-accent">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Deterministic Grounding Active</span>
              </div>
            </div>

            <div className="p-5 sm:p-7 space-y-6">
              {/* Question */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-surface-800 border border-surface-700 flex items-center justify-center text-slate-300 shrink-0 text-xs font-mono">
                  Q
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-slate-400">Analyst Query</div>
                  <div className="text-sm font-medium text-white leading-relaxed">
                    What were Apple's Services segment net sales and gross margin in fiscal 2025, and how did it compare to fiscal 2024?
                  </div>
                </div>
              </div>

              {/* Agent Activity Trace (Live Simulated Lighting) */}
              <div className="p-4 rounded-xl bg-surface-950/80 border border-surface-800 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-1 border-b border-surface-850">
                  <span className="flex items-center gap-1.5 text-accent font-semibold">
                    <Sparkles className="w-3 h-3" /> Agent Execution Pipeline
                  </span>
                  <span>Researched in 2.37s · 2 SEC Citations</span>
                </div>

                <div className="space-y-1.5">
                  {DEMO_STEPS.map((step, idx) => {
                    const isDone = activeStep >= idx + 1;
                    const isActive = activeStep === idx;
                    return (
                      <div
                        key={step.id}
                        className={`flex items-center justify-between text-xs font-mono transition-opacity duration-200 ${
                          isDone
                            ? "text-slate-300"
                            : isActive
                            ? "text-accent font-medium animate-pulse"
                            : "text-slate-600"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-current shrink-0" />
                          )}
                          <span>{step.label}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 tabular-nums ml-2">{step.duration}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Verified Answer with Interactive Citations */}
              <div className="flex items-start gap-3 pt-2">
                <div className="w-7 h-7 rounded-lg bg-accent-glow border border-accent/40 flex items-center justify-center text-accent shrink-0 text-xs font-mono">
                  A
                </div>
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>SEC Assistant Response</span>
                    <span className="text-emerald-400 text-[10px]">Verified Factual Output</span>
                  </div>

                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed space-y-2">
                    <p>
                      In fiscal 2025, Apple reported Services segment net sales of{" "}
                      <strong className="text-white font-mono font-semibold">$96,169 million</strong>,
                      representing an increase of 12.9% from $85,200 million in fiscal 2024
                      <button
                        type="button"
                        onClick={() => setActiveCitationPreview(activeCitationPreview === 1 ? null : 1)}
                        className="inline-flex items-center px-1.5 py-0.2 mx-1 rounded text-[11px] font-mono font-bold bg-accent-glow text-accent border border-accent/40 hover:bg-accent/20 cursor-pointer transition"
                        title="Inspect Citation [1]"
                      >
                        [1]
                      </button>
                      . Services gross margin was{" "}
                      <strong className="text-white font-mono font-semibold">74.2%</strong>
                      <button
                        type="button"
                        onClick={() => setActiveCitationPreview(activeCitationPreview === 2 ? null : 2)}
                        className="inline-flex items-center px-1.5 py-0.2 mx-1 rounded text-[11px] font-mono font-bold bg-accent-glow text-accent border border-accent/40 hover:bg-accent/20 cursor-pointer transition"
                        title="Inspect Citation [2]"
                      >
                        [2]
                      </button>
                      , compared to 71.3% in fiscal 2024, driven primarily by favorable mix shift towards recurring software services and App Store volumes.
                    </p>
                  </div>

                  {/* Interactive Citation Inspection Excerpt */}
                  {activeCitationPreview && (
                    <div className="p-3.5 rounded-xl bg-surface-950 border border-accent/40 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-accent font-semibold">
                          SEC Citation [{activeCitationPreview}] — AAPL FY2025 10-K
                        </span>
                        <a
                          href="https://www.sec.gov/edgar/browse/?CIK=0000320193"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-white flex items-center gap-1"
                        >
                          <span>EDGAR Filing</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="font-mono text-[11px] text-slate-300 bg-surface-900 p-2.5 rounded-lg border border-surface-800 leading-relaxed select-text">
                        {activeCitationPreview === 1
                          ? `"...Services net sales were $96,169 million in 2025, compared to $85,200 million in 2024. Services net sales increased 12.9% or $10,969 million during 2025 compared to 2024, driven primarily by advertising, cloud services and Payment Services..."`
                          : `"...Services gross margin was $71,357 million or 74.2% of net sales in fiscal 2025, compared to $60,749 million or 71.3% in fiscal 2024. Services gross margin increased primarily due to higher Services net sales and lower structure costs..."`}
                      </p>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between font-mono">
                        <span>Section: Item 7 — MD&A / Segment Operating Results</span>
                        <span>Chunk ID: chunk-aapl-2025-mdna-p42</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Problem vs Solution Section */}
        <section className="px-4 sm:px-8 py-16 sm:py-20 bg-surface-900/40 border-y border-surface-800/80">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Financial research requires audited truth, not conversational guesses.
              </h2>
              <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                Standard LLMs hallucinate numbers, invent non-existent footnotes, and synthesize obsolete web blogs. DCopilot replaces guesswork with verifiable EDGAR retrieval.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Quo Card */}
              <div className="p-6 rounded-2xl bg-surface-950 border border-surface-800/90 space-y-4">
                <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>The Status Quo: Unassisted & Hallucinatory</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-400 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 shrink-0 font-bold">✕</span>
                    <span>Analysts lose 40+ hours per quarterly cycle manually searching through dense 100+ page 10-K filings.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 shrink-0 font-bold">✕</span>
                    <span>Generic chatbots hallucinate revenue figures, combine different fiscal periods, and make unverified assertions.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-400 shrink-0 font-bold">✕</span>
                    <span>Zero provenance: impossible to confirm which footnote or accounting adjustment produced the output.</span>
                  </li>
                </ul>
              </div>

              {/* DCopilot Solution Card */}
              <div className="p-6 rounded-2xl bg-surface-950 border border-accent/40 space-y-4 shadow-lg shadow-accent/5">
                <div className="flex items-center gap-2 text-accent font-mono text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Document Copilot: Audited & Grounded</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-accent shrink-0 font-bold">✓</span>
                    <span>Multi-turn synthesis across 10-K filings completed with interactive answers in under 3 seconds.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent shrink-0 font-bold">✓</span>
                    <span>Deterministic validator blocks responses unless every claim cites a retrieved SEC passage.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-accent shrink-0 font-bold">✓</span>
                    <span>Clickable inline badges slide open exact source excerpts with direct links to SEC EDGAR accession files.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3. How It Works Section */}
        <section id="how-it-works" className="px-4 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
              The 4-stage retrieval and grounding pipeline.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              From raw SEC EDGAR HTML to verified analyst intelligence, every turn passes through a multi-stage validation pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-surface-900 border border-surface-800 space-y-3">
              <div className="font-mono text-xs text-accent font-bold">01 / RETRIEVE</div>
              <h3 className="text-sm font-semibold text-white">Dual-Index Search</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dense cosine similarity via pgvector (1536-dim embeddings) coupled with sparse BM25 full-text indexing via PostgreSQL tsvector.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-900 border border-surface-800 space-y-3">
              <div className="font-mono text-xs text-accent font-bold">02 / FUSE</div>
              <h3 className="text-sm font-semibold text-white">Reciprocal Rank Fusion</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                RRF algorithm scores and interleaves vector and keyword hits, eliminating vocabulary mismatch and semantic drift.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-900 border border-surface-800 space-y-3">
              <div className="font-mono text-xs text-accent font-bold">03 / ANSWER</div>
              <h3 className="text-sm font-semibold text-white">PydanticAI Agent</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Type-safe LLM orchestration with explicit tools and strict constraints prohibiting ungrounded outside knowledge.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-900 border border-surface-800 space-y-3">
              <div className="font-mono text-xs text-accent font-bold">04 / VERIFY</div>
              <h3 className="text-sm font-semibold text-white">Grounding Validator</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deterministic parser verifies all [N] citation badges against retrieved passages and writes chunk IDs to PostgreSQL.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Trust & Guardrails Section */}
        <section id="trust" className="px-4 sm:px-8 py-16 sm:py-20 bg-surface-900/40 border-y border-surface-800/80">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Designed to refuse when evidence is missing.
              </h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                In financial research, knowing what is NOT in the filing is just as critical as what is. DCopilot adheres to rigid negative constraints.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-xl bg-surface-950 border border-surface-800 space-y-2.5">
                <div className="h-8 w-8 rounded-lg bg-surface-900 border border-surface-700 flex items-center justify-center text-accent">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-semibold text-white">Exact Verbatim Passage Binding</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every claim is tied to the exact chunk ID and accession URL stored in Supabase Postgres.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-surface-950 border border-surface-800 space-y-2.5">
                <div className="h-8 w-8 rounded-lg bg-surface-900 border border-surface-700 flex items-center justify-center text-accent">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-semibold text-white">Explicit Refusal Guardrail</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  If an analyst asks about an unindexed company or metrics missing from the 10-K, the system explicitly states lack of evidence rather than guessing.
                </p>
              </div>

              <div className="p-5 rounded-xl bg-surface-950 border border-surface-800 space-y-2.5">
                <div className="h-8 w-8 rounded-lg bg-surface-900 border border-surface-700 flex items-center justify-center text-accent">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-semibold text-white">Row-Level Security Isolation</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  User threads and queries are strictly isolated in Supabase Postgres via PostgreSQL Row-Level Security (RLS) policies.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Filings Coverage Matrix */}
        <section id="coverage" className="px-4 sm:px-8 py-16 sm:py-24 max-w-5xl mx-auto space-y-8">
          <div className="max-w-2xl">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Ingested SEC Filings Corpus
            </h2>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Audited 10-K filings currently indexed with full section segmentation and hybrid embeddings.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-surface-800 bg-surface-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-surface-800 bg-surface-950/60 font-mono text-[11px] text-slate-400">
                  <th className="py-3.5 px-4 font-semibold">Ticker</th>
                  <th className="py-3.5 px-4 font-semibold">Company Name</th>
                  <th className="py-3.5 px-4 font-semibold">CIK</th>
                  <th className="py-3.5 px-4 font-semibold">Fiscal Period</th>
                  <th className="py-3.5 px-4 font-semibold">Form</th>
                  <th className="py-3.5 px-4 font-semibold">Sections Parsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/80 font-mono text-slate-300">
                {COVERAGE_DATA.map((row) => (
                  <tr key={row.ticker} className="hover:bg-surface-850/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-accent">{row.ticker}</td>
                    <td className="py-3 px-4 text-white font-sans font-medium">{row.name}</td>
                    <td className="py-3 px-4 text-slate-400">{row.cik}</td>
                    <td className="py-3 px-4">{row.fy}</td>
                    <td className="py-3 px-4 text-slate-400">{row.period}</td>
                    <td className="py-3 px-4 text-slate-400">{row.items}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Under the Hood / Architecture (for recruiters) */}
        <section id="architecture" className="px-4 sm:px-8 py-16 sm:py-20 bg-surface-900/40 border-y border-surface-800/80">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Under the Hood: Architecture & Stack
              </h2>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Engineered for production reliability, type safety, and verifiable retrieval.
              </p>
            </div>

            {/* Architecture diagram strip */}
            <div className="p-6 rounded-2xl bg-surface-950 border border-surface-800 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-2">
                  <div className="text-accent font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> Frontend Tier
                  </div>
                  <div className="text-white font-semibold">Vite + React 18 + TS</div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Tailwind v4 OKLCH tokens, TanStack Query cache, zero-latency optimistic CRUD, SSE streaming decoder.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-2">
                  <div className="text-accent font-bold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" /> API & Agent Tier
                  </div>
                  <div className="text-white font-semibold">FastAPI + PydanticAI</div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Python 3.12, strict dependency injection, streaming orchestrator, deterministic grounding validator.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-surface-900 border border-surface-800 space-y-2">
                  <div className="text-accent font-bold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Data & Vector Tier
                  </div>
                  <div className="text-white font-semibold">Supabase + pgvector</div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Single data plane for relational chats, users with RLS, 1536d vector cosine search, and BM25 tsvector.
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-850 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  FastAPI 0.115
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  PydanticAI
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  Supabase pgvector
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  Postgres RLS
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  Alembic 1.14
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  React 18 SPA
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  TanStack Query v5
                </span>
                <span className="px-2.5 py-1 rounded-md bg-surface-900 text-slate-300 border border-surface-800">
                  Tailwind CSS v4
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Final Call to Action */}
        <section className="px-4 sm:px-8 py-16 sm:py-24 max-w-4xl mx-auto text-center space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Accelerate SEC research with verified accuracy.
          </h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Experience the research terminal now. Instant access with email authentication.
          </p>
          <div className="pt-2">
            <Link
              to={session ? "/app" : "/signin"}
              className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-accent text-surface-950 font-semibold text-sm hover:bg-accent-hover transition duration-150 min-h-[44px] shadow-lg shadow-accent/10"
            >
              <span>{session ? "Open research workspace" : "Access research terminal"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800/80 bg-surface-950 py-8 px-4 sm:px-8 text-xs text-slate-400 select-none">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-accent-glow border border-accent/30 flex items-center justify-center text-accent">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <span className="font-serif font-semibold text-white">Driftwood Capital Document Copilot</span>
          </div>

          <div className="text-[11px] text-slate-500">
            Demo project built on public SEC filings. Not investment advice.
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition flex items-center gap-1"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
