/**
 * Native fetch HTTP client with Supabase JWT bearer injection and typed ApiError.
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
}

export async function httpRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 60000, ...fetchOptions } = options;

  // Build full URL
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  // Attach headers
  const headers = new Headers(fetchOptions.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Inject Supabase session access token if available
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  } catch (err) {
    console.warn("Failed to retrieve auth token for request:", err);
  }

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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

    const isAbort = err instanceof DOMException && err.name === "AbortError";
    const message = isAbort
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
