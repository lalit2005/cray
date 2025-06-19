import React from "react";
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

export const ChatInput: React.FC<ChatInputProps> = ({
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
}) => {
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
            <textarea
              ref={inputRef}
              className="w-full p-4 pr-20 rounded-t-xl resize-none focus:outline-none border-2 border-zinc-800/50 border-b-0 inset-shadow"
              placeholder={
                messagesLength === 0
                  ? "Start a conversation"
                  : "Type your message..."
              }
              rows={4}
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (status !== "streaming") {
                    handleSendMessage();
                  }
                }
              }}
              disabled={status === "streaming"}
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
};
