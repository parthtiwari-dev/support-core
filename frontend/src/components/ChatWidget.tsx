import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatWidget() {
  const {
    messages,
    streamingText,
    isStreaming,
    error,
    sendMessage,
    startNewChat,
    submitFeedback,
    clearError,
  } = useChat();

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div>
          <div className="chat-title">Lumio Support</div>
          <div className="chat-subtitle">
            {isStreaming ? 'Lumi is typing...' : <>Lumi &middot; AI Support Agent</>}
          </div>
        </div>
        <button
          className="new-chat-button"
          type="button"
          onClick={startNewChat}
          disabled={isStreaming}
          aria-label="Start new chat"
          title="Start new chat"
        >
          +
        </button>
      </div>

      <MessageList
        messages={messages}
        streamingText={streamingText}
        isStreaming={isStreaming}
        onQuickReply={sendMessage}
        onFeedback={submitFeedback}
      />

      {error && (
        <div className="chat-error" role="status">
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
