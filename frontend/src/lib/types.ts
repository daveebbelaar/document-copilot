/**
 * Domain types matching FastAPI backend models and API contracts.
 */

export interface Thread {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CitationMetadata {
  ticker?: string;
  company_name?: string;
  fiscal_year?: number;
  form_type?: string;
  section_name?: string | null;
  source_url?: string;
  similarity_score?: number | null;
  [key: string]: unknown;
}

export interface Citation {
  id: string;
  chunk_id: string | null;
  citation_index: number;
  excerpt: string | null;
  citation_metadata: CitationMetadata;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  message_json?: Record<string, unknown> | null;
  position: number;
  created_at: string;
  citations: Citation[];
}

export interface ThreadCreatePayload {
  title?: string;
}

export interface ThreadUpdatePayload {
  title: string;
}

export interface MessageCreatePayload {
  content: string;
}
