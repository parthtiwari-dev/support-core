# Spur Chat — Full Implementation Roadmap

> Stack: Node.js + TypeScript (backend) · React + Vite + TypeScript (frontend)  
> DB: PostgreSQL · LLM: OpenAI GPT-4o-mini with streaming · Deploy: Railway + Vercel

---

## 0. The "Holy Shit" Checklist

These are the things most candidates skip. Do all of them.

- [ ] **Failure taxonomy** — 3 named error types surfaced differently in the UI, not one generic catch
- [ ] **Context window budget** — sliding window with char cap, documented and enforced
- [ ] **Request deduplication** — `useRef` flag, not just disabled button
- [ ] **Session persistence across reload** — `localStorage` + history fetch on mount
- [ ] **SSE buffering** — handle SSE chunks that arrive split across multiple `read()` calls
- [ ] **DB error vs LLM error** — different HTTP responses before vs after SSE stream starts
- [ ] **Clean 4-layer architecture** — routes → handlers → services → repositories, no logic leaking between layers
- [ ] **Input validation** — empty, whitespace-only, too long — all handled at middleware level
- [ ] **Invalid session recovery** — stale `sessionId` in `localStorage` → backend 404 → frontend clears and restarts
- [ ] **Streaming typing indicator** — tied to actual stream, not a fake timer

---

## 1. Store: Lumio

**Brand:** Lumio — D2C smart home lighting brand  
**Tagline:** "Light, your way."

### System Prompt (paste this into `llm.service.ts`)

```
You are Lumi, the AI support agent for Lumio — a D2C smart home lighting brand. Be warm, direct, and concise. No filler phrases.

=== STORE KNOWLEDGE ===

Products:
- Smart LED Bulbs (₹499–₹1,499): Alexa + Google Home compatible. Warm white, cool white, RGB modes.
- Ambient Strip Lights (₹999–₹2,999): Cuttable, waterproof options available. USB and hardwired variants.
- Dimmable Floor Lamps (₹3,499–₹8,999): Minimalist design, touch control, 3 warmth presets.

Shipping:
- India: Free shipping on all orders. 3–5 business days.
- Express (metro cities): ₹149 flat, 1–2 days.
- International (30+ countries): Charges at checkout. 7–12 business days.

Returns & Refunds:
- 30-day no-questions-asked return policy.
- Items must be unused, in original packaging.
- Refunds processed in 5–7 business days after return received.
- Damaged on arrival? Email support@lumio.in with a photo within 48 hours — we'll replace for free.

Warranty:
- 1-year warranty on all products.
- To claim: warranty@lumio.in

Support Hours:
- Monday–Friday, 9 AM–6 PM IST.
- Weekend queries answered next business day.
- Email: support@lumio.in

Discounts & Bulk:
- First order: LUMIO10 for 10% off.
- Bulk (50+ units): bulk@lumio.in

=== BEHAVIOR RULES ===
1. Answer directly. No "Great question!" or "Certainly!".
2. If you don't know something: "I don't have that info right now. Please email support@lumio.in."
3. Never fabricate policies, prices, or product specs.
4. If someone is frustrated, acknowledge it before solving.
5. Ask at most one clarifying question at a time.
```

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                     │
│                                                             │
│  useChat hook                                               │
│    ├── api.streamMessage() → fetch() → ReadableStream      │
│    └── api.getHistory()   → fetch() → JSON                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────────────┐
│  Express (Node.js + TypeScript)                             │
│                                                             │
│  routes/         → thin URL mapping                        │
│  middleware/     → validate, rateLimit, errorHandler       │
│  handlers/       → owns HTTP lifecycle + SSE protocol      │
│  services/       → business logic (chat, llm)              │
│  repositories/   → all DB queries                          │
│  db/             → pg Pool, migrations                     │
└──────────────────────┬──────────────────────────────────────┘
                       │ pg
              ┌────────▼────────┐         ┌──────────────────┐
              │  PostgreSQL     │         │  OpenAI API      │
              │  conversations  │         │  GPT-4o-mini     │
              │  messages       │         │  (streaming)     │
              └─────────────────┘         └──────────────────┘
