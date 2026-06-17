import { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: ChatMessage[];
  streamingText: string;
  isStreaming: boolean;
}

export function MessageList({ messages, streamingText, isStreaming }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingText]);

  return (
    <div className="message-list" ref={containerRef}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
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
