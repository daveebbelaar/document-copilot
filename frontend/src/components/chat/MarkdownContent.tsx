import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@/lib/types";

interface MarkdownContentProps {
  content: string;
  citations: Citation[];
  onSelectCitation: (citation: Citation) => void;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  citations,
  onSelectCitation,
}) => {
  const citationMap = React.useMemo(() => {
    const map = new Map<number, Citation>();
    for (const c of citations) {
      map.set(c.citation_index, c);
    }
    return map;
  }, [citations]);

  const processTextWithCitations = (text: string): React.ReactNode => {
    if (!text.includes("[")) return text;
    const parts = text.split(/(\[\d+\])/g);
    if (parts.length === 1) return text;

    return parts.map((part) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const index = parseInt(match[1], 10);
        const citation = citationMap.get(index);
        if (citation) {
          const meta = citation.citation_metadata || {};
          const ticker = meta.ticker || "SEC";
          const fy = meta.fiscal_year ? ` FY${meta.fiscal_year}` : "";
          const section = meta.section_name ? ` • ${meta.section_name}` : "";
          const itemKey = `cite-btn-${citation.id || index}-${meta.ticker || "sec"}`;

          return (
            <span key={itemKey} className="relative inline-block group mx-0.5">
              <button
                type="button"
                onClick={() => onSelectCitation(citation)}
                aria-label={`View SEC Citation [${index}]: ${ticker}${fy}${section}`}
                className="inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900 hover:text-emerald-200 hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 focus:ring-offset-slate-950 transition-colors cursor-pointer"
              >
                [{index}]
              </button>
              {/* Tooltip on hover / keyboard focus */}
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex group-focus-within:flex z-30 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 shadow-xl whitespace-nowrap items-center gap-1 font-mono"
              >
                <span className="font-bold text-emerald-400">{ticker}</span>
                <span>{fy}</span>
                {section && <span className="text-slate-400 max-w-[140px] truncate">{section}</span>}
              </span>
            </span>
          );
        }
      }
      return <React.Fragment key={`txt-${part.slice(0, 16)}`}>{part}</React.Fragment>;
    });
  };

  const transformNode = (children: React.ReactNode): React.ReactNode => {
    if (typeof children === "string") {
      return processTextWithCitations(children);
    }
    if (Array.isArray(children)) {
      return React.Children.map(children, (child) => transformNode(child));
    }
    if (React.isValidElement(children)) {
      const childProps = children.props as { children?: React.ReactNode };
      if (childProps && childProps.children) {
        return React.cloneElement(children, undefined, transformNode(childProps.children));
      }
    }
    return children;
  };

  return (
    <div className="markdown-prose text-xs leading-relaxed text-slate-200 space-y-2 select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{transformNode(children)}</p>,
          li: ({ children }) => <li className="my-0.5">{transformNode(children)}</li>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-white">{transformNode(children)}</strong>,
          em: ({ children }) => <em className="italic text-slate-300">{transformNode(children)}</em>,
          h1: ({ children }) => <h1 className="text-base font-bold text-white mt-3 mb-1">{transformNode(children)}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-2 mb-1">{transformNode(children)}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-semibold text-emerald-300 mt-2 mb-1">{transformNode(children)}</h3>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 max-w-full rounded-lg border border-slate-800 bg-slate-950/60">
              <table className="min-w-full divide-y divide-slate-800 text-left text-xs font-mono">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-900/90 text-slate-300">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider">{transformNode(children)}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-t border-slate-800/60 text-slate-300">{transformNode(children)}</td>,
          code: ({ className, children, ...props }) => {
            const isCodeBlock = Boolean(className) || (typeof children === "string" && children.includes("\n"));
            if (isCodeBlock) {
              return (
                <div className="overflow-x-auto my-2 rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-[11px] text-slate-200">
                  <code {...props}>{children}</code>
                </div>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded bg-slate-800/80 font-mono text-[11px] text-emerald-300 border border-slate-700/50" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
