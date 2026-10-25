import React from "react";
import { MessageSquare, Plus, Trash2, ChevronRight } from "lucide-react";
import type { Thread } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  isLoading,
}) => {
  return (
    <aside className="w-72 bg-slate-900/60 border-r border-slate-800 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      <div className="p-3 border-b border-slate-800/80">
        <button
          onClick={onCreateThread}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Research Thread</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Research History
        </div>

        {isLoading && threads.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 animate-pulse">
            Loading conversations...
          </div>
        ) : threads.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            No research threads yet. Start by asking an SEC question.
          </div>
        ) : (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`group relative flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition ${
                  isActive
                    ? "bg-slate-800 text-white font-medium border border-slate-700/80 shadow-inner"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-6">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? "text-emerald-400" : "text-slate-400"
                    }`}
                  />
                  <div className="truncate">
                    <p className="truncate">
                      {thread.title?.trim() || "Untitled Research"}
                    </p>
                    <p className="text-[10px] text-slate-500 font-normal">
                      {formatDate(thread.created_at)}
                    </p>
                  </div>
                </div>

                <div className="absolute right-2 flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this research thread?")) {
                        onDeleteThread(thread.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-400 transition"
                    title="Delete thread"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400 group-hover:hidden" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-400 bg-slate-950/40">
        <p className="font-medium text-slate-300">Coverage:</p>
        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
          AAPL, MSFT, NVDA, AMZN, GOOGL
        </p>
      </div>
    </aside>
  );
};
