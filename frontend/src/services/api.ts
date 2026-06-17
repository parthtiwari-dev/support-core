import { ChatMessage, SSEEvent } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (sessionId: string) => void;
  onError: (message: string) => void;
}

interface HistoryMessageResponse {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: string;
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

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      callbacks.onError(data.error || 'Failed to send message.');
      return;
    }

    if (!response.body) {
      callbacks.onError('No response body received.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let completed = false;

    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;

      try {
        ({ done, value } = await reader.read());
      } catch {
        callbacks.onError('Connection lost mid-stream.');
        return;
      }

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;

        try {
          const event: SSEEvent = JSON.parse(payload);

          if (event.type === 'chunk') {
            callbacks.onChunk(event.content);
          } else if (event.type === 'done') {
            completed = true;
            callbacks.onDone(event.sessionId);
            return;
          } else if (event.type === 'error') {
            completed = true;
            callbacks.onError(event.message);
            return;
          }
        } catch {
          // Malformed SSE payloads are ignored so a single bad line does not kill the stream.
        }
      }
    }

    if (!completed) {
      callbacks.onError('Connection closed before the response finished.');
    }
  },

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const response = await fetch(`${BASE_URL}/api/chat/history/${sessionId}`);
    if (!response.ok) throw new Error('Session not found');

    const data = await response.json();
    return data.messages.map((message: HistoryMessageResponse): ChatMessage => ({
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestamp: message.created_at,
    }));
  },
};
