import { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  return (
    <div className={`message-bubble ${message.sender}`}>
      <div className="message-text">
        {message.text}
        {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
      </div>
    </div>
  );
}
