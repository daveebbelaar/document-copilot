import React, { useState } from "react";
import {
  Search,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Clock,
} from "lucide-react";
import type { AgentTrace } from "@/lib/types";

interface AgentActivityTraceProps {
  trace?: AgentTrace | null;
  isGenerating?: boolean;
  liveStep?: string | null;
  liveElapsedMs?: number;
}

export const AgentActivityTrace: React.FC<AgentActivityTraceProps> = ({
  trace,
  isGenerating = false,
  liveStep,
  liveElapsedMs = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(isGenerating);

  if (!trace && !isGenerating) return null;

  const totalMs = trace?.total_elapsed_ms ?? liveElapsedMs;
  const elapsedSec = (totalMs / 1000).toFixed(1);
  const passages = trace?.passages || [];
  const sourceCount = trace?.retrieved_count ?? passages.length;

  // Render collapsed bar when not generating and not manually expanded
  if (!isGenerating && !isExpanded) {
    return (
      <div className="mb-2 select-none">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-950/80 border border-surface-800 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:border-surface-700 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span>
            Researched in <strong className="text-white font-semibold">{elapsedSec}s</strong> ·{" "}
            <strong className="text-white font-semibold">{sourceCount}</strong> sources
          </span>
          <ChevronRight className="w-3 h-3 text-slate-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl bg-surface-950 border border-surface-800 p-3 sm:p-3.5 space-y-3 font-mono text-xs select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-surface-850 pb-2">
        <div className="flex items-center gap-1.5 text-accent font-semibold text-[11px]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isGenerating ? "Agent Execution Trace" : "Research Trace"}</span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="tabular-nums">{elapsedSec}s</span>
          </span>
          {!isGenerating && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="hover:text-white transition p-0.5 rounded cursor-pointer"
              title="Collapse trace"
              aria-label="Collapse trace"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-2 text-[11px]">
        {/* Step 1: Searching filings */}
        <div className="flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2">
            {isGenerating && (!liveStep || liveStep === "init") ? (
              <div className="w-3.5 h-3.5 rounded-full border border-accent border-t-transparent animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
            )}
            <span className="flex items-center gap-1.5">
              <Search className="w-3 h-3 text-slate-400" />
              Searching SEC 10-K filings corpus
            </span>
          </div>
        </div>

        {/* Step 2: Retrieved passages */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-300">
            <div className="flex items-center gap-2">
              {isGenerating && liveStep === "retrieval_started" ? (
                <div className="w-3.5 h-3.5 rounded-full border border-accent border-t-transparent animate-spin" />
              ) : passages.length > 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
              )}
              <span className="flex items-center gap-1.5">
                <Database className="w-3 h-3 text-slate-400" />
                Found {passages.length} relevant SEC passages
              </span>
            </div>
          </div>

          {/* Passage Chips */}
          {passages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-5 pt-0.5">
              {passages.map((p, idx) => (
                <span
                  key={`chip-${p.ticker}-${p.fiscal_year}-${p.n || idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-900 border border-surface-800 text-[10px] text-slate-300"
                >
                  <span className="font-bold text-accent">{p.ticker}</span>
                  {p.fiscal_year && <span className="text-slate-400">FY{p.fiscal_year}</span>}
                  <span className="text-slate-500 max-w-[120px] truncate">{p.section}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Step 3: Reciprocal Rank Fusion */}
        <div className="flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2">
            {passages.length > 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
            )}
            <span className="flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-slate-400" />
              Merging results (dense pgvector 1536d + BM25 tsvector)
            </span>
          </div>
        </div>

        {/* Step 4: Writing Answer */}
        <div className="flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2">
            {isGenerating && liveStep === "validating" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
            ) : isGenerating ? (
              <div className="w-3.5 h-3.5 rounded-full border border-accent border-t-transparent animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
            )}
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-slate-400" />
              Synthesizing grounded answer
            </span>
          </div>
        </div>

        {/* Step 5: Grounding Verification */}
        <div className="flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-2">
            {!isGenerating ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
            ) : liveStep === "validating" ? (
              <div className="w-3.5 h-3.5 rounded-full border border-accent border-t-transparent animate-spin" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
            )}
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verifying citations against audited SEC chunks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentActivityTrace;
