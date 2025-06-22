import React from "react";
import { Button } from "../ui/Button";
import { LLMProvider } from "./types";
import { ModelSearch } from "./ModelSearch";
import clsx from "clsx";

interface ModelSelectorProps {
  currentProvider: LLMProvider;
  currentModel: string;
  setCurrentProvider: (provider: LLMProvider) => void;
  setCurrentModel: (model: string) => void;
  status: string;
  input: string;
  handleSendMessage: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentProvider,
  currentModel,
  setCurrentProvider,
  setCurrentModel,
  status,
  input,
  handleSendMessage,
  inputRef,
}) => {
  const isStreaming = status === "streaming" || status === "submitted";

  const handleModelSelection = (provider: LLMProvider, model: string) => {
    setCurrentProvider(provider);
    setCurrentModel(model);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="disabled:opacity-50 disabled:cursor-wait w-full bg-gradient-to-b from-zinc-900 via-zinc-800/50 to-zinc-900 rounded-b-xl py-2 px-3 relative -top-5 inset-shadow border-2 border-zinc-800/50 backdrop-blur-xl">
      <div className="flex space-x-2">
        <Button
          onClick={handleSendMessage}
          className={clsx(
            "bg-opacity-100! relative overflow-hidden",
            isStreaming ? "opacity-80 cursor-not-allowed" : ""
          )}
          disabled={input.trim() === "" || isStreaming}
        >
          {isStreaming ? "Answering..." : "Send"}
        </Button>

        {/* Combined Model Selector with Search */}
        <ModelSearch
          currentProvider={currentProvider}
          currentModel={currentModel}
          onSelect={handleModelSelection}
        />

        {/* Keyboard shortcut hint */}
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-xs rounded bg-zinc-900 uppercase -mb-1">
            {navigator.userAgent.includes("Mac") ? "CMD" : "Ctrl"} /
          </kbd>
          <span className="text-xs text-zinc-500">to focus</span>
        </div>
      </div>
    </div>
  );
};
