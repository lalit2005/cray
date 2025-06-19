import React from "react";
import { Message as MessageType } from "./types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import clsx from "clsx";
import toast from "react-hot-toast";

interface MessageProps {
  message: MessageType;
}

export const Message: React.FC<MessageProps> = ({ message }) => {
  return (
    <div
      key={message.id}
      className={clsx(
        "flex",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={clsx(
          "p-4 max-w-[85%] lg:max-w-2xl rounded msg relative group transition-all duration-200",
          message.role === "user"
            ? "bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 shadow-inset hover:from-zinc-800 hover:via-zinc-700 hover:to-zinc-800"
            : "bg-zinc-950 border-2 border-zinc-900 bg-gradient-to-br from-zinc-900 via-zinc-800/30 to-zinc-900"
        )}
      >
        {/* Message actions toolbar - visible on hover */}
        <div
          className={clsx(
            "absolute bottom-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-zinc-900 flex gap-1 rounded-full",
            message.role === "assistant" ? "-right-10" : "-left-10"
          )}
        >
          {/* Copy message button */}
          <button
            title="Copy message"
            aria-label="Copy message"
            onClick={() => {
              navigator.clipboard.writeText(message.content);
              toast.success("Message copied to clipboard");
            }}
            className="p-1 rounded text-zinc-400 hover:text-amber-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1Z" />
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3Zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3Z" />
            </svg>
          </button>
        </div>

        {/* Message content */}
        {message.role === "assistant" && message.loading === true ? (
          <div>
            {message.content ? (
              <div className="prose prose-invert max-w-none overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <span className="animate-pulse text-zinc-400">Generating...</span>
            )}
          </div>
        ) : (
          <div className="prose prose-invert max-w-none overflow-x-auto">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                table: ({ ...props }) => (
                  <div className="overflow-x-auto">
                    <table
                      className="min-w-full divide-y divide-zinc-700"
                      {...props}
                    />
                  </div>
                ),
                thead: ({ ...props }) => (
                  <thead className="bg-zinc-800" {...props} />
                ),
                tbody: ({ ...props }) => (
                  <tbody className="divide-y divide-zinc-700" {...props} />
                ),
                tr: ({ ...props }) => (
                  <tr className="hover:bg-zinc-800/50" {...props} />
                ),
                th: ({ ...props }) => (
                  <th
                    className="px-4 py-2 text-left text-sm font-semibold text-zinc-200"
                    {...props}
                  />
                ),
                td: ({ ...props }) => (
                  <td className="px-4 py-2 text-sm text-zinc-300" {...props} />
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Message metadata */}
        <div className="mt-2 text-xs opacity-70 flex justify-between items-center">
          <span className="capitalize mr-1">
            {message.role === "assistant" ? message.provider : "You"}
          </span>
          <span className="ml-1">
            {new Date(message.createdAt || Date.now()).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};
