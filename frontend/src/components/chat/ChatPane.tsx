import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, AlertCircle } from "lucide-react";
import type { Message, Citation } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface ChatPaneProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  onSelectCitation: (citation: Citation) => void;
  activeThreadTitle?: string | null;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onSelectCitation,
  activeThreadTitle,
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || isLoading) return;

    setInput("");
    await onSendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Helper to render text with interactive citation badges [1], [2], etc.
  const renderMessageContent = (msg: Message) => {
    if (msg.role !== "assistant" || !msg.citations || msg.citations.length === 0) {
      return <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>;
    }

    // Split text by bracketed numbers like [1], [2]
    const parts = msg.content.split(/(\[\d+\])/g);
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          const match = part.match(/^\[(\d+)\]$/);
          if (match) {
            const index = parseInt(match[1], 10);
            const citation = msg.citations.find((c) => c.citation_index === index);
            if (citation) {
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectCitation(citation)}
                  className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/80 hover:bg-emerald-900 hover:text-emerald-200 hover:border-emerald-600 transition cursor-pointer"
                  title={`View SEC Citation [${index}]`}
                >
                  [{index}]
                </button>
              );
            }
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  const samplePrompts = [
    "What were Apple's total net sales in fiscal 2025 and how did Services perform?",
    "Summarize Apple's primary risk factors regarding supply chain dependencies.",
    "What segment generated the highest revenue for Apple according to Note 11?",
  ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-slate-950">
      {/* Header bar */}
      <div className="px-6 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {activeThreadTitle || "SEC Filing Analysis"}
          </h2>
          <p className="text-[11px] text-slate-400">
            Answers are strictly grounded in 10-K filings with verifiable citations.
          </p>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto my-12 text-center space-y-6">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-white">
                Driftwood Capital Document Copilot
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Ask targeted financial, strategic, or risk questions across SEC 10-K filings.
                Every figure and claim includes bracketed citations linked to source passages.
              </p>
            </div>

            <div className="space-y-2 text-left max-w-lg mx-auto">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Suggested Analyst Queries:
              </span>
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(prompt)}
                  className="w-full text-left p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 text-xs text-slate-300 transition block group cursor-pointer"
                >
                  <span className="text-emerald-400 group-hover:text-emerald-300 font-mono mr-2">
                    &rarr;
                  </span>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                    isUser
                      ? "bg-slate-800 text-slate-300 border border-slate-700"
                      : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-xl px-4 py-3 text-xs shadow-sm space-y-2 ${
                    isUser
                      ? "bg-emerald-600 text-white font-medium"
                      : "bg-slate-900 border border-slate-800 text-slate-200"
                  }`}
                >
                  {renderMessageContent(msg)}

                  {/* Citation Sources Footer for Assistant messages */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                        Sources & Grounded Citations ({msg.citations.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c) => {
                          const meta = c.citation_metadata || {};
                          return (
                            <button
                              key={c.id}
                              onClick={() => onSelectCitation(c)}
                              className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 transition cursor-pointer"
                              title="Click to view filing excerpt"
                            >
                              <span className="font-mono text-emerald-400 font-bold">
                                [{c.citation_index}]
                              </span>
                              <span>{meta.ticker || "SEC"}</span>
                              <span className="text-slate-400">
                                {meta.fiscal_year ? `FY${meta.fiscal_year}` : ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                    <span>{formatDate(msg.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Loading / Generating Turn */}
        {isLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="rounded-xl px-4 py-3 bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Retrieving SEC 10-K passages and validating citations...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask about 10-K financial metrics, notes, or risk factors (Enter to submit)..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:hover:bg-emerald-600 transition cursor-pointer"
            title="Send query"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="max-w-3xl mx-auto flex items-center justify-between mt-2 text-[10px] text-slate-400 px-1">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-emerald-400" />
            <span>Strict grounding: ungrounded answers are flagged</span>
          </div>
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};
