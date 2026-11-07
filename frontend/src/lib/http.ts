/**
 * Native fetch HTTP client with in-memory Supabase JWT bearer injection,
 * automatic 401 session refresh and retry, caller abort signal support, and typed ApiError.
 */
import { env } from "./env";
import { supabase } from "./supabase";

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly data: unknown;
  public readonly isNetworkError: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      statusText?: string;
      data?: unknown;
      isNetworkError?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.statusText = options.statusText ?? "";
    this.data = options.data;
    this.isNetworkError = options.isNetworkError ?? false;
  }
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  _isRetry?: boolean;
}

// In-memory token cache to prevent asynchronous storage reads on every HTTP request
let inMemoryAccessToken: string | null = null;

// Initialize on load and keep synchronized via onAuthStateChange
supabase.auth.getSession().then(({ data: { session } }) => {
  inMemoryAccessToken = session?.access_token ?? null;
}).catch(() => {
  inMemoryAccessToken = null;
});

supabase.auth.onAuthStateChange((_event, session) => {
  inMemoryAccessToken = session?.access_token ?? null;
});

export function setInMemoryToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getInMemoryToken(): string | null {
  return inMemoryAccessToken;
}

export async function httpRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 60000, _isRetry = false, ...fetchOptions } = options;

  // Build full URL
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  // Attach headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Fast in-memory token lookup with lazy fallback if not populated yet
  let token = inMemoryAccessToken;
  if (!token) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
      inMemoryAccessToken = token;
    } catch {
      // Ignore initial session load failure
    }
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  // Link caller signal if provided
  let combinedSignal = timeoutController.signal;
  if (fetchOptions.signal) {
    const callerSignal = fetchOptions.signal;
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      throw new ApiError("Request cancelled", { status: 0, isNetworkError: true });
    }
    const combinedController = new AbortController();
    const onTimeoutAbort = () => combinedController.abort(timeoutController.signal.reason);
    const onCallerAbort = () => combinedController.abort(callerSignal.reason);

    timeoutController.signal.addEventListener("abort", onTimeoutAbort);
    callerSignal.addEventListener("abort", onCallerAbort);

    combinedSignal = combinedController.signal;
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: combinedSignal,
    });

    clearTimeout(timeoutId);

    // 401 retry: refresh session once and retry
    if (response.status === 401 && !_isRetry) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session?.access_token) {
          inMemoryAccessToken = refreshData.session.access_token;
          return await httpRequest<T>(endpoint, {
            ...options,
            _isRetry: true,
          });
        }
      } catch {
        // Fall through to standard 401 error handling
      }
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get("content-type") || "";
    let data: unknown;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg =
        typeof data === "object" && data !== null && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : response.statusText || `HTTP ${response.status}`;
      throw new ApiError(errorMsg, {
        status: response.status,
        statusText: response.statusText,
        data,
        isNetworkError: false,
      });
    }

    return data as T;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    const isAbort =
      (err instanceof DOMException && err.name === "AbortError") ||
      (typeof err === "object" && err !== null && "name" in err && err.name === "AbortError");

    const isCallerAborted = fetchOptions.signal?.aborted;
    const message = isCallerAborted
      ? "Request cancelled by user"
      : isAbort
      ? `Request timed out after ${timeoutMs / 1000}s`
      : err instanceof Error
      ? err.message
      : "Network connection error";

    throw new ApiError(message, {
      status: 0,
      isNetworkError: true,
      data: err,
    });
  }
}
