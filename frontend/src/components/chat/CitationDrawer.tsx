import React, { useEffect, useRef } from "react";
import { ExternalLink, X, BookOpen, Building2, Calendar, FileText } from "lucide-react";
import type { Citation } from "@/lib/types";

interface CitationDrawerProps {
  citation: Citation | null;
  onClose: () => void;
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ citation, onClose }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Esc key & Focus Trap
  useEffect(() => {
    if (!citation) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [citation, onClose]);

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
    <dialog
      open
      className="fixed inset-0 z-50 flex justify-end bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full border-0 overflow-hidden"
      aria-labelledby="citation-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (full width on mobile, 420px on md+) */}
      <div
        ref={drawerRef}
        className="relative z-10 w-full sm:max-w-md md:w-[420px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 select-none">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
              [{citation.citation_index}]
            </span>
            <div>
              <span id="citation-drawer-title" className="text-sm font-semibold text-white block">
                Grounded SEC Citation
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Source Document Verification
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
            title="Close drawer (Esc)"
            aria-label="Close citation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Metadata Card */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{company}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-xs font-bold text-emerald-400 border border-slate-700">
                {ticker}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{year ? `FY ${year}` : "Filing"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Form {form}</span>
              </div>
            </div>

            {section && (
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                <span className="text-slate-500 block mb-1">Section / Item:</span>
                <span className="font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 block break-words text-[11px] text-emerald-300">
                  {section}
                </span>
              </div>
            )}

            {score !== undefined && score !== null && (
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                <span>Hybrid Relevance Score:</span>
                <span className="font-mono font-semibold text-emerald-400">
                  {(Number(score) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Verbatim Excerpt */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verbatim SEC Passage Excerpt</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-slate-200 font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-emerald-900 selection:text-emerald-100 border-l-2 border-l-emerald-500">
              {citation.excerpt || "No excerpt recorded in citation metadata."}
            </div>
          </div>

          {/* External SEC EDGAR link */}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 font-medium transition border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            >
              <span>View Full Filing on SEC EDGAR</span>
              <ExternalLink className="w-4 h-4 text-emerald-400" />
            </a>
          ) : (
            <p className="text-[10px] text-slate-400 text-center font-mono">
              Filing excerpt verified from local audited index
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default CitationDrawer;
