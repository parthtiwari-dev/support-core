import { Request, Response, NextFunction } from 'express';

const MAX_MESSAGE_LENGTH = 2000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  req.body.message = trimmed;
  next();
}

export function validateChatFeedback(req: Request, res: Response, next: NextFunction): void {
  const { messageId, feedback } = req.body;

  if (typeof messageId !== 'string' || !UUID_REGEX.test(messageId)) {
    res.status(400).json({ error: 'valid messageId is required' });
    return;
  }

  if (feedback !== 'up' && feedback !== 'down') {
    res.status(400).json({ error: 'feedback must be up or down' });
    return;
  }

  next();
}
