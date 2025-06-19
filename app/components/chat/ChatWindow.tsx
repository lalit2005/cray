import React, { useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "@remix-run/react";
import { useChatMessages } from "./useChatMessages";
import { useChatInteraction } from "./useChatInteraction";
import { LoadingState } from "./LoadingState";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

export const ChatWindow: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Handle initial load and URL state
  React.useEffect(() => {
    // Only run this effect once on mount
    const hasNew = searchParams.has("new");
    const hasId = searchParams.has("id");

    // If we have an ID, we're good
    if (hasId) return;

    // If we're at the root with no params, set 'new' param
    if (location.pathname === "/" && !hasNew) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("new", "true");
      navigate(`/?${newParams.toString()}`, { replace: true });
    }
  }, [location.pathname, navigate, searchParams]);

  // Get the chat ID from URL params
  const chatId = searchParams.get("id");

  // Get messages for the current chat
  const { messages, isLoading, messagesEndRef } = useChatMessages(chatId);

  // Chat interaction logic
  const {
    input,
    handleInputChange,
    handleSendMessage,
    chatError,
    status,
    currentProvider,
    setCurrentProvider,
    currentModel,
    setCurrentModel,
    inputRef,
  } = useChatInteraction(chatId, messages);

  return (
    <div className="h-screen flex flex-col mx-auto">
      {/* Messages area */}
      <div
        className="flex-1 p-4 space-y-4 overflow-y-auto pb-60"
        ref={messagesContainerRef}
        id="chatWindow"
      >
        {isLoading ? (
          <LoadingState />
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          <MessageList messages={messages} messagesEndRef={messagesEndRef} />
        )}
      </div>

      {/* Input area */}
      <ChatInput
        inputRef={inputRef}
        input={input}
        handleInputChange={handleInputChange}
        handleSendMessage={handleSendMessage}
        status={status}
        chatError={chatError ?? null}
        currentProvider={currentProvider}
        currentModel={currentModel}
        setCurrentProvider={setCurrentProvider}
        setCurrentModel={setCurrentModel}
        messagesLength={messages.length}
      />
    </div>
  );
};