```

**Layer contract:**
- Routes know nothing about business logic
- Handlers own HTTP + SSE protocol, nothing else
- Services contain all business rules, never touch `req`/`res`
- Repositories contain all SQL, never contain business logic
- LLM service is a pure async generator — the handler writes to the stream

---

## 3. File Structure

```
support-core/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── index.ts            # All env vars, validated on boot
│   │   ├── db/
│   │   │   ├── index.ts            # pg Pool singleton
│   │   │   └── migrations/
│   │   │       └── 001_init.sql    # Schema definition
│   │   ├── middleware/
│   │   │   ├── validate.ts         # Input validation (empty, too long, type)
│   │   │   ├── rateLimit.ts        # In-memory per-session rate limit
│   │   │   └── errorHandler.ts     # Global Express error handler
│   │   ├── repositories/
│   │   │   └── chat.repository.ts  # All PostgreSQL queries
│   │   ├── services/
│   │   │   ├── llm.service.ts      # OpenAI streaming + error taxonomy
│   │   │   └── chat.service.ts     # Conversation logic, context window
│   │   ├── handlers/
│   │   │   └── chat.handler.ts     # HTTP handler, SSE protocol
│   │   ├── routes/
│   │   │   └── chat.routes.ts      # Route definitions
│   │   ├── types/
│   │   │   └── index.ts            # Shared TypeScript types
│   │   ├── app.ts                  # Express app setup
│   │   └── index.ts                # Server entry point
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── types/
│   │   │   └── index.ts            # ChatMessage, StreamEvent types
│   │   ├── services/
│   │   │   └── api.ts              # fetch wrapper + SSE stream reader
│   │   ├── hooks/
│   │   │   └── useChat.ts          # All state: messages, streaming, session
│   │   ├── components/
│   │   │   ├── ChatWidget.tsx      # Outer shell, layout
│   │   │   ├── MessageList.tsx     # Scrollable list + auto-scroll
│   │   │   ├── MessageBubble.tsx   # Single message, user vs AI styling
│   │   │   └── ChatInput.tsx       # Input + send button
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
└── README.md
```

---

## 4. Database

### `db/migrations/001_init.sql`

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS conversations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender          VARCHAR(4)   NOT NULL CHECK (sender IN ('user', 'ai')),
    text            TEXT         NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at);
```

**Design decisions:**
- UUIDs as PKs — no sequential ID leakage, safe to expose as `sessionId`
- `ON DELETE CASCADE` — delete conversation, messages go with it
- `CHECK (sender IN ('user', 'ai'))` — DB-level enum, not just application-level
- `updated_at` on conversations — lets you sort by activity without scanning messages
- Two indexes: conversation lookup (foreign key scan) + time ordering within a conversation

---

## 5. Backend — File by File

### `config/index.ts`

```typescript
import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
} as const;
```

**Why:** App crashes immediately on startup if any secret is missing. No silent failures 20 minutes into a demo.

---

### `types/index.ts`

```typescript
export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: string;
}

// SSE event shapes sent from backend to frontend
export type SSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; errorType: LLMErrorType; message: string };

export type LLMErrorType = 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH_FAILURE' | 'PROVIDER_DOWN' | 'UNKNOWN';

export interface LLMError {
  errorType: LLMErrorType;
  message: string; // user-facing string
}
```

---

### `db/index.ts`

```typescript
import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});
```

**Why `ssl: { rejectUnauthorized: false }` in prod:** Railway and Render provision certs that aren't always verifiable. This is standard for managed Postgres, not a security gap.

---

### `repositories/chat.repository.ts`

