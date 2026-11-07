import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatPane } from "@/components/chat/ChatPane";
import { useToast } from "@/components/ui/Toast";
import {
  useThreads,
  useMessages,
  useCreateThread,
  useDeleteThread,
  useUpdateThread,
  prefetchMessages,
  queryClient,
  queryKeys,
} from "@/lib/queries";
import { api, ApiError } from "@/lib/api";
import { streamMessageTurn } from "@/lib/sse";
import type { Thread, Message, Citation, AgentTrace } from "@/lib/types";

const CitationDrawer = React.lazy(() => import("@/components/chat/CitationDrawer"));

interface ChatPageProps {
  userEmail?: string | null;
}

export const ChatPage: React.FC<ChatPageProps> = ({ userEmail }) => {
  const { threadId: urlThreadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeThreadId, setActiveThreadId] = useState<string | null>(urlThreadId || null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isGeneratingTurn, setIsGeneratingTurn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live streaming trace state
  const [liveTrace, setLiveTrace] = useState<AgentTrace | null>(null);
  const [liveStep, setLiveStep] = useState<string | null>(null);
  const [liveElapsedMs, setLiveElapsedMs] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string | null>(null);

  // TanStack Query for server state
  const { data: threads = [], isLoading: isLoadingThreads } = useThreads();
  const { data: messages = [], isLoading: isLoadingMessages } = useMessages(activeThreadId);

  const createThreadMutation = useCreateThread();
  const deleteThreadMutation = useDeleteThread();
  const updateThreadMutation = useUpdateThread();

  // Sync activeThreadId from URL param when URL changes
  useEffect(() => {
    if (urlThreadId && urlThreadId !== activeThreadId) {
      setActiveThreadId(urlThreadId);
    }
  }, [urlThreadId, activeThreadId]);

  // If on /app without threadId and threads exist, select first thread
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      const firstId = threads[0].id;
      setActiveThreadId(firstId);
      navigate(`/app/${firstId}`, { replace: true });
    }
  }, [threads, activeThreadId, navigate]);

  // Prefetch messages on sidebar hover / focus / touchstart
  const handlePrefetchThread = useCallback((threadId: string) => {
    prefetchMessages(queryClient, threadId);
  }, []);

  // Select a thread and update URL
  const handleSelectThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      setActiveCitation(null);
      setErrorMessage(null);
      navigate(`/app/${threadId}`);
    },
    [navigate]
  );

  // Instant optimistic thread creation
  const handleCreateThread = useCallback(async () => {
    setErrorMessage(null);
    setActiveCitation(null);

    try {
      const created = await createThreadMutation.mutateAsync({
        title: "New SEC Analysis",
      });
      setActiveThreadId(created.id);
      navigate(`/app/${created.id}`);
    } catch {
      toast({
        message: "Failed to create thread. Rolled back.",
        type: "error",
      });
    }
  }, [createThreadMutation, navigate, toast]);

  // Optimistic thread deletion with 5-second Undo toast
  const pendingDeletionsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      const threadToDelete = threads.find((t) => t.id === threadId);
      if (!threadToDelete) return;

      // Optimistically remove from query cache immediately
      queryClient.setQueryData<Thread[]>(queryKeys.threads, (old = []) =>
        old.filter((t) => t.id !== threadId)
      );

      // If active thread was deleted, select next remaining thread
      if (activeThreadId === threadId) {
        const remaining = threads.filter((t) => t.id !== threadId);
        if (remaining.length > 0) {
          setActiveThreadId(remaining[0].id);
          navigate(`/app/${remaining[0].id}`);
        } else {
          setActiveThreadId(null);
          navigate("/app");
        }
        setActiveCitation(null);
      }

      // Schedule actual server delete after 5s to allow undo
      const timeoutId = setTimeout(async () => {
        pendingDeletionsRef.current.delete(threadId);
        try {
          await deleteThreadMutation.mutateAsync(threadId);
        } catch {
          // Restore thread on server error
          queryClient.setQueryData<Thread[]>(queryKeys.threads, (old = []) => [
            threadToDelete,
            ...old,
          ]);
          toast({
            message: "Unable to delete thread on server. Restored.",
            type: "error",
          });
        }
      }, 5000);

      pendingDeletionsRef.current.set(threadId, timeoutId);

      // Surface Undo toast
      toast({
        message: `Deleted "${threadToDelete.title?.slice(0, 24) || "thread"}..."`,
        type: "info",
        durationMs: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            const scheduled = pendingDeletionsRef.current.get(threadId);
            if (scheduled) {
              clearTimeout(scheduled);
              pendingDeletionsRef.current.delete(threadId);
              // Restore thread to cache
              queryClient.setQueryData<Thread[]>(queryKeys.threads, (old = []) => [
                threadToDelete,
                ...old,
              ]);
              setActiveThreadId(threadId);
              navigate(`/app/${threadId}`);
            }
          },
        },
      });
    },
    [threads, activeThreadId, deleteThreadMutation, navigate, toast]
  );

  // Cancel running research turn
  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingTurn(false);
    setLiveTrace(null);
    setLiveStep(null);
    toast({
      message: "Research turn cancelled",
      type: "info",
    });

    // Refetch messages in case server committed turn before abort was processed
    if (activeThreadId) {
      api.listMessages(activeThreadId).then((refreshed) => {
        queryClient.setQueryData<Message[]>(queryKeys.messages(activeThreadId), refreshed);
      }).catch(() => {});
    }
  }, [activeThreadId, toast]);

  // Send analyst prompt with live SSE streaming
  const handleSendMessage = useCallback(
    async (content: string) => {
      let targetThreadId = activeThreadId;
      setErrorMessage(null);
      lastPromptRef.current = content;

      // Optimistically create thread if none exists
      if (!targetThreadId) {
        const titleSnippet = content.slice(0, 45) + (content.length > 45 ? "..." : "");
        try {
          const newThread = await createThreadMutation.mutateAsync({ title: titleSnippet });
          targetThreadId = newThread.id;
          setActiveThreadId(newThread.id);
          navigate(`/app/${newThread.id}`);
        } catch {
          toast({
            message: "Could not initialize research thread. Please retry.",
            type: "error",
          });
          return;
        }
      }

      // Optimistic user message for immediate UI update (<100ms)
      const optimisticUserMsg: Message = {
        id: `optimistic-${Date.now()}`,
        thread_id: targetThreadId,
        role: "user",
        content,
        position: messages.length + 1,
        created_at: new Date().toISOString(),
        citations: [],
      };

      queryClient.setQueryData<Message[]>(queryKeys.messages(targetThreadId), (old = []) => [
        ...old,
        optimisticUserMsg,
      ]);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsGeneratingTurn(true);

      // Initialize live trace
      setLiveStep("init");
      setLiveElapsedMs(0);
      setLiveTrace({
        total_elapsed_ms: 0,
        retrieved_count: 0,
        passages: [],
      });

      try {
        const assistantMessage = await streamMessageTurn(
          targetThreadId,
          content,
          {
            signal: controller.signal,
            fallbackToPost: true,
            onEvent: (event) => {
              if (event.elapsed_ms) {
                setLiveElapsedMs(event.elapsed_ms);
              }

              if (event.type === "status") {
                setLiveStep(event.step);
              } else if (event.type === "retrieval_started") {
                setLiveStep("retrieval_started");
              } else if (event.type === "retrieved") {
                setLiveStep("retrieved");
                setLiveTrace((prev) => ({
                  ...prev,
                  retrieved_count: event.merged || event.passages.length,
                  passages: event.passages,
                  total_elapsed_ms: event.elapsed_ms,
                }));
              } else if (event.type === "validating") {
                setLiveStep("validating");
              }
            },
          }
        );

        // Append assistant message to cache
        queryClient.setQueryData<Message[]>(queryKeys.messages(targetThreadId), (old = []) => [
          ...old,
          assistantMessage,
        ]);

        // Auto-title untitled or default threads
        const currentTh = threads.find((t) => t.id === targetThreadId);
        if (
          currentTh &&
          (!currentTh.title || currentTh.title === "New SEC Analysis" || currentTh.title.startsWith("New Research"))
        ) {
          const newTitle = content.slice(0, 45) + (content.length > 45 ? "..." : "");
          updateThreadMutation.mutate({
            threadId: targetThreadId,
            payload: { title: newTitle },
          });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }

        // On timeout or error, REFETCH messages first before offering Retry
        try {
          const refreshed = await api.listMessages(targetThreadId);
          queryClient.setQueryData<Message[]>(queryKeys.messages(targetThreadId), refreshed);

          const lastRefreshed = refreshed[refreshed.length - 1];
          if (lastRefreshed && lastRefreshed.role === "assistant") {
            return;
          }
        } catch {
          // Failed to refresh messages
        }

        const msgText =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Network error during SEC analysis.";
        setErrorMessage(msgText);
      } finally {
        setIsGeneratingTurn(false);
        setLiveTrace(null);
        setLiveStep(null);
        abortControllerRef.current = null;
      }
    },
    [
      activeThreadId,
      messages.length,
      threads,
      createThreadMutation,
      updateThreadMutation,
      navigate,
      toast,
    ]
  );

  // Retry last prompt
  const handleRetryLastMessage = useCallback(() => {
    if (lastPromptRef.current) {
      handleSendMessage(lastPromptRef.current);
    }
  }, [handleSendMessage]);

  // Export thread as Markdown with citations
  const handleExportMarkdown = useCallback(() => {
    if (messages.length === 0) return;
    const currentThread = threads.find((t) => t.id === activeThreadId);
    const title = currentThread?.title || "SEC Research Thread";

    let md = `# ${title}\n\n`;
    md += `*Exported from Driftwood Capital Document Copilot on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    for (const msg of messages) {
      if (msg.role === "user") {
        md += `### Analyst Query\n\n${msg.content}\n\n`;
      } else if (msg.role === "assistant") {
        md += `### SEC Copilot Response\n\n${msg.content}\n\n`;
        if (msg.citations && msg.citations.length > 0) {
          md += `#### Audited SEC Sources\n\n`;
          for (const c of msg.citations) {
            const meta = c.citation_metadata || {};
            const ticker = meta.ticker || "SEC";
            const form = meta.form_type || "10-K";
            const fy = meta.fiscal_year ? ` FY${meta.fiscal_year}` : "";
            const sec = meta.section_name || meta.section ? ` | ${meta.section_name || meta.section}` : "";
            md += `- **[${c.citation_index}] ${ticker} ${form}${fy}${sec}**\n`;
            if (c.excerpt) {
              md += `  > "${c.excerpt.trim()}"\n`;
            }
          }
          md += "\n";
        }
      }
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      message: "Exported research thread as Markdown",
      type: "info",
    });
  }, [messages, threads, activeThreadId, toast]);

  // Global Keyboard shortcuts: ⌘K / Ctrl+K for new thread, / to focus composer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘K or Ctrl+K for new thread
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleCreateThread();
        return;
      }

      // "/" to focus composer when not already in an input/textarea
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
        textarea?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateThread]);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex flex-col h-[100dvh] bg-surface-950 text-slate-100 overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onToggleSidebar={() => setIsSidebarOpenMobile((prev) => !prev)}
        isSidebarOpen={isSidebarOpenMobile}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={handleSelectThread}
          onCreateThread={handleCreateThread}
          onDeleteThread={handleDeleteThread}
          onPrefetchThread={handlePrefetchThread}
          isLoading={isLoadingThreads}
          isOpenMobile={isSidebarOpenMobile}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
        />

        <ChatPane
          messages={messages}
          isLoading={isGeneratingTurn}
          isInitialLoading={isLoadingMessages && messages.length === 0}
          onSendMessage={handleSendMessage}
          onCancelGeneration={handleCancelGeneration}
          onRetryLastMessage={handleRetryLastMessage}
          onSelectCitation={(cit) => setActiveCitation(cit)}
          onExportMarkdown={handleExportMarkdown}
          activeThreadTitle={activeThread?.title}
          errorMessage={errorMessage}
          liveTrace={liveTrace}
          liveStep={liveStep}
          liveElapsedMs={liveElapsedMs}
        />
      </div>

      <Suspense fallback={null}>
        <CitationDrawer
          citation={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      </Suspense>
    </div>
  );
};

export default ChatPage;
