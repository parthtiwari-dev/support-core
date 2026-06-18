import { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

const QUICK_REPLIES = [
  "What's your return policy?",
  'Do you ship internationally?',
  'How do I claim warranty?',
  'Any active discounts?',
] as const;

interface MessageListProps {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
  onQuickReply: (text: string) => void;
  onFeedback: (messageId: string, feedback: 'up' | 'down') => void;
}

function minuteKey(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`;
}

function shouldShowTimestamp(messages: ChatMessage[], index: number): boolean {
  const current = messages[index];
  const next = messages[index + 1];

  if (!next) return true;
  return current.sender !== next.sender || minuteKey(current.timestamp) !== minuteKey(next.timestamp);
}

export function MessageList({
  messages,
  streamingText,
  isStreaming,
  onQuickReply,
  onFeedback,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showWelcome = messages.length === 0 && !isStreaming;

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div className="message-list" ref={containerRef}>
      {showWelcome && (
        <div className="welcome-panel">
          <div className="welcome-message">
            <strong>Hi! I&apos;m Lumi, Lumio&apos;s support assistant.</strong>
            <span>Here to help with orders, returns, and products. &#128075;</span>
          </div>
          <div className="quick-replies">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => onQuickReply(reply)}
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          showTimestamp={shouldShowTimestamp(messages, index)}
          onFeedback={onFeedback}
        />
      ))}

      {isStreaming && streamingText && (
        <MessageBubble
          message={{
            id: '__streaming__',
            sender: 'ai',
            text: streamingText,
            timestamp: new Date().toISOString(),
          }}
          isStreaming
          showTimestamp={false}
        />
      )}

      {isStreaming && !streamingText && (
        <div className="typing-indicator">
          <span>Lumi is typing...</span>
        </div>
      )}
    </div>
  );
}