```typescript
import { pool } from '../db';
import { Conversation, Message } from '../types';

export const chatRepository = {
  async createConversation(): Promise<string> {
    const result = await pool.query<Conversation>(
      'INSERT INTO conversations DEFAULT VALUES RETURNING id'
    );
    return result.rows[0].id;
  },

  async findConversation(id: string): Promise<Conversation | null> {
    const result = await pool.query<Conversation>(
      'SELECT * FROM conversations WHERE id = $1',
      [id]
    );
    return result.rows[0] ?? null;
  },

  async saveMessage(
    conversationId: string,
    sender: 'user' | 'ai',
    text: string
  ): Promise<Message> {
    const result = await pool.query<Message>(
      `INSERT INTO messages (conversation_id, sender, text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [conversationId, sender, text]
    );
    return result.rows[0];
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const result = await pool.query<Message>(
      `SELECT * FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
    return result.rows;
  },

  async touchConversation(id: string): Promise<void> {
    await pool.query(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [id]
    );
  },
};
```

---

### `services/llm.service.ts`

This file does two things: runs the OpenAI stream, and classifies any errors that come out.

```typescript
import OpenAI from 'openai';
import { config } from '../config';
import { LLMError, LLMErrorType } from '../types';
import { Message } from '../types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

// ── Context window budget ──────────────────────────────────────────────────
// Keep at most the last 10 messages OR 12,000 chars of history (~3,000 tokens).
// This is a deliberate trade-off: older context is dropped to control cost.
// Document this assumption in the README.
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CHARS    = 12_000;

export function buildContextWindow(history: Message[]): Message[] {
  const recent = history.slice(-MAX_HISTORY_MESSAGES);
  let charCount = 0;
  const windowed: Message[] = [];

  // Walk from newest → oldest, stop when budget exceeded
  for (let i = recent.length - 1; i >= 0; i--) {
    charCount += recent[i].text.length;
    if (charCount > MAX_HISTORY_CHARS) break;
    windowed.unshift(recent[i]);
  }

  return windowed;
}

// ── System prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Lumi, the AI support agent for Lumio — a D2C smart home lighting brand. Be warm, direct, and concise. No filler phrases.

=== STORE KNOWLEDGE ===

Products:
- Smart LED Bulbs (₹499–₹1,499): Alexa + Google Home compatible. Warm white, cool white, RGB modes.
- Ambient Strip Lights (₹999–₹2,999): Cuttable, waterproof options available. USB and hardwired variants.
- Dimmable Floor Lamps (₹3,499–₹8,999): Minimalist design, touch control, 3 warmth presets.

Shipping:
- India: Free shipping. 3–5 business days.
- Express (metro cities): ₹149 flat, 1–2 days.
- International (30+ countries): Charges at checkout. 7–12 business days.

Returns & Refunds:
- 30-day no-questions-asked return policy. Items unused, original packaging.
- Refunds in 5–7 business days after return received.
- Damaged on arrival? Email support@lumio.in with photo within 48 hours — replaced for free.

Warranty: 1-year on all products. Claim: warranty@lumio.in
Support: Mon–Fri, 9 AM–6 PM IST. Email: support@lumio.in
Discounts: LUMIO10 for 10% off first order. Bulk (50+ units): bulk@lumio.in

=== BEHAVIOR RULES ===
1. Answer directly. No "Great question!" or "Certainly!".
2. If you don't know: "I don't have that info. Please email support@lumio.in."
3. Never fabricate policies, prices, or specs.
4. If frustrated: acknowledge before solving.
5. Ask at most one clarifying question at a time.`;

// ── Error taxonomy ─────────────────────────────────────────────────────────
// Three distinct failure modes surfaced differently in the UI.
export function classifyOpenAIError(err: unknown): LLMError {
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return {
      errorType: 'TIMEOUT',
      message: "Lumi is taking too long to respond. Please try again.",
    };
  }
  if (err instanceof OpenAI.RateLimitError) {
    return {
      errorType: 'RATE_LIMIT',
      message: "Too many requests right now. Please wait a moment and try again.",
    };
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return {
      errorType: 'AUTH_FAILURE',
      message: "Support is temporarily unavailable. Please email support@lumio.in.",
    };
  }
  if (err instanceof OpenAI.APIError && err.status >= 500) {
    return {
      errorType: 'PROVIDER_DOWN',
      message: "Lumi is temporarily down. Email support@lumio.in for urgent queries.",
    };
  }
  return {
    errorType: 'UNKNOWN',
    message: "Something went wrong. Please try again.",
  };
}

