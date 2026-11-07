import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
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
import type { Thread, Message, Citation } from "@/lib/types";

const CitationDrawer = React.lazy(() => import("@/components/chat/CitationDrawer"));

interface ChatPageProps {
  userEmail?: string | null;
}

export const ChatPage: React.FC<ChatPageProps> = ({ userEmail }) => {
  const { toast } = useToast();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isGeneratingTurn, setIsGeneratingTurn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string | null>(null);

  // TanStack Query for server state
  const { data: threads = [], isLoading: isLoadingThreads } = useThreads();
  const { data: messages = [], isLoading: isLoadingMessages } = useMessages(activeThreadId);

  const createThreadMutation = useCreateThread();
  const deleteThreadMutation = useDeleteThread();
  const updateThreadMutation = useUpdateThread();

  // Select first thread when threads load if none is selected
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  // Prefetch messages on sidebar hover / focus / touchstart
  const handlePrefetchThread = useCallback((threadId: string) => {
    prefetchMessages(queryClient, threadId);
  }, []);

  // Instant optimistic thread creation
  const handleCreateThread = useCallback(async () => {
    setErrorMessage(null);
    setActiveCitation(null);

    try {
      const created = await createThreadMutation.mutateAsync({
        title: "New SEC Analysis",
      });
      setActiveThreadId(created.id);
    } catch {
      toast({
        message: "Failed to create thread. Rolled back.",
        type: "error",
      });
    }
  }, [createThreadMutation, toast]);

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
        setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
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
            }
          },
        },
      });
    },
    [threads, activeThreadId, deleteThreadMutation, toast]
  );

  // Cancel running research turn
  const handleCancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGeneratingTurn(false);
    toast({
      message: "Research turn cancelled",
      type: "info",
    });
  }, [toast]);

  // Send analyst prompt
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

      try {
        const assistantMessage = await api.sendMessage(
          targetThreadId,
          { content },
          { signal: controller.signal }
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
        // If cancelled by user, clean up silently
        if (controller.signal.aborted) {
          return;
        }

        // On timeout or error, REFETCH messages first before offering Retry
        // (backend orchestrator may have finished and saved the answer before network dropped)
        try {
          const refreshed = await api.listMessages(targetThreadId);
          queryClient.setQueryData<Message[]>(queryKeys.messages(targetThreadId), refreshed);

          const lastRefreshed = refreshed[refreshed.length - 1];
          if (lastRefreshed && lastRefreshed.role === "assistant") {
            // Backend succeeded in saving the answer!
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
        abortControllerRef.current = null;
      }
    },
    [activeThreadId, messages.length, threads, createThreadMutation, updateThreadMutation, toast]
  );

  const handleRetryLastMessage = useCallback(() => {
    if (lastPromptRef.current) {
      handleSendMessage(lastPromptRef.current);
    }
  }, [handleSendMessage]);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="h-[100dvh] min-h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      <Navbar
        userEmail={userEmail}
        onToggleSidebar={() => setIsSidebarOpenMobile((prev) => !prev)}
        isSidebarOpen={isSidebarOpenMobile}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
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
          onSelectCitation={setActiveCitation}
          activeThreadTitle={activeThread?.title}
          errorMessage={errorMessage}
        />

        <Suspense fallback={null}>
          {activeCitation && (
            <CitationDrawer
              citation={activeCitation}
              onClose={() => setActiveCitation(null)}
            />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default ChatPage;
