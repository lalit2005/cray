import React, { memo, useCallback } from "react";
import { ModelSelector } from "./ModelSelector";
import { ChatErrorDisplay } from "./ChatErrorDisplay";
import { LLMProvider } from "./types";
import clsx from "clsx";

interface ChatInputProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSendMessage: () => void;
  status: string;
  chatError: Error | null;
  currentProvider: LLMProvider;
  currentModel: string;
  setCurrentProvider: (provider: LLMProvider) => void;
  setCurrentModel: (model: string) => void;
  messagesLength: number;
}

// Create a memoized textarea component to prevent unnecessary re-renders
interface MemoizedTextAreaProps {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSendMessage: () => void;
  status: string;
  messagesLength: number;
}

const MemoizedTextArea = memo(function MemoizedTextArea({
  inputRef,
  input,
  handleInputChange,
  handleSendMessage,
  status,
  messagesLength,
}: MemoizedTextAreaProps) {
  // Memoize the keydown handler with high priority
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (status !== "streaming") {
          handleSendMessage();
        }
      }
    },
    [status, handleSendMessage]
  );

  // OPTIMIZATION: Use onInput for immediate feedback in addition to onChange
  const handleInput = useCallback(() => {
    // Mark as typing in global state to prevent virtualization interference
    try {
      // @ts-expect-error - Setting custom property
      window.__crayIsTyping.current = true;
    } catch (err) {
      // Fail silently if property doesn't exist
    }
  }, []);

  return (
    <textarea
      ref={inputRef}
      className="w-full p-4 pr-20 rounded-t-xl resize-none focus:outline-none border-2 border-zinc-800/50 border-b-0 inset-shadow"
      placeholder={
        messagesLength === 0 ? "Start a conversation" : "Type your message..."
      }
      rows={4}
      value={input}
      onChange={handleInputChange}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      disabled={status === "streaming"}
    />
  );
});

MemoizedTextArea.displayName = "MemoizedTextArea";

// Optimize the main component with memo
export const ChatInput = memo(function ChatInput({
  inputRef,
  input,
  handleInputChange,
  handleSendMessage,
  status,
  chatError,
  currentProvider,
  currentModel,
  setCurrentProvider,
  setCurrentModel,
  messagesLength,
}: ChatInputProps) {
  return (
    <div className="bg-transparent fixed bottom-0 left-[20vw] right-0 p-4 pb-12 sidebar-offset">
      <div
        className={clsx(
          "max-w-3xl mx-auto space-y-3 w-full",
          messagesLength > 0 && "px-4"
        )}
      >
        {chatError && (
          <ChatErrorDisplay error={chatError} provider={currentProvider} />
        )}

        <div className="flex items-end shadow-xl shadow-black/20 mx-auto">
          <div className="flex-1 relative shadow-2xl shadow-black">
            <MemoizedTextArea
              inputRef={inputRef}
              input={input}
              handleInputChange={handleInputChange}
              handleSendMessage={handleSendMessage}
              status={status}
              messagesLength={messagesLength}
            />
          </div>
        </div>

        <ModelSelector
          currentProvider={currentProvider}
          currentModel={currentModel}
          setCurrentProvider={setCurrentProvider}
          setCurrentModel={setCurrentModel}
          status={status}
          input={input}
          handleSendMessage={handleSendMessage}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
});
