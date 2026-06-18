import { Router } from 'express';
import { chatHandler } from '../handlers/chat.handler';
import { validateChatFeedback, validateChatMessage } from '../middleware/validate';
import { rateLimit } from '../middleware/rateLimit';

export const chatRouter = Router();

chatRouter.post('/message', rateLimit, validateChatMessage, chatHandler.handleMessage);
chatRouter.post('/feedback', validateChatFeedback, chatHandler.handleFeedback);
chatRouter.get('/history/:sessionId', chatHandler.handleHistory);
