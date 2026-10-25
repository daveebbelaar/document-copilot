import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatPane } from "@/components/chat/ChatPane";
import { CitationDrawer } from "@/components/chat/CitationDrawer";
import { api } from "@/lib/api";
import type { Thread, Message, Citation } from "@/lib/types";

interface ChatPageProps {
  userEmail?: string | null;
}

export const ChatPage: React.FC<ChatPageProps> = ({ userEmail }) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);

  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isGeneratingTurn, setIsGeneratingTurn] = useState(false);

  // Fetch threads on mount
  const loadThreads = useCallback(async () => {
    try {
      setIsLoadingThreads(true);
      const list = await api.listThreads();
      setThreads(list);
      if (list.length > 0 && !activeThreadId) {
        setActiveThreadId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch threads:", err);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [activeThreadId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Load messages whenever active thread changes
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    let isSubscribed = true;
    const fetchMessages = async () => {
      try {
        const msgs = await api.listMessages(activeThreadId);
        if (isSubscribed) {
          setMessages(msgs);
        }
      } catch (err) {
        console.error("Failed to load messages for thread:", err);
      }
    };

    fetchMessages();
    return () => {
      isSubscribed = false;
    };
  }, [activeThreadId]);

  // Create a new thread
  const handleCreateThread = async () => {
    try {
      const thread = await api.createThread({ title: "New SEC Analysis" });
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.id);
      setMessages([]);
      setActiveCitation(null);
    } catch (err) {
      console.error("Failed to create thread:", err);
    }
  };

  // Delete a thread
  const handleDeleteThread = async (threadId: string) => {
    try {
      await api.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        const remaining = threads.filter((t) => t.id !== threadId);
        setActiveThreadId(remaining.length > 0 ? remaining[0].id : null);
        setActiveCitation(null);
      }
    } catch (err) {
      console.error("Failed to delete thread:", err);
    }
  };

  // Send an analyst prompt
  const handleSendMessage = async (content: string) => {
    let targetThreadId = activeThreadId;

    // Create a thread if none exists yet
    if (!targetThreadId) {
      try {
        const newTh = await api.createThread({
          title: content.slice(0, 60) + (content.length > 60 ? "..." : ""),
        });
        setThreads([newTh]);
        setActiveThreadId(newTh.id);
        targetThreadId = newTh.id;
      } catch (err) {
        console.error("Failed to auto-create thread:", err);
        return;
      }
    }

    // Optimistic user message for instantaneous UI response
    const optimisticUserMessage: Message = {
      id: `temp-${Date.now()}`,
      thread_id: targetThreadId,
      role: "user",
      content,
      position: messages.length + 1,
      created_at: new Date().toISOString(),
      citations: [],
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setIsGeneratingTurn(true);

    try {
      const assistantMessage = await api.sendMessage(targetThreadId, { content });
      // Replace or append assistant message
      setMessages((prev) => [...prev, assistantMessage]);

      // If this was the first user message in an untitled thread, update the thread's title in the list
      const currentThread = threads.find((t) => t.id === targetThreadId);
      if (currentThread && (!currentThread.title || currentThread.title === "New SEC Analysis")) {
        const updatedTitle = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        api.updateThread(targetThreadId, { title: updatedTitle }).then((updated) => {
          setThreads((prev) =>
            prev.map((t) => (t.id === targetThreadId ? updated : t))
          );
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to complete research turn:", err);
      // Append an error notice
      const errorNotice: Message = {
        id: `err-${Date.now()}`,
        thread_id: targetThreadId,
        role: "assistant",
        content: `Error: Unable to generate response. ${
          err instanceof Error ? err.message : "Please try again."
        }`,
        position: messages.length + 2,
        created_at: new Date().toISOString(),
        citations: [],
      };
      setMessages((prev) => [...prev, errorNotice]);
    } finally {
      setIsGeneratingTurn(false);
    }
  };

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden">
      <Navbar userEmail={userEmail} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={setActiveThreadId}
          onCreateThread={handleCreateThread}
          onDeleteThread={handleDeleteThread}
          isLoading={isLoadingThreads}
        />
        <ChatPane
          messages={messages}
          isLoading={isGeneratingTurn}
          onSendMessage={handleSendMessage}
          onSelectCitation={setActiveCitation}
          activeThreadTitle={activeThread?.title}
        />
        {activeCitation && (
          <CitationDrawer
            citation={activeCitation}
            onClose={() => setActiveCitation(null)}
          />
        )}
      </div>
    </div>
  );
};
