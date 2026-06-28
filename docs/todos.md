# Document Copilot - Project Checklist

This checklist outlines the steps to implement the Document Copilot project, following the architectural guidelines and client brief.

## Phase 1: Project Setup & Core Infrastructure

- [ ] 1.1 Scaffold Frontend SPA (Vite + React + TypeScript)
- [ ] 1.2 Scaffold Backend FastAPI app (Python 3.12+)
- [ ] 1.3 Configure Pydantic v2 + pydantic-settings for backend
- [ ] 1.4 Set up SQLAlchemy models for database schema
- [ ] 1.5 Configure Alembic for database migrations
- [ ] 1.6 Create initial Alembic migration for:
    - [ ] pgvector extension
    - [ ] Source document tables
    - [ ] Chunk tables (with embeddings and full-text search vectors)
    - [ ] Chat and citation tables

## Phase 2: Authentication & API Communication

- [ ] 2.1 Implement Supabase Auth in the frontend
    - [ ] Email login
    - [ ] Session management (`@supabase/supabase-js`)
- [ ] 2.2 Implement Supabase token verification in FastAPI backend
- [ ] 2.3 Develop shared frontend API client (`src/lib/http.ts`, `src/lib/api.ts`)
    - [ ] Wraps `fetch`
    - [ ] Applies backend base URL
    - [ ] Injects Supabase bearer token automatically
    - [ ] Handles timeouts
    - [ ] Converts failures to typed API errors
- [ ] 2.4 Create chat streaming endpoint in FastAPI (`/chat/stream`)
    - [ ] Stubbed assistant response initially
    - [ ] AI SDK-compatible message format

## Phase 3: Frontend Chat UI Integration

- [ ] 3.1 Integrate AI SDK chat UI components on the frontend
    - [ ] Point to FastAPI streaming endpoint
    - [ ] Manage message state
- [ ] 3.2 Implement UI for displaying chat messages, citations, source passages, empty states, and errors.

## Phase 4: Data Ingestion & Retrieval

- [ ] 4.1 Implement Markdown ingestion for SEC filings
- [ ] 4.2 Implement chunking logic for documents
- [ ] 4.3 Generate embeddings for chunks using OpenAI embedding model
- [ ] 4.4 Implement Supabase writes for source documents, chunks, and embeddings
- [ ] 4.5 Implement semantic search using `pgvector`
- [ ] 4.6 Implement Postgres full-text search
- [ ] 4.7 Develop Python Reciprocal Rank Fusion (RRF) for hybrid search

## Phase 5: LLM Orchestration & Grounding

- [ ] 5.1 Implement PydanticAI document agent
    - [ ] Define typed dependencies (`DocumentAgentDeps`)
    - [ ] Define typed answer output (`GroundedAnswer`, `Citation`, `SourcePassage`)
    - [ ] Encode product contract instructions (e.g., cite every factual claim, no stock recommendations)
- [ ] 5.2 Implement citation validation
    - [ ] Ensure citations map to retrieved source passages
    - [ ] Include metadata for frontend display
- [ ] 5.3 Implement grounding enforcement
    - [ ] Controlled failure for insufficient evidence
    - [ ] Prevent citation of un-retrieved documents

## Phase 6: Finalization & Deployment

- [ ] 6.1 Implement structured logging with `structlog` in backend
- [ ] 6.2 Define and validate all frontend and backend configuration variables
- [ ] 6.3 Deploy frontend as a static Vite build on Railway
- [ ] 6.4 Deploy backend as a FastAPI service on Railway
- [ ] 6.5 Conduct pilot group testing and gather feedback (5 senior analysts)
- [ ] 6.6 Address feedback and prepare for firm-wide rollout