import React, { useState, Suspense } from "react";
import { User, Bot, Copy, Check, FileCheck } from "lucide-react";
import type { Message, Citation, AgentTrace } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AgentActivityTrace } from "./AgentActivityTrace";

const MarkdownContent = React.lazy(() => import("./MarkdownContent"));

interface ChatMessageItemProps {
  message: Message;
  onSelectCitation: (citation: Citation) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({ message, onSelectCitation }) => {
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);
    const [copiedWithCitations, setCopiedWithCitations] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard failure
      }
    };

    const handleCopyWithCitations = async () => {
      try {
        let textToCopy = message.content;
        if (message.citations && message.citations.length > 0) {
          textToCopy += "\n\n### Audited Sources & Verbatim Excerpts:\n";
          for (const c of message.citations) {
            const meta = c.citation_metadata || {};
            const ticker = meta.ticker || "SEC";
            const form = meta.form_type || "10-K";
            const fy = meta.fiscal_year ? ` FY${meta.fiscal_year}` : "";
            const section = meta.section_name || meta.section ? ` | ${meta.section_name || meta.section}` : "";
            textToCopy += `[${c.citation_index}] ${ticker} ${form}${fy}${section}\n`;
            if (c.excerpt) {
              textToCopy += `> "${c.excerpt.trim()}"\n\n`;
            }
          }
        }
        await navigator.clipboard.writeText(textToCopy);
        setCopiedWithCitations(true);
        setTimeout(() => setCopiedWithCitations(false), 2000);
      } catch {
        // Ignore clipboard failure
      }
    };

    const agentTrace = (message.message_json?.agent_trace as AgentTrace) || null;

    return (
      <div
        className={`group flex gap-2.5 sm:gap-3 max-w-3xl w-full ${
          isUser ? "ml-auto flex-row-reverse" : "mr-auto"
        }`}
      >
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs mt-0.5 select-none ${
            isUser
              ? "bg-surface-800 text-slate-300 border border-surface-700"
              : "bg-accent-glow text-accent border border-accent/40"
          }`}
          aria-hidden="true"
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Bubble */}
        <div
          className={`relative rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 text-xs shadow-sm max-w-[88%] sm:max-w-[85%] space-y-2 ${
            isUser
              ? "bg-accent text-surface-950 font-medium break-words"
              : "bg-surface-900 border border-surface-800/90 text-slate-200"
          }`}
        >
          {/* Header & Actions */}
          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-mono select-none">
            <span className={isUser ? "text-surface-950/80 font-semibold" : "text-slate-400"}>
              {isUser ? "Analyst Query" : "SEC Copilot"}
            </span>

            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
              <button
                type="button"
                onClick={handleCopy}
                className={`p-1 rounded flex items-center gap-1 cursor-pointer transition min-h-[28px] ${
                  isUser
                    ? "text-surface-950/70 hover:text-surface-950 hover:bg-black/10"
                    : "text-slate-400 hover:text-accent hover:bg-surface-800"
                }`}
                title="Copy text only"
                aria-label="Copy text only"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-accent" />
                    <span className="text-[10px]">Copied</span>
                  </>
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>

              {!isUser && message.citations && message.citations.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyWithCitations}
                  className="p-1 rounded flex items-center gap-1 cursor-pointer text-slate-400 hover:text-accent hover:bg-surface-800 transition min-h-[28px]"
                  title="Copy with verbatim SEC citations"
                  aria-label="Copy with verbatim SEC citations"
                >
                  {copiedWithCitations ? (
                    <>
                      <Check className="w-3 h-3 text-accent" />
                      <span className="text-[10px]">+Sources</span>
                    </>
                  ) : (
                    <FileCheck className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Assistant: Agent Execution Trace (Collapsed by default, expandable) */}
          {!isUser && agentTrace && (
            <AgentActivityTrace trace={agentTrace} isGenerating={false} />
          )}

          {/* Content Body */}
          {isUser ? (
            <div className="whitespace-pre-wrap leading-relaxed select-text">{message.content}</div>
          ) : (
            <Suspense
              fallback={
                <div className="whitespace-pre-wrap leading-relaxed animate-pulse text-slate-400">
                  {message.content}
                </div>
              }
            >
              <MarkdownContent
                content={message.content}
                citations={message.citations || []}
                onSelectCitation={onSelectCitation}
              />
            </Suspense>
          )}

          {/* Sources (N) Strip under assistant response */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-surface-800/80 space-y-1.5 select-none">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                Sources ({message.citations.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((c) => {
                  const meta = c.citation_metadata || {};
                  const section = typeof (meta.section_name || meta.section) === "string"
                    ? String(meta.section_name || meta.section)
                    : null;
                  return (
                    <button
                      key={c.id || `cit-${c.citation_index}`}
                      type="button"
                      onClick={() => onSelectCitation(c)}
                      aria-label={`Inspect citation [${c.citation_index}] for ${meta.ticker || "SEC"}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-950 hover:bg-surface-850 text-[11px] text-slate-300 border border-surface-800 hover:border-accent/50 transition cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent min-h-[32px]"
                    >
                      <span className="font-mono text-accent font-bold">
                        [{c.citation_index}]
                      </span>
                      <span className="font-medium text-slate-200">{meta.ticker || "SEC"}</span>
                      {meta.fiscal_year && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          FY{meta.fiscal_year}
                        </span>
                      )}
                      {section && (
                        <span className="text-slate-500 font-mono text-[9px] max-w-[100px] truncate hidden sm:inline">
                          {section}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timestamp footer */}
          <div className="pt-1 text-[10px] font-mono text-slate-500 flex items-center justify-between select-none">
            <span className={isUser ? "text-surface-950/70" : "text-slate-500"}>
              {formatDate(message.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

ChatMessageItem.displayName = "ChatMessageItem";

export default ChatMessageItem;
