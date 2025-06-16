import { Message as AISDKMessage, useChat } from "@ai-sdk/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/Dropdown";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import { Button } from "./ui/Button";
import { useEffect, useRef, useState } from "react";
import { db } from "~/localdb";
import { useSearchParams, useNavigate } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown } from "lucide-react";
import { getApiKey } from "~/lib/apiKeys";
import { SUPPORTED_MODELS as models } from "~/lib/models";

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
};

export const ChatWindow = () => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Redirect if neither ?new nor ?id is present
  useEffect(() => {
    if (!searchParams.has("new") && !searchParams.has("id")) {
      navigate("/?new");
    }
  }, [searchParams, navigate]);

  const [currentProvider, setCurrentProvider] = useState<LLMProvider>("google");
  const [currentModel, setCurrentModel] = useState<string>(
    "gemini-2.5-flash-preview-04-17"
  );

  const chatId = searchParams.get("id");
  const messages = useLiveQuery(
    () =>
      chatId
        ? db.messages.where("chatId").equals(chatId).sortBy("createdAt")
        : [],
    [chatId],
    []
  ) as Message[];

  const isLoading = messages === undefined;

  useEffect(() => {
    const newParam = searchParams.get("new");
    if (newParam) {
      // Clear messages by removing chatId from URL
      navigate("/?new");
      inputRef.current?.focus();
    }
  }, [searchParams]);

  const { input, handleInputChange, handleSubmit, error, status } = useChat({
    api: "http://localhost:8787/chat",
    body: {
      provider: currentProvider,
      model: currentModel,
      apiKey: getApiKey(currentProvider),
    },
    onFinish: (msg) => {
      console.log("msg", msg);
      if (!chatId) return;

      db.messages.add({
        id: msg.id,
        chatId,
        role: msg.role as Message["role"],
        content: msg.content,
        createdAt: new Date(),
        provider: currentProvider,
        model: currentModel,
      });

      inputRef.current?.focus();

      // Scroll to bottom
      const scrollToBottom = () => {
        console.log("Attempting to scroll...");
        if (!messagesContainerRef.current) {
          console.log("No container ref");
          return;
        }

        const { scrollHeight, clientHeight } = messagesContainerRef.current;
        console.log(
          `ScrollHeight: ${scrollHeight}, ClientHeight: ${clientHeight}`
        );

        // Add small offset to ensure scrolling works
        messagesContainerRef.current.scrollTo({
          top: scrollHeight - clientHeight + 1,
          behavior: "smooth",
        });
      };

      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    },
    initialMessages: messages,
  });

  useEffect(() => {
    // Scroll to bottom when messages change
    const scrollToBottom = () => {
      console.log("Attempting to scroll...");
      if (!messagesContainerRef.current) {
        console.log("No container ref");
        return;
      }

      const { scrollHeight, clientHeight } = messagesContainerRef.current;
      console.log(
        `ScrollHeight: ${scrollHeight}, ClientHeight: ${clientHeight}`
      );

      // Add small offset to ensure scrolling works
      messagesContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight + 1,
        behavior: "smooth",
      });
    };

    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        e.ctrlKey &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeydown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [inputRef]);

  const sendMessage = async () => {
    if (input.trim() === "") return;

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

    // Update chat's updatedAt
    await db.chats.update(currentChatId, { updatedAt: new Date() });

    // Submit to assistant
    handleSubmit();
  };

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
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  <div className="mt-2 text-xs opacity-70 flex justify-between items-center">
                    <span className="capitalize">
                      {message.role === "assistant" ? message.provider : "You"}
                    </span>
                    <span>
                      {new Date(
                        message.createdAt || Date.now()
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
                className="w-full p-4 pr-20 rounded-t-xl resize-none focus:outline-none border-2 border-zinc-800/50 border-b-0 inset-shadow"
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
                    sendMessage();
                  }
                }}
                ref={inputRef}
              />
            </div>
          </div>
          {/* Model Selector Dropdown */}
          <div className="disabled:opacity-50 disabled:cursor-wait w-full bg-gradient-to-b from-zinc-900 via-zinc-800/50 to-zinc-900 rounded-b-xl py-2 px-3 relative -top-5 inset-shadow border-2 border-zinc-800/50 backdrop-blur-xl">
            <div className="flex space-x-2">
              <Button
                onClick={sendMessage}
                className="bg-opacity-100!"
                disabled={status === "streaming"}
              >
                Send
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
                        onClick={() =>
                          setCurrentProvider(provider as LLMProvider)
                        }
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
                    {models[currentProvider].map((model) => (
                      <DropdownMenuItem
                        key={model}
                        onClick={() => setCurrentModel(model)}
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
