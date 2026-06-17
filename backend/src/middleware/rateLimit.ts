import { Request, Response, NextFunction } from 'express';

const LIMIT = 20;
const WINDOW_MS = 60_000;
const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
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

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000);
