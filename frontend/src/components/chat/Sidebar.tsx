import React, { useState, useMemo } from "react";
import { MessageSquare, Plus, Trash2, ChevronRight, X, Search } from "lucide-react";
import type { Thread } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (threadId: string) => void;
  onPrefetchThread?: (threadId: string) => void;
  isLoading: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

function groupThreadsByDate(threads: Thread[]): Array<{ title: string; items: Thread[] }> {
  const today: Thread[] = [];
  const yesterday: Thread[] = [];
  const pastWeek: Thread[] = [];
  const older: Thread[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  for (const t of threads) {
    const time = new Date(t.created_at).getTime();
    if (time >= todayStart) {
      today.push(t);
    } else if (time >= yesterdayStart) {
      yesterday.push(t);
    } else if (time >= weekStart) {
      pastWeek.push(t);
    } else {
      older.push(t);
    }
  }

  const result: Array<{ title: string; items: Thread[] }> = [];
  if (today.length > 0) result.push({ title: "Today", items: today });
  if (yesterday.length > 0) result.push({ title: "Yesterday", items: yesterday });
  if (pastWeek.length > 0) result.push({ title: "Previous 7 Days", items: pastWeek });
  if (older.length > 0) result.push({ title: "Older", items: older });

  return result;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(
  ({
    threads,
    activeThreadId,
    onSelectThread,
    onCreateThread,
    onDeleteThread,
    onPrefetchThread,
    isLoading,
    isOpenMobile = false,
    onCloseMobile,
  }) => {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredThreads = useMemo(() => {
      if (!searchQuery.trim()) return threads;
      const lower = searchQuery.toLowerCase();
      return threads.filter((t) => (t.title || "Untitled Research").toLowerCase().includes(lower));
    }, [threads, searchQuery]);

    const grouped = useMemo(() => groupThreadsByDate(filteredThreads), [filteredThreads]);

    const content = (
      <aside className="w-72 sm:w-80 bg-surface-900 border-r border-surface-800 flex flex-col h-full select-none">
        {/* Header / New Thread */}
        <div className="p-3 border-b border-surface-800 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onCreateThread();
                if (onCloseMobile) onCloseMobile();
              }}
              aria-label="Create new research thread (⌘K)"
              className="flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg bg-accent text-surface-950 text-xs font-semibold hover:bg-accent-hover transition duration-150 shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Plus className="w-4 h-4" />
              <span>New Research Thread</span>
            </button>

            {/* Close button for mobile slide-over */}
            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="md:hidden flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter threads..."
              aria-label="Search threads"
              className="w-full bg-surface-950 border border-surface-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-accent transition min-h-[36px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear thread search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable thread list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {isLoading && threads.length === 0 ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-surface-800/40 animate-pulse" />
              ))}
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 font-sans">
              {searchQuery ? "No matching threads found." : "No research threads yet. Ask an SEC question to begin."}
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.title} className="space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  {group.title}
                </div>

                {group.items.map((thread) => {
                  const isActive = thread.id === activeThreadId;
                  return (
                    <div
                      key={thread.id}
                      className="relative group"
                      onMouseEnter={() => onPrefetchThread?.(thread.id)}
                      onFocus={() => onPrefetchThread?.(thread.id)}
                      onTouchStart={() => onPrefetchThread?.(thread.id)}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectThread(thread.id);
                          if (onCloseMobile) onCloseMobile();
                        }}
                        aria-current={isActive ? "page" : undefined}
                        className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition min-h-[44px] ${
                          isActive
                            ? "bg-surface-800 text-white font-medium border border-surface-700/80 shadow-inner"
                            : "text-slate-300 hover:bg-surface-850 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-6">
                          <MessageSquare
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? "text-accent" : "text-slate-500"
                            }`}
                          />
                          <div className="truncate">
                            <p className="truncate font-sans">
                              {thread.title?.trim() || "Untitled Research"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono font-normal">
                              {formatDate(thread.created_at)}
                            </p>
                          </div>
                        </div>

                        {isActive && (
                          <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0 group-hover:hidden" />
                        )}
                      </button>

                      {/* Delete action button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteThread(thread.id);
                        }}
                        aria-label={`Delete thread: ${thread.title || "Untitled Research"}`}
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus:opacity-100 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center hover:text-rose-400 text-slate-500 transition cursor-pointer"
                        title="Delete thread"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer info & shortcuts */}
        <div className="p-3 border-t border-surface-800 text-[11px] text-slate-400 bg-surface-950 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>⌘K / Ctrl+K New</span>
            <span>/ Focus Input</span>
          </div>
          <div className="text-[10px] font-mono text-accent tracking-wider">
            AAPL • MSFT • NVDA • AMZN • GOOGL
          </div>
        </div>
      </aside>
    );

    return (
      <>
        {/* Desktop persistent rail at md+ (768px+) */}
        <div className="hidden md:block h-full shrink-0">{content}</div>

        {/* Mobile slide-over drawer under md */}
        {isOpenMobile && (
          <div className="fixed inset-0 z-40 md:hidden flex animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-surface-950/80 backdrop-blur-sm transition-opacity"
              onClick={onCloseMobile}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div className="relative z-50 h-full max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
              {content}
            </div>
          </div>
        )}
      </>
    );
  }
);

Sidebar.displayName = "Sidebar";

export default Sidebar;
