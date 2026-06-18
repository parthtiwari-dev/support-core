import { ChatMessage } from '../types';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  showTimestamp?: boolean;
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => void;
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function MessageBubble({
  message,
  isStreaming = false,
  showTimestamp = false,
  onFeedback,
}: MessageBubbleProps) {
  const canShowFeedback = message.sender === 'ai' && !isStreaming;
  const feedbackLocked = Boolean(message.feedback);

  return (
    <div className={`message-row ${message.sender}`}>
      <div className="message-text">
        {message.text}
        {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
      </div>

      {showTimestamp && (
        <div className="message-timestamp">{formatTime(message.timestamp)}</div>
      )}

      {canShowFeedback && (
        <div className="message-feedback" aria-label="Message feedback">
          <button
            type="button"
            className={message.feedback === 'up' ? 'active' : ''}
            onClick={() => onFeedback?.(message.id, 'up')}
            disabled={feedbackLocked}
            aria-label="Mark response helpful"
            title="Helpful"
          >
            <span aria-hidden="true">&#128077;</span>
          </button>
          <button
            type="button"
            className={message.feedback === 'down' ? 'active' : ''}
            onClick={() => onFeedback?.(message.id, 'down')}
            disabled={feedbackLocked}
            aria-label="Mark response unhelpful"
            title="Not helpful"
          >
            <span aria-hidden="true">&#128078;</span>
          </button>
        </div>
      )}
    </div>
  );
}
