import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, AlertCircle } from "lucide-react";

interface MessageComposerProps {
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  placeholder?: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = React.memo(
  ({ isLoading, onSendMessage, placeholder = "Ask about 10-K financial metrics, notes, or risk factors..." }) => {
    const [text, setText] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-grow textarea up to max-h-40 (160px)
    const adjustTextareaHeight = useCallback(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const maxHeight = 160;
      const newHeight = Math.min(el.scrollHeight, maxHeight);
      el.style.height = `${Math.max(newHeight, 44)}px`;
    }, []);

    useEffect(() => {
      adjustTextareaHeight();
    }, [text, adjustTextareaHeight]);

    const handleSend = () => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      onSendMessage(trimmed);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="max-w-3xl mx-auto relative flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={placeholder}
              aria-label="Ask financial question"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 pr-12 text-sm sm:text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none disabled:opacity-60 overflow-y-auto min-h-[44px]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !text.trim()}
            aria-label="Send message"
            className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:hover:bg-emerald-600 transition flex items-center justify-center shrink-0 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="max-w-3xl mx-auto flex items-center justify-between mt-2 text-[10px] text-slate-400 px-1 select-none">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">Strict grounding: ungrounded answers are flagged</span>
            <span className="sm:hidden">Strict SEC grounding</span>
          </div>
          <span className="hidden sm:inline">Shift + Enter for new line</span>
        </div>
      </div>
    );
  }
);

MessageComposer.displayName = "MessageComposer";

