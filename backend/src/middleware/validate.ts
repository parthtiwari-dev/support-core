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

  req.body.message = trimmed;
  next();
}
