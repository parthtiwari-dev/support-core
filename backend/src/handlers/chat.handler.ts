import { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { classifyOpenAIError } from '../services/llm.service';
import { Message, SSEEvent } from '../types';

function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export const chatHandler = {
  async handleMessage(req: Request, res: Response): Promise<void> {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };

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

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let fullReply = '';

    try {
      for await (const chunk of generator) {
        fullReply += chunk;
        sendSSE(res, { type: 'chunk', content: chunk });
      }

      await chatService.persistAIMessage(conversationId, fullReply);
      sendSSE(res, { type: 'done', sessionId: conversationId });
    } catch (err) {
      const llmErr = classifyOpenAIError(err);
      sendSSE(res, { type: 'error', ...llmErr });
    } finally {
      res.end();
    }
  },

  async handleHistory(req: Request, res: Response): Promise<void> {
    const { sessionId } = req.params;

    let messages: Message[] | null;
    try {
      messages = await chatService.getHistory(sessionId);
    } catch (err) {
      console.error('DB error in getHistory:', err);
      res.status(500).json({ error: 'Failed to load conversation history.' });
      return;
    }

    if (messages === null) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ messages, sessionId });
  },
};
