import React from "react";
import { Message as MessageComponent } from "./Message";
import { Message } from "./types";
import clsx from "clsx";

interface MessageListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  messagesEndRef,
}) => {
  // Filter out any unnecessary messages
  const filteredMessages = messages.filter((msg, idx, arr) => {
    // Remove any empty non-loading assistant messages (likely duplicates)
    if (msg.role === "assistant" && !msg.loading && !msg.content.trim()) {
      return false;
    }
    // Remove duplicate consecutive loading assistant messages with no content
    if (
      msg.role === "assistant" &&
      msg.loading &&
      !msg.content.trim() &&
      idx > 0 &&
      arr[idx - 1].role === "assistant" &&
      arr[idx - 1].loading &&
      !arr[idx - 1].content.trim()
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className={clsx("max-w-7xl mx-auto w-full space-y-4")}>
      {filteredMessages.map((message) => (
        <MessageComponent key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
