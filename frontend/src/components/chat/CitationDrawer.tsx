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
  const rawSection = meta.section_name || meta.section;
  const section = typeof rawSection === "string" ? rawSection : "General Section";
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
        className="fixed inset-0 bg-surface-950/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (full width on mobile, 440px on md+) */}
      <div
        ref={drawerRef}
        className="relative z-10 w-full sm:max-w-md md:w-[440px] bg-surface-900 border-l border-surface-800 shadow-2xl flex flex-col h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-surface-800 flex items-center justify-between bg-surface-950/80 select-none">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-accent-glow text-accent border border-accent/40 font-bold">
              [{citation.citation_index}]
            </span>
            <div>
              <span id="citation-drawer-title" className="text-sm font-semibold text-white block">
                Grounded SEC Citation
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Verbatim Source Verification
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="Close drawer (Esc)"
            aria-label="Close citation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Metadata Card */}
          <div className="bg-surface-950 border border-surface-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Building2 className="w-4 h-4 text-accent shrink-0" />
                <span className="truncate">{company}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-surface-850 font-mono text-xs font-bold text-accent border border-surface-700">
                {ticker}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-surface-800">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{year ? `FY ${year}` : "Annual Filing"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Form {form}</span>
              </div>
            </div>

            {section && (
              <div className="pt-2 border-t border-surface-800 text-[11px] text-slate-300">
                <span className="text-slate-500 block mb-1">Section / Item:</span>
                <span className="font-mono bg-surface-900 px-2.5 py-1.5 rounded border border-surface-800 block break-words text-[11px] text-emerald-300">
                  {section}
                </span>
              </div>
            )}

            {score !== undefined && score !== null && (
              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                <span>RRF Relevance Score:</span>
                <span className="font-semibold text-accent">
                  {(Number(score) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Verbatim Excerpt */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <BookOpen className="w-3.5 h-3.5 text-accent" />
              <span>Verbatim SEC Passage Excerpt</span>
            </div>
            <div className="bg-surface-950 border border-surface-800 rounded-xl p-3.5 text-slate-200 font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap selection:bg-accent-glow selection:text-white border-l-2 border-l-accent">
              {citation.excerpt || "No excerpt recorded in citation metadata."}
            </div>
          </div>

          {/* External SEC EDGAR link */}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-surface-800 hover:bg-surface-750 text-white font-medium transition border border-surface-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
            >
              <span>View Full Filing on SEC EDGAR</span>
              <ExternalLink className="w-4 h-4 text-accent" />
            </a>
          ) : (
            <p className="text-[10px] text-slate-500 text-center font-mono">
              Filing excerpt verified from local audited index
            </p>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default CitationDrawer;
