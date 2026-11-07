import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bot, Sparkles, ArrowDown, RotateCcw } from "lucide-react";
import type { Message, Citation } from "@/lib/types";
import { ChatMessageItem } from "./ChatMessageItem";
import { MessageComposer } from "./MessageComposer";

interface ChatPaneProps {
  messages: Message[];
  isLoading: boolean;
  isInitialLoading?: boolean;
  onSendMessage: (content: string) => void;
  onCancelGeneration?: () => void;
  onRetryLastMessage?: () => void;
  onSelectCitation: (citation: Citation) => void;
  activeThreadTitle?: string | null;
  errorMessage?: string | null;
}

const SUGGESTED_QUERIES = [
  {
    ticker: "AAPL",
    query: "What were Apple's total net sales in fiscal 2025 and how did Services perform?",
  },
  {
    ticker: "MSFT vs GOOGL",
    query: "Compare Microsoft and Google cloud segment growth and revenue drivers in their latest 10-K filings.",
  },
  {
    ticker: "NVDA",
    query: "Summarize Nvidia's data center revenue concentration and supply chain risk factors.",
  },
  {
    ticker: "AMZN",
    query: "What are Amazon's primary risk factors regarding AWS infrastructure and third-party sellers?",
  },
  {
    ticker: "GOOGL",
    query: "Detail Alphabet's advertising revenue breakdown and AI capital expenditures in fiscal 2024.",
  },
];

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  isLoading,
  isInitialLoading = false,
  onSendMessage,
  onCancelGeneration,
  onRetryLastMessage,
  onSelectCitation,
  activeThreadTitle,
  errorMessage,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for pending research turn
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLoading) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Detect whether user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(distanceToBottom < 120);
  }, []);

  // Auto-scroll to bottom only if user is near bottom
  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isNearBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsNearBottom(true);
  };

  const renderedMessages = useMemo(
    () =>
      messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          message={msg}
          onSelectCitation={onSelectCitation}
        />
      )),
    [messages, onSelectCitation]
  );

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Header Bar */}
      <div className="px-4 sm:px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-sm select-none shrink-0">
        <div className="min-w-0 pr-4">
          <h1 className="text-xs sm:text-sm font-semibold text-white truncate">
            {activeThreadTitle || "SEC Filing Analysis"}
          </h1>
          <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
            Strictly grounded in audited 10-K filings with verifiable citations.
          </p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 relative"
      >
        {isInitialLoading ? (
          <div className="max-w-2xl mx-auto space-y-4 py-8">
            <div className="h-16 rounded-xl bg-slate-900/60 animate-pulse" />
            <div className="h-28 rounded-xl bg-slate-900/40 animate-pulse ml-auto w-3/4" />
            <div className="h-32 rounded-xl bg-slate-900/60 animate-pulse mr-auto w-4/5" />
          </div>
        ) : messages.length === 0 ? (
          /* Empty State */
          <div className="max-w-2xl mx-auto my-6 sm:my-10 text-center space-y-5 px-2">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Driftwood Capital Research Copilot
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Query audited SEC 10-K filings across Apple, Microsoft, Nvidia, Amazon, and Alphabet. Every claim is mathematically verified with interactive citations.
              </p>
            </div>

            <div className="space-y-2 text-left max-w-xl mx-auto pt-2">
              <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block px-1">
                Suggested Analyst Queries:
              </span>
              <div className="grid gap-2">
                {SUGGESTED_QUERIES.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => onSendMessage(item.query)}
                    className="w-full text-left p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-xs text-slate-200 transition group cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                        {item.ticker}
                      </span>
                      <span className="text-emerald-400 group-hover:translate-x-0.5 transition-transform text-xs font-mono">
                        &rarr;
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{item.query}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          renderedMessages
        )}

        {/* Pending Turn: Researching Filings with Timer & Cancel */}
        {isLoading && (
          <div
            className="flex gap-2.5 sm:gap-3 max-w-3xl mr-auto animate-in fade-in duration-200"
            role="status"
            aria-live="polite"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="rounded-2xl px-4 py-3 bg-slate-900 border border-slate-800 text-xs text-slate-200 flex flex-wrap items-center gap-2.5 sm:gap-3 shadow-md">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-medium">Researching filings…</span>
              <span className="font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 text-[11px] font-bold">
                {elapsedSeconds}s
              </span>
              {onCancelGeneration && (
                <button
                  type="button"
                  onClick={onCancelGeneration}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 text-slate-400 border border-slate-700 text-[11px] font-medium transition cursor-pointer ml-auto"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error state with Retry */}
        {errorMessage && !isLoading && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/70 text-rose-300 text-xs flex items-center justify-between gap-3 max-w-3xl">
            <span className="truncate">{errorMessage}</span>
            {onRetryLastMessage && (
              <button
                type="button"
                onClick={onRetryLastMessage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-rose-100 font-semibold text-xs border border-rose-700 transition cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Floating "Jump to latest" button */}
      {!isNearBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Jump to latest message"
          className="absolute bottom-24 right-6 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/60 border border-emerald-400/40 transition cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          <span>Jump to latest</span>
        </button>
      )}

      {/* Message Composer (Isolated state so typing never re-renders message list) */}
      <MessageComposer
        isLoading={isLoading}
        onSendMessage={onSendMessage}
      />
    </main>
  );
};

export default ChatPane;
