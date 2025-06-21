import { useSearchParams, useNavigate } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Lock, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import axios from "~/lib/axios";
import { Button } from "~/components/ui/Button";
import clsx from "clsx";

// Types for shared chat data from API
type ChatMessage = {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
};

type SharedChat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  messages: ChatMessage[];
};

export default function ShareRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const chatId = searchParams.get("id");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State for chat data and loading state
  const [chatData, setChatData] = useState<SharedChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shared chat data from API
  useEffect(() => {
    async function fetchSharedChat() {
      if (!chatId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await axios.get(`/shared-chat/${chatId}`);

        if (response.data && response.data.chat) {
          setChatData(response.data.chat);
          setMessages(
            (response.data.messages as ChatMessage[]).sort((a, b) => {
              return (
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
              );
            }) || []
          );
        } else {
          setError("Invalid response format from server");
        }
      } catch (err: unknown) {
        const error = err as {
          response?: { status?: number; data?: { error?: string } };
          message?: string;
        };
        if (error.response?.status === 404) {
          setError("Chat not found or is not public");
        } else {
          setError(
            "Error loading shared chat: " +
              (error.response?.data?.error || error.message || "Unknown error")
          );
        }
        console.error("Error fetching shared chat:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSharedChat();
  }, [chatId]);

  // If no chatId provided
  if (!chatId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-300">
        <Lock size={48} className="mb-4 text-zinc-500" />
        <h1 className="text-2xl font-bold mb-2">No Chat Specified</h1>
        <p className="mb-6 text-zinc-400 text-center max-w-md">
          Please provide a valid chat ID to view a shared conversation.
        </p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  // If chat is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950">
        <div className="text-center text-zinc-500">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto mb-2" />
          <p>Loading chat...</p>
        </div>
      </div>
    );
  }

  // If there was an error or chat isn't public
  if (error || !chatData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-300">
        <Lock className="mb-4 text-zinc-500 h-52 w-52" />
        <h1 className="text-2xl font-bold mb-2">Private Chat</h1>
        <p className="mb-6 text-zinc-400 text-center max-w-md">
          {error ||
            "This chat is private or does not exist. Ask the owner to make it public."}
        </p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 py-3 px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            className="p-2 bg-transparent hover:bg-zinc-800"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-zinc-100 font-medium">
            Shared Chat: {chatData.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <User size={16} />
          <span>{chatData.createdBy || "Anonymous User"}</span>
        </div>
      </header>

      {/* Chat Content */}
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-7xl mx-auto w-full space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-zinc-500">This shared chat has no messages.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={clsx(
                    "p-4 max-w-[85%] lg:max-w-2xl rounded",
                    message.role === "user"
                      ? "bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 shadow-inset"
                      : "bg-zinc-950 border-2 border-zinc-900 bg-gradient-to-br from-zinc-900 via-zinc-800/30 to-zinc-900"
                  )}
                >
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
                          <tbody
                            className="divide-y divide-zinc-700"
                            {...props}
                          />
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
                          <td
                            className="px-4 py-2 text-sm text-zinc-300"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  <div className="mt-2 text-xs opacity-70 flex justify-between items-center">
                    <span className="capitalize mr-1">
                      {message.role === "assistant"
                        ? message.provider || "Assistant"
                        : "User"}
                    </span>
                    <span className="ml-1">
                      {new Date(message.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 p-4 text-center text-zinc-500 text-sm">
        <p>
          This is a shared conversation. You are viewing it in read-only mode.
        </p>
      </footer>
    </div>
  );
}
