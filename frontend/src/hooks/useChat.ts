import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { ChatMessage } from '../types';

const SESSION_KEY = 'lumio_session_id';

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const isInFlightRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    api.getHistory(sessionId)
      .then((history) => {
        if (cancelled) return;

        if (history.length === 0) {
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
          return;
        }

        setMessages(history);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (isInFlightRef.current || isStreaming || !trimmed) return;

    isInFlightRef.current = true;
    setError(null);
    setIsStreaming(true);
    setStreamingText('');

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    let accumulated = '';

    try {
      await api.streamMessage(trimmed, sessionId, {
        onChunk: (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
        },
        onDone: (newSessionId) => {
          localStorage.setItem(SESSION_KEY, newSessionId);
          setSessionId(newSessionId);

          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            sender: 'ai',
            text: accumulated,
            timestamp: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, aiMessage]);
          setStreamingText('');
          accumulated = '';
        },
        onError: (message) => {
          setError(message);
          setStreamingText('');
          accumulated = '';
        },
      });
    } catch {
      setError('Something went wrong. Please try again.');
      setStreamingText('');
    } finally {
      setIsStreaming(false);
      isInFlightRef.current = false;
    }
  }, [isStreaming, sessionId]);

  return { messages, streamingText, isStreaming, error, sendMessage };
}
