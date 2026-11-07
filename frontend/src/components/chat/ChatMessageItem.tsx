import React, { useState, Suspense } from "react";
import { User, Bot, Copy, Check } from "lucide-react";
import type { Message, Citation } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const MarkdownContent = React.lazy(() => import("./MarkdownContent"));

interface ChatMessageItemProps {
  message: Message;
  onSelectCitation: (citation: Citation) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(
  ({ message, onSelectCitation }) => {
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Ignore clipboard failure
      }
    };

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
              ? "bg-slate-800 text-slate-300 border border-slate-700"
              : "bg-emerald-950 text-emerald-400 border border-emerald-800"
          }`}
          aria-hidden="true"
        >
          {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Message Bubble */}
        <div
          className={`relative rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 text-xs shadow-sm max-w-[85%] sm:max-w-[80%] space-y-2 ${
            isUser
              ? "bg-emerald-600 text-white font-medium break-words"
              : "bg-slate-900 border border-slate-800/90 text-slate-200"
          }`}
        >
          {/* Header / Copy action */}
          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 font-mono select-none">
            <span className={isUser ? "text-emerald-100" : "text-slate-400"}>
              {isUser ? "Analyst Query" : "SEC Assistant"}
            </span>

            <button
              type="button"
              onClick={handleCopy}
              className={`p-1 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition flex items-center gap-1 cursor-pointer ${
                isUser
                  ? "text-emerald-100 hover:text-white hover:bg-emerald-700/50"
                  : "text-slate-400 hover:text-emerald-400 hover:bg-slate-800"
              }`}
              title="Copy message content"
              aria-label="Copy message content"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span className="text-[10px]">Copied</span>
                </>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

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

          {/* Sources summary badges below assistant response */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 select-none">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                Verified Sources ({message.citations.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((c) => {
                  const meta = c.citation_metadata || {};
                  return (
                    <button
                      key={c.id || `cit-${c.citation_index}`}
                      type="button"
                      onClick={() => onSelectCitation(c)}
                      aria-label={`Inspect citation [${c.citation_index}] for ${meta.ticker || "SEC"}`}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 hover:border-emerald-600/50 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    >
                      <span className="font-mono text-emerald-400 font-bold">
                        [{c.citation_index}]
                      </span>
                      <span className="font-medium text-slate-200">{meta.ticker || "SEC"}</span>
                      {meta.fiscal_year && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          FY{meta.fiscal_year}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timestamp footer */}
          <div className="pt-1 text-[10px] font-mono text-slate-400 flex items-center justify-between select-none">
            <span className={isUser ? "text-emerald-200" : "text-slate-400"}>
              {formatDate(message.created_at)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

ChatMessageItem.displayName = "ChatMessageItem";
