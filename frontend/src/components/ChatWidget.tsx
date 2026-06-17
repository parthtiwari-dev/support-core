import { useChat } from '../hooks/useChat';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

export function ChatWidget() {
  const { messages, streamingText, isStreaming, error, sendMessage } = useChat();

  return (
    <div className="chat-widget">
      <div className="chat-header">
        <div className="chat-title">Lumio Support</div>
        <div className="chat-subtitle">
          {isStreaming ? 'Lumi is typing...' : 'Lumi · AI Support Agent'}
        </div>
      </div>

      <MessageList messages={messages} streamingText={streamingText} isStreaming={isStreaming} />
      {error && <div className="chat-error">{error}</div>}
      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
