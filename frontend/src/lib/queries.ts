import {
  QueryClient,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { Thread, Message, ThreadCreatePayload, ThreadUpdatePayload } from "./types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export const queryKeys = {
  threads: ["threads"] as const,
  messages: (threadId: string | null) => ["messages", threadId] as const,
};

export function prefetchMessages(client: QueryClient, threadId: string): void {
  if (!threadId) return;
  client.prefetchQuery({
    queryKey: queryKeys.messages(threadId),
    queryFn: () => api.listMessages(threadId),
    staleTime: 30_000,
  });
}

export function useThreads() {
  return useQuery<Thread[]>({
    queryKey: queryKeys.threads,
    queryFn: () => api.listThreads(),
  });
}

export function useMessages(threadId: string | null) {
  return useQuery<Message[]>({
    queryKey: queryKeys.messages(threadId),
    queryFn: () => (threadId ? api.listMessages(threadId) : Promise.resolve([])),
    enabled: Boolean(threadId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateThread() {
  const client = useQueryClient();

  return useMutation<Thread, Error, ThreadCreatePayload, { previousThreads?: Thread[]; optimisticThread: Thread }>({
    mutationFn: (payload) => api.createThread(payload),
    onMutate: async (payload) => {
      await client.cancelQueries({ queryKey: queryKeys.threads });
      const previousThreads = client.getQueryData<Thread[]>(queryKeys.threads) || [];

      const optimisticThread: Thread = {
        id: `temp-${Date.now()}`,
        user_id: "",
        title: payload.title || "New SEC Analysis",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      client.setQueryData<Thread[]>(queryKeys.threads, [optimisticThread, ...previousThreads]);
      return { previousThreads, optimisticThread };
    },
    onError: (_err, _payload, context) => {
      if (context?.previousThreads) {
        client.setQueryData<Thread[]>(queryKeys.threads, context.previousThreads);
      }
    },
    onSuccess: (savedThread, _payload, context) => {
      client.setQueryData<Thread[]>(queryKeys.threads, (old = []) =>
        old.map((t) => (t.id === context?.optimisticThread.id ? savedThread : t))
      );
    },
  });
}

export function useDeleteThread() {
  const client = useQueryClient();

  return useMutation<void, Error, string, { previousThreads?: Thread[]; deletedThread?: Thread }>({
    mutationFn: (threadId) => api.deleteThread(threadId),
    onMutate: async (threadId) => {
      await client.cancelQueries({ queryKey: queryKeys.threads });
      const previousThreads = client.getQueryData<Thread[]>(queryKeys.threads) || [];
      const deletedThread = previousThreads.find((t) => t.id === threadId);

      client.setQueryData<Thread[]>(
        queryKeys.threads,
        previousThreads.filter((t) => t.id !== threadId)
      );

      return { previousThreads, deletedThread };
    },
    onError: (_err, _threadId, context) => {
      if (context?.previousThreads) {
        client.setQueryData<Thread[]>(queryKeys.threads, context.previousThreads);
      }
    },
  });
}

export function useUpdateThread() {
  const client = useQueryClient();

  return useMutation<
    Thread,
    Error,
    { threadId: string; payload: ThreadUpdatePayload },
    { previousThreads?: Thread[] }
  >({
    mutationFn: ({ threadId, payload }) => api.updateThread(threadId, payload),
    onMutate: async ({ threadId, payload }) => {
      await client.cancelQueries({ queryKey: queryKeys.threads });
      const previousThreads = client.getQueryData<Thread[]>(queryKeys.threads) || [];

      client.setQueryData<Thread[]>(
        queryKeys.threads,
        previousThreads.map((t) => (t.id === threadId ? { ...t, title: payload.title } : t))
      );

      return { previousThreads };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousThreads) {
        client.setQueryData<Thread[]>(queryKeys.threads, context.previousThreads);
      }
    },
    onSuccess: (updatedThread) => {
      client.setQueryData<Thread[]>(queryKeys.threads, (old = []) =>
        old.map((t) => (t.id === updatedThread.id ? updatedThread : t))
      );
    },
  });
}
