import { Message as AISDKMessage, useChat } from "@ai-sdk/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/Dropdown";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Button } from "./ui/Button";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "~/localdb";
import { useSearchParams, useNavigate, useLocation } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown } from "lucide-react";
import { getApiKey } from "~/lib/apiKeys";
import { SUPPORTED_MODELS as models } from "~/lib/models";
import api, { API_BASE_URL } from "~/lib/axios";

type LLMProvider =
  | "google"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "perplexity";

type Message = AISDKMessage & {
  id: string;
  chatId: string;
  createdAt: Date;
  provider: LLMProvider;
  model: string;
  loading?: boolean; // Indicates if this is a temporary/loading message
};

export const ChatWindow = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle initial load and URL state
  useEffect(() => {
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
  }, []); // Empty dependency array means this runs once on mount

  const [currentProvider, setCurrentProvider] = useState<LLMProvider>("google");
  const [currentModel, setCurrentModel] = useState<string>(
    "gemini-2.5-flash-preview-04-17"
  );

  const chatId = searchParams.get("id");
  // Keep a ref to always have the latest chatId inside callbacks
  const chatIdRef = useRef<string | null>(chatId);
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  const messages = useLiveQuery(
    () =>
      chatId
        ? db.messages.where("chatId").equals(chatId).sortBy("createdAt")
        : [],
    [chatId],
    []
  ) as Message[];
  const isLoading = messages === undefined;

  const { input, handleInputChange, handleSubmit, error, status } = useChat({
    id: chatId!,
    api: API_BASE_URL + "chat",
    body: {
      provider: currentProvider,
      model: currentModel,
      apiKey: getApiKey(currentProvider),
    },
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    sendExtraMessageFields: true,
    onFinish: async (msg) => {
      console.log("msg", msg);
      const currentId = chatIdRef.current;
      if (!currentId) return;

      // Find the empty assistant message and update it
      const assistantMsg = await db.messages
        .where({ chatId: currentId, role: "assistant", content: "" })
        .first();
      if (assistantMsg) {
        await db.messages.update(assistantMsg.id, {
          content: msg.content,
          loading: false,
        });
      } else {
        // fallback: just add the message
        await db.messages.add({
          id: msg.id,
          chatId: currentId,
          role: msg.role as Message["role"],
          content: msg.content,
          createdAt: new Date(),
          provider: currentProvider,
          model: currentModel,
        });
      }

      inputRef.current?.focus();
    },
    onError: (error) => {
      console.error("Error streaming text:", error);
    },
    initialMessages: messages,
  });

  const handleSendMessage = async () => {
    if (input.trim() === "") return;
    // If no existing chatId and not already in new mode, mark chat as new
    if (!chatId && !searchParams.has("new")) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("new", "true");
      navigate(`/?${newParams.toString()}`, { replace: true });
    }

    let currentChatId = chatId;
    if (!currentChatId) {
      // Create new chat
      currentChatId = crypto.randomUUID();
      await db.chats.add({
        id: currentChatId,
        title: input.substring(0, 30),
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        inTrash: 0,
        isPinned: 0,
        notes: "",
        messages: [],
      });
      navigate(`/?id=${currentChatId}`);
      // Update chatIdRef so onFinish callback can access the new ID
      chatIdRef.current = currentChatId;
    }

    // Store user message
    await db.messages.add({
      id: crypto.randomUUID(),
      chatId: currentChatId,
      role: "user",
      content: input,
      createdAt: new Date(),
      provider: currentProvider,
      model: currentModel,
    });

    // Add empty assistant message with loading flag
    const assistantMessageId = crypto.randomUUID();
    await db.messages.add({
      id: assistantMessageId,
      chatId: currentChatId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      provider: currentProvider,
      model: currentModel,
      loading: true,
    } as any);

    // Update chat's updatedAt
    await db.chats.update(currentChatId, { updatedAt: new Date() });

    // Submit to assistant
    handleSubmit();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return (
    <div className="h-screen relative">
      {/* Messages area */}
      <div
        className="flex-1 p-4 space-y-4 overflow-y-auto"
        ref={messagesContainerRef}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-zinc-500">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 mx-auto mb-2"></div>
              <p>Loading messages...</p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto w-full space-y-4 mb-52">
            {messages.map((message: Message) => (
              <div
                key={message.id}
                className={clsx(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={clsx(
                    "p-4 max-w-[85%] lg:max-w-2xl rounded msg",
                    message.role === "user"
                      ? "bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 shadow-inset"
                      : "bg-zinc-950 border-2 border-zinc-900 bg-gradient-to-br from-zinc-900 via-zinc-800/30 to-zinc-900"
                  )}
                >
                  {message.role === "assistant" &&
                  message.loading &&
                  !message.content ? (
                    <span className="animate-pulse text-zinc-400">
                      Generating...
                    </span>
                  ) : (
                    <div className="prose prose-invert max-w-none overflow-x-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={{
                          table: ({ node, ...props }) => (
                            <div className="overflow-x-auto">
                              <table
                                className="min-w-full divide-y divide-zinc-700"
                                {...props}
                              />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="bg-zinc-800" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody
                              className="divide-y divide-zinc-700"
                              {...props}
                            />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="hover:bg-zinc-800/50" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th
                              className="px-4 py-2 text-left text-sm font-semibold text-zinc-200"
                              {...props}
                            />
                          ),
                          td: ({ node, ...props }) => (
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
                  )}
                  <div className="mt-2 text-xs opacity-70 flex justify-between items-center">
                    <span className="capitalize mr-1">
                      {message.role === "assistant" ? message.provider : "You"}
                    </span>
                    <span className="ml-1">
                      {new Date(
                        message.createdAt || Date.now()
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className={clsx(
          "bg-transparent fixed bottom-0 left-0 right-0 p-4",
          messages.length == 0
            ? "flex items-center justify-center h-[calc(100vh-200px)]"
            : ""
        )}
        style={{
          width: "calc(100% - 16.666667%)" /* 2/12 cols for sidebar */,
          marginLeft: "auto",
        }}
      >
        <div
          className={clsx(
            "max-w-3xl mx-auto space-y-3 w-full",
            messages.length > 0 && "px-4"
          )}
        >
          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-900 rounded">
              {error.message}
            </div>
          )}

          <div className="flex items-end shadow-xl shadow-black/20">
            <div className="flex-1 relative shadow-2xl shadow-black">
              <textarea
                autoFocus
                className={
                  "w-full p-4 pr-20 rounded-t-xl resize-none focus:outline-none border-2 border-zinc-800/50 border-b-0 inset-shadow"
                }
                placeholder={
                  messages.length == 0
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
                ref={inputRef}
              />
            </div>
          </div>
          {/* Model Selector Dropdown */}
          <div className="disabled:opacity-50 disabled:cursor-wait w-full bg-gradient-to-b from-zinc-900 via-zinc-800/50 to-zinc-900 rounded-b-xl py-2 px-3 relative -top-5 inset-shadow border-2 border-zinc-800/50 backdrop-blur-xl">
            <div className="flex space-x-2">
              <Button
                onClick={handleSendMessage}
                className={clsx(
                  "bg-opacity-100! relative overflow-hidden",
                  status === "streaming" || status === "submitted"
                    ? "opacity-80 cursor-not-allowed"
                    : ""
                )}
                disabled={input.trim() === "" || status === "streaming"}
              >
                {status === "streaming" || status === "submitted"
                  ? "Answering..."
                  : "Send"}
              </Button>
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="">
                      {currentProvider}
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {Object.keys(models).map((provider) => (
                      <DropdownMenuItem
                        key={provider}
                        onClick={() => {
                          setCurrentProvider(provider as LLMProvider);
                          // Set the first model from the new provider
                          setCurrentModel(models[provider as LLMProvider][0]);
                        }}
                      >
                        {provider}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="">
                      {currentModel}
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {models[currentProvider as LLMProvider].map((model) => (
                      <DropdownMenuItem
                        key={model}
                        onClick={() => {
                          setCurrentModel(model);
                          setTimeout(() => inputRef.current?.focus(), 100);
                        }}
                      >
                        {model
                          .split("/")
                          .pop()
                          ?.split(":")[0]
                          .split("-")
                          .join(" ")}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 text-xs rounded bg-zinc-900 uppercase -mb-1">
                  {navigator.userAgent.includes("Mac") ? "⌘" : "Ctrl"} /
                </kbd>
                <span className="text-xs text-zinc-500">to focus</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
