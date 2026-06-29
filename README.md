# Spur Chat - AI Support Agent

AI-powered live chat widget for Lumio, a fictional D2C smart home lighting brand.
Users can ask about products, shipping, returns, refunds, warranty, discounts, and support.
Conversations persist across reloads by storing a session ID in `localStorage` and loading history from PostgreSQL.

Live demo: https://support-core-nine.vercel.app  
Backend: https://support-core.onrender.com  
GitHub: https://github.com/parthtiwari-dev/support-core

## Tech Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- LLM: OpenAI GPT-4o-mini with SSE streaming
- Deployment: Render for backend, Vercel for frontend, Supabase for PostgreSQL

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL 14+
- OpenAI API key

### Install

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Configure Environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/spur_chat
OPENAI_API_KEY=sk-...
DATABASE_SSL=false
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

For Supabase, use the database connection string from Project Settings -> Database, not the API keys.
Replace `YOUR_DATABASE_PASSWORD` with the database password you set for the project:

```env
DATABASE_URL="postgresql://postgres:YOUR_DATABASE_PASSWORD@db.your-project-ref.supabase.co:5432/postgres"
DATABASE_SSL=true
OPENAI_API_KEY=sk-...
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

If the password contains URL characters like `@`, `#`, `%`, `/`, `?`, or `:`, URL-encode them before putting it into `DATABASE_URL`.
For example, `@` becomes `%40` and `#` becomes `%23`.

Common Supabase mistake: leaving `[YOUR-PASSWORD]` or `YOUR_DATABASE_PASSWORD` in the URL causes `password authentication failed for user "postgres"`.
Use the database password, not your Supabase login password and not the anon/service-role API key.

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### Create Database And Run Migration

If using local PostgreSQL, create the database first:

```bash
createdb spur_chat
```

If using Supabase, skip `createdb`; Supabase already created the `postgres` database for you.

Then run the migration from the backend folder:

```bash
cd backend
npm run migrate
```

The migration creates:

- `conversations`
- `messages`
- nullable AI message feedback (`up` / `down`)
- indexes for conversation lookup and message ordering

### Run Locally

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Architecture

```text
Browser (React + Vite)
  useChat hook
    api.streamMessage() -> fetch POST -> ReadableStream
    api.getHistory()    -> fetch GET  -> JSON

Express (Node.js + TypeScript)
  routes/       -> thin URL mapping
  middleware/   -> validation, rate limiting, error handling
  handlers/     -> HTTP lifecycle and SSE protocol
  services/     -> conversation rules, context window, LLM calls
  repositories/ -> PostgreSQL queries only
  db/           -> pg pool and migrations

PostgreSQL stores conversations/messages.
OpenAI streams assistant replies through the backend.
```

API endpoints:

- `POST /api/chat/message` streams an AI reply over SSE
- `GET /api/chat/history/:sessionId` loads persisted chat history
- `POST /api/chat/feedback` stores `up` / `down` feedback on AI messages
- `GET /health` checks that the API and PostgreSQL are both reachable

Layer contract:

- `routes/` maps URLs only.
- `handlers/` owns Express request/response and SSE writes.
- `services/` owns business rules and never touches `req` or `res`.
- `repositories/` owns SQL and contains no business logic.
- `llm.service.ts` exposes an async generator; the handler writes chunks to the stream.

## LLM Notes

- Provider: OpenAI
- Model: `gpt-4o-mini`
- Streaming: Server-Sent Events over `fetch()` and `ReadableStream`
- Max response tokens: 500
- System prompt: hardcoded Lumio support policy and product knowledge
- Context window: last 10 messages or 12,000 characters, whichever is smaller

The context window is intentionally character-capped. Older messages are dropped to keep cost and latency predictable. The 12,000 character budget is roughly 3,000 tokens.

## Error Handling

The app separates failures by phase:

- DB or setup failure before SSE starts: normal JSON error response
- LLM/provider failure after SSE starts: SSE `error` event
- Stale or invalid history session: backend `404`, frontend clears `localStorage` and starts fresh

