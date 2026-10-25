/**
 * Typed API client singleton for backend interactions.
 */
import { httpRequest, ApiError } from "./http";
import type {
  Message,
  MessageCreatePayload,
  Thread,
  ThreadCreatePayload,
  ThreadUpdatePayload,
} from "./types";

export { ApiError };

export const api = {
  get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return httpRequest<T>(endpoint, { ...options, method: "GET" });
  },

  post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return httpRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return httpRequest<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return httpRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = void>(endpoint: string, options?: RequestInit): Promise<T> {
    return httpRequest<T>(endpoint, { ...options, method: "DELETE" });
  },

  // Threads
  listThreads(): Promise<Thread[]> {
    return this.get<Thread[]>("/api/threads");
  },

  createThread(payload: ThreadCreatePayload = {}): Promise<Thread> {
    return this.post<Thread>("/api/threads", payload);
  },

  getThread(threadId: string): Promise<Thread> {
    return this.get<Thread>(`/api/threads/${threadId}`);
  },

  updateThread(threadId: string, payload: ThreadUpdatePayload): Promise<Thread> {
    return this.patch<Thread>(`/api/threads/${threadId}`, payload);
  },

  deleteThread(threadId: string): Promise<void> {
    return this.delete<void>(`/api/threads/${threadId}`);
  },

  // Messages
  listMessages(threadId: string): Promise<Message[]> {
    return this.get<Message[]>(`/api/threads/${threadId}/messages`);
  },

  sendMessage(threadId: string, payload: MessageCreatePayload): Promise<Message> {
    // LLM synthesis turn may take 10-30s on free tiers, so we set a 90s timeout
    return httpRequest<Message>(`/api/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 90000,
    });
  },
};