// ── Generator ──────────────────────────────────────────────────────────────
export async function* generateReply(
  history: Message[],
  userMessage: string
): AsyncGenerator<string> {
  const contextWindow = buildContextWindow(history);

  const formattedHistory = contextWindow.map((m) => ({
    role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  const stream = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 500,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...formattedHistory,
      { role: 'user', content: userMessage },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content ?? '';
    if (text) yield text;
  }
}
```

---

### `services/chat.service.ts`

Business logic only. No HTTP, no `req`/`res`.

```typescript
import { chatRepository } from '../repositories/chat.repository';
import { generateReply } from './llm.service';
import { Message } from '../types';

export const chatService = {
  // Returns conversationId + AsyncGenerator.
  // DB errors throw here — before SSE starts — so the handler can return a clean JSON 500.
  async prepareStream(
    userMessage: string,
    sessionId: string | null
  ): Promise<{ conversationId: string; generator: AsyncGenerator<string> }> {
    // Resolve or create conversation
    let conversationId = sessionId;

    if (conversationId) {
      const existing = await chatRepository.findConversation(conversationId);
      if (!existing) conversationId = null; // stale session → start fresh
    }

    if (!conversationId) {
      conversationId = await chatRepository.createConversation();
    }

    // Persist user message
    await chatRepository.saveMessage(conversationId, 'user', userMessage);

    // Fetch history (excluding the message we just saved — it's already in userMessage)
    const allMessages = await chatRepository.getMessages(conversationId);
    const history = allMessages.slice(0, -1);

    const generator = generateReply(history, userMessage);

    return { conversationId, generator };
  },

  async persistAIMessage(conversationId: string, text: string): Promise<void> {
    await chatRepository.saveMessage(conversationId, 'ai', text);
    await chatRepository.touchConversation(conversationId);
  },

  async getHistory(sessionId: string): Promise<Message[] | null> {
    const conv = await chatRepository.findConversation(sessionId);
    if (!conv) return null;
    return chatRepository.getMessages(sessionId);
  },
};
```

---

### `handlers/chat.handler.ts`

This is the most nuanced file. Owns HTTP lifecycle and SSE protocol. Contains the key design decision: DB errors before stream start → JSON 500. LLM errors during stream → SSE error event.

```typescript
import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { classifyOpenAIError } from '../services/llm.service';
import { SSEEvent } from '../types';

function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export const chatHandler = {
  async handleMessage(req: Request, res: Response): Promise<void> {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };

    // ── Phase 1: DB operations (before SSE starts) ─────────────────────────
    // If DB fails here, we return a normal JSON error — frontend handles it.
    let conversationId: string;
    let generator: AsyncGenerator<string>;

    try {
      const result = await chatService.prepareStream(message, sessionId ?? null);
      conversationId = result.conversationId;
      generator = result.generator;
    } catch (err) {
      console.error('DB error in prepareStream:', err);
      res.status(500).json({ error: 'Failed to start conversation. Please try again.' });
      return;
    }

    // ── Phase 2: SSE stream ────────────────────────────────────────────────
    // Once headers are set, we can only communicate via SSE events.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if behind proxy
    res.flushHeaders();

    let fullReply = '';

    try {
      for await (const chunk of generator) {
        fullReply += chunk;
        sendSSE(res, { type: 'chunk', content: chunk });
      }

      // Persist the complete AI reply
      await chatService.persistAIMessage(conversationId, fullReply);

      // Signal completion with sessionId
      sendSSE(res, { type: 'done', sessionId: conversationId });
    } catch (err) {
      // LLM/network error mid-stream
      const llmErr = classifyOpenAIError(err);
      sendSSE(res, { type: 'error', ...llmErr });
    } finally {
      res.end();
    }
  },

  async handleHistory(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;

    const messages = await chatService.getHistory(sessionId);

    if (messages === null) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ messages, sessionId });
  },
};
```

---

### `middleware/validate.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

