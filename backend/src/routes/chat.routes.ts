import { Router } from 'express';
import { chatHandler } from '../handlers/chat.handler';
import { validateChatMessage } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';

export const chatRouter = Router();

chatRouter.post('/message', rateLimit, validateChatMessage, chatHandler.handleMessage);
chatRouter.get('/history/:sessionId', chatHandler.handleHistory);
