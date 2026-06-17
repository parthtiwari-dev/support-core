import { chatRepository } from '../repositories/chat.repository';
import { generateReply } from './llm.service';
import { Message } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeSessionId(sessionId: string | null): string | null {
  if (!sessionId) return null;
  return UUID_REGEX.test(sessionId) ? sessionId : null;
}

export const chatService = {
  async prepareStream(
    userMessage: string,
    sessionId: string | null
  ): Promise<{ conversationId: string; generator: AsyncGenerator<string> }> {
    let conversationId = normalizeSessionId(sessionId);

    if (conversationId) {
      const existing = await chatRepository.findConversation(conversationId);
      if (!existing) conversationId = null;
    }

    if (!conversationId) {
      conversationId = await chatRepository.createConversation();
    }

    await chatRepository.saveMessage(conversationId, 'user', userMessage);

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
    if (!normalizeSessionId(sessionId)) return null;

    const conv = await chatRepository.findConversation(sessionId);
    if (!conv) return null;
    return chatRepository.getMessages(sessionId);
  },
};