const MAX_MESSAGE_LENGTH = 2000;

export function validateChatMessage(req: Request, res: Response, next: NextFunction): void {
  const { message } = req.body;

  if (message === undefined || message === null) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  if (typeof message !== 'string') {
    res.status(400).json({ error: 'message must be a string' });
    return;
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    res.status(400).json({ error: 'message cannot be empty' });
    return;
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({
      error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
      length: trimmed.length,
      max: MAX_MESSAGE_LENGTH,
    });
    return;
  }

  req.body.message = trimmed; // normalize
  next();
}
```

---

### `middleware/rateLimit.ts`

In-memory rate limit. Per session: 20 messages per minute. Documents well in the README as a deliberate trade-off (resets on server restart, not shared across instances).

```typescript
import { Request, Response, NextFunction } from 'express';

const LIMIT       = 20;
const WINDOW_MS   = 60_000;
const store       = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  // Use sessionId if present, fall back to IP
  const key = (req.body?.sessionId as string | undefined) ?? req.ip ?? 'unknown';
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= LIMIT) {
    res.status(429).json({
      error: 'Too many messages. Please wait a moment.',
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
    return;
  }

  entry.count++;
  next();
}

// Prevent unbounded memory growth — prune expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000);
```

---

### `middleware/errorHandler.ts`

Global Express error handler — last resort for anything that slips through.

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

---

### `routes/chat.routes.ts`

```typescript
import { Router } from 'express';
import { chatHandler } from '../handlers/chat.handler';
import { validateChatMessage } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';

export const chatRouter = Router();

chatRouter.post('/message', rateLimit, validateChatMessage, chatHandler.handleMessage);
chatRouter.get('/history/:sessionId', chatHandler.handleHistory);
```

---

### `app.ts`

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config';
import { chatRouter } from './routes/chat.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(cors({
  origin: config.frontendUrl,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '10kb' })); // reject absurdly large bodies early

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/chat', chatRouter);
app.use(errorHandler);
```

---

### `index.ts`

```typescript
import { app } from './app';
import { config } from './config';
import { pool } from './db';

async function start() {
  // Verify DB connection on boot — fail fast
  try {
    await pool.query('SELECT 1');
    console.log('✓ PostgreSQL connected');
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`✓ Server running on port ${config.port}`);
  });
}

start();
```

---

### Backend `package.json`

```json
{
  "name": "spur-chat-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "migrate": "psql $DATABASE_URL -f src/db/migrations/001_init.sql"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "openai": "^4.47.1",
    "pg": "^8.11.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/pg": "^8.11.5",
    "tsx": "^4.15.6",
    "typescript": "^5.4.5"
  }
}
```

### Backend `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 6. Frontend — File by File

### `types/index.ts`

```typescript
export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export type SSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; errorType: string; message: string };
```

---

### `services/api.ts`

The most critical frontend file. The SSE buffering here prevents dropped chunks when data arrives split across multiple `read()` calls — a real failure mode most people don't handle.

```typescript
import { ChatMessage, SSEEvent } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (sessionId: string) => void;
  onError: (message: string) => void;
}

export const api = {
  async streamMessage(
    message: string,
    sessionId: string | null,
    callbacks: StreamCallbacks
  ): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${BASE_URL}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId }),
      });
    } catch {
      callbacks.onError('Could not reach the server. Check your connection.');
      return;
    }

    // Non-2xx before streaming starts → backend returned JSON error
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      callbacks.onError(data.error || 'Something went wrong.');
      return;
    }

    if (!response.body) {
      callbacks.onError('No response body received.');
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    // ── SSE parsing with buffering ────────────────────────────────────────
    // SSE chunks can arrive split mid-line across multiple read() calls.
    // We accumulate into a buffer and only process complete lines.
    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;

      try {
        ({ done, value } = await reader.read());
      } catch {
        callbacks.onError('Connection lost mid-stream.');
        break;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on newlines, keep the last (potentially incomplete) line in buffer
      const lines  = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const event = JSON.parse(raw) as SSEEvent;

          if (event.type === 'chunk') callbacks.onChunk(event.content);
          if (event.type === 'done')  callbacks.onDone(event.sessionId);
          if (event.type === 'error') callbacks.onError(event.message);
        } catch {
          // Malformed JSON chunk — skip silently
        }
      }
    }
  },

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const response = await fetch(`${BASE_URL}/api/chat/history/${sessionId}`);
    if (!response.ok) throw new Error('Session not found');
    const data = await response.json();
    return data.messages.map((m: {
      id: string; sender: 'user' | 'ai'; text: string; created_at: string
    }): ChatMessage => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.created_at,
    }));
  },
};
```

---

### `hooks/useChat.ts`

All state lives here. Request deduplication via `useRef` (survives renders, unlike `useState`). Session persistence via `localStorage`. History fetch on mount with stale-session recovery.

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { ChatMessage } from '../types';

const SESSION_KEY = 'lumio_session_id';

export function useChat() {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [sessionId, setSessionId]       = useState<string | null>(
    () => localStorage.getItem(SESSION_KEY)
  );

  // useRef for deduplication — survives re-renders, won't trigger effects
  const isInFlight = useRef(false);

  // ── Load history on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    api.getHistory(sessionId)
      .then((history) => {
        if (history.length === 0) {
          // Valid session but empty — treat as fresh
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        } else {
          setMessages(history);
        }
      })
      .catch(() => {
        // 404 or network error — session is stale, start fresh
        localStorage.removeItem(SESSION_KEY);
        setSessionId(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    // Deduplication: block if already in flight
    if (isInFlight.current || isStreaming || !text.trim()) return;

    isInFlight.current = true;
    setError(null);
    setIsStreaming(true);

    // Optimistically add user message to the UI
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreamingText('');

    let accumulated = '';

    try {
      await api.streamMessage(text.trim(), sessionId, {
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
        },
        onDone: (sid) => {
          // Persist session
          localStorage.setItem(SESSION_KEY, sid);
          setSessionId(sid);

          // Commit streaming text as a real message
          const aiMsg: ChatMessage = {
            id: crypto.randomUUID(),
            sender: 'ai',
            text: accumulated,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, aiMsg]);
          setStreamingText('');
          accumulated = '';
        },
        onError: (errMsg) => {
          setError(errMsg);
          setStreamingText('');
          accumulated = '';
        },
      });
    } catch {
      setError('Something went wrong. Please try again.');
      setStreamingText('');
    } finally {
      setIsStreaming(false);
      isInFlight.current = false;
    }
  }, [sessionId, isStreaming]);

  return { messages, streamingText, isStreaming, error, sendMessage };
}
```

---

### `components/MessageBubble.tsx`

```tsx
import { ChatMessage } from '../types';

