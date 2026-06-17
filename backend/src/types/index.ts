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

export type LLMErrorType = 'TIMEOUT' | 'RATE_LIMIT' | 'AUTH_FAILURE' | 'PROVIDER_DOWN' | 'UNKNOWN';

export interface LLMError {
  errorType: LLMErrorType;
  message: string;
}

export type SSEEvent =
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; errorType: LLMErrorType; message: string };
