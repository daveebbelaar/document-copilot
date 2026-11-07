/**
 * Robust SSE client consuming POST /api/threads/{id}/messages/stream using fetch + ReadableStream.
 * Handles bearer auth token injection, partial line buffering, abort controller, and fallback.
 */
import { env } from "./env";
import { supabase } from "./supabase";
import { getInMemoryToken, setInMemoryToken, ApiError } from "./http";
import { api } from "./api";
import type { Message, StreamEvent } from "./types";

interface StreamOptions {
  signal?: AbortSignal;
  onEvent?: (event: StreamEvent) => void;
  fallbackToPost?: boolean;
}

export async function streamMessageTurn(
  threadId: string,
  content: string,
  options: StreamOptions = {}
): Promise<Message> {
  const { signal, onEvent, fallbackToPost = true } = options;

  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/api/threads/${threadId}/messages/stream`;

  // Get token
  let token = getInMemoryToken();
  if (!token) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
      if (token) setInMemoryToken(token);
    } catch {
      // Continue without token (will 401 if protected)
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
      signal,
    });

    // If 401, attempt one session refresh
    if (response.status === 401) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session?.access_token) {
          setInMemoryToken(refreshData.session.access_token);
          return await streamMessageTurn(threadId, content, {
            ...options,
            signal,
          });
        }
      } catch {
        // Fall through
      }
      throw new ApiError("Authentication session expired. Please sign in again.", { status: 401 });
    }

    if (!response.ok) {
      // If the streaming endpoint returns an HTTP error, fallback to standard POST if enabled
      if (fallbackToPost && !signal?.aborted) {
        return await api.sendMessage(threadId, { content }, { signal });
      }
      const errorText = await response.text();
      throw new ApiError(errorText || `Streaming failed with status ${response.status}`, {
        status: response.status,
      });
    }

    if (!response.body) {
      throw new ApiError("Streaming response has no body", { status: 0 });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalMessage: Message | null = null;
    let currentEventType = "message";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete trailing fragment in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentEventType = "message";
          continue;
        }

        if (trimmed.startsWith("event:")) {
          currentEventType = trimmed.slice(6).trim();
          continue;
        }

        if (trimmed.startsWith("data:")) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === "[DONE]") {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const streamEvent = { type: currentEventType, ...parsed } as StreamEvent;

            if (onEvent) {
              onEvent(streamEvent);
            }

            if (currentEventType === "done") {
              finalMessage = parsed as Message;
            } else if (currentEventType === "error") {
              throw new ApiError(parsed.message || "Error occurred during streaming", { status: 500 });
            }
          } catch (parseErr) {
            if (parseErr instanceof ApiError) throw parseErr;
            // Ignore non-json or malformed SSE line
          }
        }
      }
    }

    if (finalMessage) {
      return finalMessage;
    }

    // If stream closed cleanly without done event, fetch latest messages from backend
    const updatedMessages = await api.listMessages(threadId);
    const lastAsst = updatedMessages.filter((m) => m.role === "assistant").pop();
    if (lastAsst) {
      return lastAsst;
    }

    throw new ApiError("Stream ended without assistant response.", { status: 0 });
  } catch (err) {
    if (signal?.aborted) {
      throw new ApiError("Request cancelled by user", { status: 0, isNetworkError: true });
    }

    if (fallbackToPost && !(err instanceof ApiError && err.status === 401)) {
      try {
        return await api.sendMessage(threadId, { content }, { signal });
      } catch (postErr) {
        throw postErr;
      }
    }

    throw err;
  }
}