Named LLM failure modes:

| Error type | User-facing behavior |
| --- | --- |
| `TIMEOUT` | "Lumi is taking too long to respond. Please try again." |
| `RATE_LIMIT` | "Too many requests right now. Please wait a moment and try again." |
| `AUTH_FAILURE` | "Support is temporarily unavailable. Please email support@lumio.in." |
| `PROVIDER_DOWN` | "Lumi is temporarily down. Email support@lumio.in for urgent queries." |
| `UNKNOWN` | "Something went wrong. Please try again." |

## Roadmap Checklist Status

- Welcome message and FAQ quick replies: implemented in `MessageList`
- Grouped timestamps: implemented in `MessageBubble`
- AI message feedback: implemented end-to-end with migration, route, service, repository, and UI
- New chat reset: implemented in the widget header
- Health check: `/health` verifies PostgreSQL with `SELECT 1`
- Failure taxonomy: implemented in `llm.service.ts`
- Context window budget: implemented in `buildContextWindow`
- Request deduplication: implemented with `useRef` in `useChat`
- Session persistence across reload: implemented with `localStorage` and history fetch
- SSE buffering: implemented in `frontend/src/services/api.ts`
- DB error vs LLM error: separated before and after SSE starts
- Clean 4-layer architecture: routes, handlers, services, repositories
- Input validation: middleware handles missing, non-string, empty, whitespace-only, and too-long messages
- Invalid session recovery: history endpoint returns 404, frontend clears stale session
- Streaming typing indicator: tied to active stream state

## Trade-offs

- Rate limiting is in-memory. It resets on server restart and is not shared across instances. Production should use Redis.
- There is no authentication. The `sessionId` is the only identity, which is fine for a demo but not for a real customer portal.
- System prompt and Lumio knowledge are hardcoded. A production version should store brand configuration in the database.
- History loads all messages for a session. Pagination is unnecessary for the demo but would be needed later.
- There are no automated tests yet. The next useful tests would cover validation, context-window trimming, stale-session recovery, and SSE parsing.

## Deployment Notes

Live setup:

- Database: Supabase PostgreSQL
- Backend: Render Web Service - https://support-core.onrender.com
- Frontend: Vercel - https://support-core-nine.vercel.app

Backend on Render:

- Root directory: `backend`
- Build command: `npm install && npm run build && npm run migrate`
- Start command: `npm start`
- Health check path: `/health`
- Environment variables:
  - `DATABASE_URL`
  - `DATABASE_SSL=true`
  - `OPENAI_API_KEY`
  - `FRONTEND_URL`
  - `NODE_ENV=production`
- Migrations are idempotent and run during the build command on each deploy.

Frontend on Vercel:

- Set root directory to `frontend`
- Set `VITE_API_URL` to the Render backend URL
- Deploy normally

After deploying the frontend, update Render `FRONTEND_URL` to the Vercel URL.

**Gotcha worth documenting:** CORS origin matching is byte-exact. Setting `FRONTEND_URL` with a trailing slash (`https://app.vercel.app/`) causes the browser to reject every request with a CORS error, even though the backend is healthy and the URLs are "the same" to a human eye. The `/health` endpoint will still respond fine since simple GETs don't trigger a CORS preflight, which makes this easy to misdiagnose as a backend or network issue. Set `FRONTEND_URL` with no trailing slash.

## Deviations From Spec

The assignment describes `POST /chat/message` returning `{ reply, sessionId }` as a single JSON response. This project implements `POST /api/chat/message` instead, streaming the reply over Server-Sent Events rather than returning one blocking JSON payload.

This was a deliberate choice, not an oversight: streaming gives a noticeably better chat UX (the user sees the agent typing instead of staring at a blank bubble for several seconds), and it is closer to how a real production chat widget like Spur's would behave. The `/api` prefix is a normal REST convention to namespace API routes separately from any future static assets or other route groups. `GET /api/chat/history/:sessionId` and `POST /api/chat/feedback` follow the same prefix for consistency.
