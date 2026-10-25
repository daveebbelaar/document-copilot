/**
 * Validated frontend environment configuration.
 * Single source of truth for all import.meta.env reads.
 */

function getEnvVar(name: string, fallback?: string): string {
  const val = (import.meta as { env?: Record<string, string> }).env?.[name] || fallback;
  if (!val || val.trim() === "") {
    throw new Error(`Missing required frontend environment variable: ${name}`);
  }
  return val.trim();
}

export const env = {
  apiBaseUrl: getEnvVar("VITE_API_BASE_URL", "http://localhost:8000"),
  supabaseUrl: getEnvVar("VITE_SUPABASE_URL"),
  supabaseAnonKey: getEnvVar("VITE_SUPABASE_ANON_KEY"),
} as const;
