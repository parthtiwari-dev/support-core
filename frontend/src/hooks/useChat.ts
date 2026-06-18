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
    if (!error) return undefined;

    const timer = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [error]);

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
        onDone: (newSessionId, aiMessage) => {
          localStorage.setItem(SESSION_KEY, newSessionId);
          setSessionId(newSessionId);

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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startNewChat = useCallback(() => {
    if (isInFlightRef.current || isStreaming) return;

    const hasConversation = messages.length > 0 || sessionId !== null;
    if (
      hasConversation &&
      !window.confirm('Start a new conversation? Your current chat will end.')
    ) {
      return;
    }

    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setStreamingText('');
    setError(null);
  }, [isStreaming, messages.length, sessionId]);

  const submitFeedback = useCallback(async (
    messageId: string,
    feedback: 'up' | 'down'
  ) => {
    const currentMessage = messages.find((message) => message.id === messageId);
    if (!currentMessage || currentMessage.sender !== 'ai' || currentMessage.feedback) return;

    setMessages((prev) => prev.map((message) => (
      message.id === messageId ? { ...message, feedback } : message
    )));

    try {
      const updatedMessage = await api.submitFeedback(messageId, feedback);
      setMessages((prev) => prev.map((message) => (
        message.id === messageId
          ? { ...message, feedback: updatedMessage.feedback }
          : message
      )));
    } catch {
      setMessages((prev) => prev.map((message) => (
        message.id === messageId
          ? { ...message, feedback: currentMessage.feedback ?? null }
          : message
      )));
      setError('Could not save feedback. Please try again.');
    }
  }, [messages]);

  return {
    messages,
    streamingText,
    isStreaming,
    error,
    sendMessage,
    startNewChat,
    submitFeedback,
    clearError,
  };
}
