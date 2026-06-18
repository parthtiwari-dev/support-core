export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  feedback?: 'up' | 'down' | null;
}

export type SSEEvent =
  | { type: 'chunk'; content: string }
  | {
      type: 'done';
      sessionId: string;
      message: {
        id: string;
        sender: 'user' | 'ai';
        text: string;
        feedback: 'up' | 'down' | null;
        created_at: string;
      };
    }
  | { type: 'error'; errorType: string; message: string };
