import React from "react";
import { ExternalLink, X, BookOpen, Building2, Calendar, FileText } from "lucide-react";
import type { Citation } from "@/lib/types";

interface CitationDrawerProps {
  citation: Citation | null;
  onClose: () => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  const meta = citation.citation_metadata || {};
  const ticker = meta.ticker || "SEC";
  const company = meta.company_name || ticker;
  const year = meta.fiscal_year || "";
  const form = meta.form_type || "10-K";
  const section = meta.section_name || "General Section";
  const sourceUrl = meta.source_url || "";
  const score = meta.similarity_score;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
            [{citation.citation_index}]
          </span>
          <span className="text-sm font-semibold text-white">Grounded Citation</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Source metadata card */}
        <div className="bg-slate-950/50 border border-slate-800/80 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-medium text-sm">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <span>{company}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] font-semibold text-slate-300">
              {ticker}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>FY {year}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Form {form}</span>
            </div>
          </div>

          {section && (
            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-300">
              <span className="text-slate-500 block mb-0.5">Section / Item:</span>
              <span className="font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 inline-block">
                {section}
              </span>
            </div>
          )}

          {score !== undefined && score !== null && (
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
              <span>Relevance Score:</span>
              <span className="font-mono text-emerald-400">
                {(Number(score) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        {/* Verbatim passage excerpt */}
        <div>
          <div className="flex items-center gap-1.5 text-slate-400 font-medium mb-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verbatim SEC Passage Excerpt</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-emerald-900 selection:text-emerald-100">
            {citation.excerpt || "No excerpt recorded."}
          </div>
        </div>

        {/* SEC EDGAR source link */}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition border border-slate-700"
          >
            <span>View Full Filing on SEC EDGAR</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        )}
      </div>
    </div>
  );
};