interface Props {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: Props) {
  const isUser = message.sender === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '12px',
    }}>
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        backgroundColor: isUser ? '#2563eb' : '#f1f5f9',
        color: isUser ? '#ffffff' : '#1e293b',
        fontSize: '14px',
        lineHeight: '1.5',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {message.text}
        {isStreaming && (
          <span style={{
            display: 'inline-block',
            width: '2px',
            height: '14px',
            backgroundColor: '#64748b',
            marginLeft: '2px',
            verticalAlign: 'middle',
            animation: 'blink 1s step-end infinite',
          }} />
        )}
      </div>
    </div>
  );
}
```

---

### `components/MessageList.tsx`

```tsx
import { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface Props {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
}

export function MessageList({ messages, streamingText, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on every new message or streaming chunk
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
    }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Live streaming bubble */}
      {isStreaming && streamingText && (
        <MessageBubble
          message={{
            id: '__streaming__',
            sender: 'ai',
            text: streamingText,
            timestamp: new Date().toISOString(),
          }}
          isStreaming
        />
      )}

      {/* Typing indicator when stream hasn't produced text yet */}
      {isStreaming && !streamingText && (
        <div style={{ color: '#94a3b8', fontSize: '13px', padding: '4px 0' }}>
          Lumi is typing…
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
```

---

### `components/ChatInput.tsx`

```tsx
import { useState, KeyboardEvent } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '12px 16px',
      borderTop: '1px solid #e2e8f0',
      backgroundColor: '#ffffff',
    }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Lumi anything…"
        disabled={disabled}
        rows={1}
        maxLength={2000}
        style={{
          flex: 1,
          resize: 'none',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '14px',
          fontFamily: 'inherit',
          outline: 'none',
          lineHeight: '1.5',
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        style={{
          padding: '8px 16px',
          backgroundColor: disabled || !text.trim() ? '#e2e8f0' : '#2563eb',
          color: disabled || !text.trim() ? '#94a3b8' : '#ffffff',
          border: 'none',
          borderRadius: '8px',
          cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'background-color 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {disabled ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}
```

---

### `components/ChatWidget.tsx`

```tsx
import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatWidget() {
  const { messages, streamingText, isStreaming, error, sendMessage } = useChat();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '420px',
      height: '600px',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #e2e8f0',
        backgroundColor: '#2563eb',
        color: '#ffffff',
      }}>
        <div style={{ fontWeight: 700, fontSize: '15px' }}>Lumio Support</div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>
          {isStreaming ? 'Lumi is typing…' : 'Lumi · AI Support Agent'}
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
      />

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          fontSize: '13px',
          borderTop: '1px solid #fecaca',
        }}>
          {error}
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
```

---

### `App.tsx`

```tsx
import { ChatWidget } from './components/ChatWidget';

export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
    }}>
      <ChatWidget />
    </div>
  );
}
```

Add the blinking cursor CSS in `index.html` or a global CSS file:

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

### Frontend `package.json`

```json
{
  "name": "spur-chat-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

---

## 7. Environment Variables

### `backend/.env.example`

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/spur_chat
OPENAI_API_KEY=sk-...

# Optional
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

### `frontend/.env.example`

```env
VITE_API_URL=http://localhost:3001
```

---

## 8. Local Setup (Step by Step)

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm

### 1. Clone and install

```bash
git clone https://github.com/your-username/spur-chat
cd spur-chat

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env: add your DATABASE_URL and OPENAI_API_KEY

cd ../frontend
cp .env.example .env
# VITE_API_URL defaults to http://localhost:3001 — leave as is for local dev
```

### 3. Create database

```bash
createdb spur_chat
# Or via psql: CREATE DATABASE spur_chat;
```

### 4. Run migrations

```bash
cd backend
psql $DATABASE_URL -f src/db/migrations/001_init.sql
# Or: DATABASE_URL=postgresql://... npm run migrate
```

### 5. Run backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
# You should see: ✓ PostgreSQL connected + ✓ Server running on port 3001
```

### 6. Run frontend

```bash
cd frontend
npm run dev
# Vite starts on http://localhost:5173
```

Open `http://localhost:5173` — chat widget is ready.

---

## 9. Deployment

### Backend → Railway

1. Create a new Railway project
2. Add a PostgreSQL plugin — Railway auto-sets `DATABASE_URL`
3. Add your repo as a service, point to `/backend`
4. Set env vars: `OPENAI_API_KEY`, `FRONTEND_URL` (your Vercel URL), `NODE_ENV=production`
5. Start command: `npm run build && npm start`
6. After deploy, run migration: `railway run npm run migrate`

### Frontend → Vercel

1. Import repo on Vercel, set root directory to `/frontend`
2. Set env var: `VITE_API_URL=https://your-railway-app.railway.app`
3. Deploy

**Update Railway** `FRONTEND_URL` with the Vercel URL after deploy.

---

## 10. README Template

Use this as your actual README.md in the repo:

```markdown
# Spur Chat — AI Support Agent

Live demo: [your-vercel-url]
Backend: [your-railway-url]

## What it does

AI-powered live chat widget for Lumio, a fictional D2C lighting brand.
Users can ask about products, shipping, returns, and warranty.
Conversations persist across sessions. Reload the page — history loads back.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **LLM:** OpenAI GPT-4o-mini (streaming via SSE)
- **Deploy:** Railway (backend + DB) + Vercel (frontend)

## Local Setup

[paste section 8 here]

## Architecture

[paste the architecture diagram from this roadmap here]

Four layers with strict separation:
- **routes/** — URL mapping only
- **handlers/** — owns HTTP lifecycle and SSE protocol
- **services/** — all business logic, never touches req/res
- **repositories/** — all SQL, no business logic

## LLM Notes

- Provider: OpenAI GPT-4o-mini
- Streaming: Server-Sent Events (SSE) via `fetch()` + `ReadableStream`
- Context window: Last 10 messages OR 12,000 chars, whichever is smaller (~3,000 tokens).
  Older context is dropped. This is a deliberate cost/accuracy trade-off.
- Max tokens per response: 500
- System prompt hardcoded — store knowledge baked in. Could be DB-driven per tenant in V2.

## Error Handling

Three distinct LLM failure modes, each surfaced differently:

| Error | User sees |
|---|---|
| Timeout | "Lumi is taking too long. Please try again." |
| Rate limit | "Too many requests. Please wait a moment." |
| Provider down | "Support temporarily unavailable. Email support@lumio.in." |

DB errors before stream starts → JSON 500.
LLM errors during stream → SSE error event (can't change HTTP status mid-stream).

## Trade-offs & If I Had More Time

- **Rate limiting is in-memory** — resets on restart, not shared across instances. Production needs Redis.
- **No auth** — sessionId is the only identity. Fine for demo; real product needs user accounts.
- **System prompt is hardcoded** — could be stored in DB and customized per tenant.
- **No message edit/delete** — straightforward to add.
- **No Redis** — would add for session store and distributed rate limiting.
- **No tests** — would add integration tests for the SSE streaming flow and repository layer.
```

---

## 11. Architecture Decisions Log

Keep a short version of this reasoning in your head for the interview.

| Decision | Why |
|---|---|
| SSE over WebSockets | SSE is unidirectional, simpler, works over HTTP/2. WebSockets add complexity for a chat that only streams from server → client. |
| `fetch()` + `ReadableStream` over `EventSource` | `EventSource` doesn't support POST. We need POST for the body. |
| Buffer SSE lines in frontend | `read()` can return data split across newlines. Naive split breaks on partial lines. |
| DB errors before SSE start → JSON, during stream → SSE event | Once you call `res.setHeader()` + `res.flushHeaders()`, you can't change the HTTP status. Must distinguish phases. |
| Slide window by chars, not just message count | Token estimators are approximate. Char count is cheap, deterministic, and documents clearly. 12,000 chars ≈ 3,000 tokens is documented and defensible. |
| `useRef` for deduplication | `useState` triggers re-renders. `useRef` persists across renders without causing them — right tool for a flag. |
| UUID as sessionId | Safe to expose publicly. No sequential ID leakage. Collision probability negligible. |
| `validateChatMessage` as middleware | Business rule (max 2000 chars) enforced at the HTTP boundary, before the handler even sees the request. |

---

## 12. Trade-offs & "If I Had More Time"

Document this honestly in your README. Reviewers respect it.

**What's deliberately left out:**
- Redis (rate limit resets on server restart — documented)
- Auth (sessionId-as-identity is stated, not accidental)
- Message pagination (history loads all messages — fine for a demo, noted)

**What I'd add next:**
- Redis for distributed rate limiting + session TTL
- Per-tenant system prompts stored in DB (multi-brand support)
- Streaming abort — cancel button that kills the fetch mid-stream
- Integration tests covering the SSE flow end to end
- Token counting with `tiktoken` instead of char estimation
- Message reactions / feedback (thumbs up/down) to capture bad responses
