/* eslint-disable @typescript-eslint/ban-ts-comment */
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
import { useEffect, useRef, useState } from "react";
import { db } from "~/localdb";
import { useSearchParams, useNavigate, useLocation } from "@remix-run/react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown } from "lucide-react";
import { getApiKey } from "~/lib/apiKeys";
import { SUPPORTED_MODELS as models } from "~/lib/models";
import { API_BASE_URL } from "~/lib/axios";
import toast from "react-hot-toast";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Keep track of the assistant message ID that's currently being updated
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  // Track completion status to avoid duplicate updates
  const completionFinishedRef = useRef<boolean>(false);
  // Track message content being generated
  const currentGeneratingContentRef = useRef<string>("");

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
  }, [location.pathname, navigate, searchParams]);

  const [currentProvider, setCurrentProvider] = useState<LLMProvider>("google");
  const [currentModel, setCurrentModel] = useState<string>(
    "gemini-2.5-flash-preview-04-17"
  );

  const chatId = searchParams.get("id");
  // Keep a ref to always have the latest chatId inside callbacks
  const chatIdRef = useRef<string | null>(chatId);
  const prevChatIdRef = useRef<string | null>(chatId);
  useEffect(() => {
    chatIdRef.current = chatId;
    // Reset completion status and generated content when chatId changes
    completionFinishedRef.current = false;
    currentGeneratingContentRef.current = "";
    // Clear assistant message ID only when switching between existing chats
    if (prevChatIdRef.current) {
      currentAssistantMessageIdRef.current = null;
    }
    prevChatIdRef.current = chatId;
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

  // Check for and clean up any stale loading messages when mounting or switching chats
  useEffect(() => {
    const cleanupLoadingMessages = async () => {
      if (chatId) {
        // Find any messages that are stuck in loading state
        const loadingMessages = await db.messages
          .where({ chatId, loading: true })
          .toArray();

        if (loadingMessages.length > 0) {
          console.log(
            `Found ${loadingMessages.length} stale loading messages to clean up`
          );

          // Either complete them or remove them depending on age
          for (const msg of loadingMessages) {
            const msgAge = Date.now() - msg.createdAt.getTime();

            if (msgAge > 5 * 60 * 1000) {
              // 5 minutes old
              // Delete very old loading messages
              await db.messages.delete(msg.id);
              console.log(`Deleted stale message ${msg.id}`);
            } else {
              // Mark as completed but empty
              await db.messages.update(msg.id, {
                loading: false,
                content: "[Message generation was interrupted]",
              });
              console.log(`Updated stale message ${msg.id}`);
            }
          }
        }

        // Clean up any empty assistant messages (likely partial duplicates)
        const emptyAssistantMessages = await db.messages
          .where({ chatId, role: "assistant" })
          .filter(
            (msg) => !msg.loading && (!msg.content || msg.content.trim() === "")
          )
          .toArray();

        if (emptyAssistantMessages.length > 0) {
          console.log(
            `Found ${emptyAssistantMessages.length} empty assistant messages to delete`
          );
          await db.messages.bulkDelete(emptyAssistantMessages.map((m) => m.id));
        }

        // Handle duplicate sequential messages - keep only the most recent one
        const allMessages = await db.messages
          .where({ chatId })
          .sortBy("createdAt");
        const messagesToDelete: string[] = [];

        // Check for consecutive assistant messages and keep only the most recent one
        for (let i = 0; i < allMessages.length - 1; i++) {
          if (
            allMessages[i].role === "assistant" &&
            allMessages[i + 1].role === "assistant" &&
            // Only consider messages that are close in time (within 10 seconds)
            Math.abs(
              allMessages[i + 1].createdAt.getTime() -
                allMessages[i].createdAt.getTime()
            ) < 10000
          ) {
            // Keep the most recent one (i+1) and mark the older one for deletion
            messagesToDelete.push(allMessages[i].id);
          }
        }

        if (messagesToDelete.length > 0) {
          console.log(
            `Removing ${messagesToDelete.length} duplicate sequential assistant messages`
          );
          await db.messages.bulkDelete(messagesToDelete);
        }
      }
    };

    cleanupLoadingMessages();
  }, [chatId]);

  // Setup message update interval to handle streaming
  useEffect(() => {
    const updateMessageInterval = setInterval(async () => {
      if (
        !currentAssistantMessageIdRef.current ||
        currentGeneratingContentRef.current === ""
      ) {
        return;
      }

      try {
        // Update the loading message with partial content
        await db.messages.update(currentAssistantMessageIdRef.current, {
          content: currentGeneratingContentRef.current,
        });
      } catch (error) {
        console.error("Error updating message during interval:", error);
      }
    }, 300); // Update every 300ms

    return () => clearInterval(updateMessageInterval);
  }, []);

  const {
    input,
    handleInputChange,
    handleSubmit,
    error: chatError,
    status,
    messages: aiMessages,
  } = useChat({
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
    onResponse: () => {
      console.log("Got initial response from API");
      // Reset the generating content when a new response starts
      currentGeneratingContentRef.current = "";
    },
    onFinish: async (msg) => {
      console.log("Message completed:", msg.id);
      const currentId = chatIdRef.current;
      if (!currentId) return;

      // Prevent handling the same completion multiple times
      if (completionFinishedRef.current) {
        console.log("Completion already finished, ignoring duplicate callback");
        return;
      }

      completionFinishedRef.current = true;

      try {
        // Get the assistant message ID that we're currently updating
        const assistantMessageId = currentAssistantMessageIdRef.current;

        if (assistantMessageId) {
          // Find the message in the database first to confirm it exists
          const assistantMsg = await db.messages.get(assistantMessageId);

          if (assistantMsg) {
            console.log(
              `Updating existing message ${assistantMessageId} with final content`
            );
            // Make sure we have content, either from tracking or from the completed message
            const finalContent =
              currentGeneratingContentRef.current || msg.content;

            // Update the existing message with the final content
            await db.messages.update(assistantMessageId, {
              content: finalContent,
              loading: false,
            });

            // Check for duplicate assistant messages that might have been created
            // This can happen with the first message in a new chat
            const allAssistantMessages = await db.messages
              .where({ chatId: currentId, role: "assistant" })
              .toArray();

            // If we have more than one assistant message and the most recent one isn't
            // the one we just updated, we likely have a duplicate
            if (allAssistantMessages.length > 1) {
              const sortedMessages = allAssistantMessages.sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
              );

              // If we have more than one message and the most recent doesn't match our ID
              if (sortedMessages[0].id !== assistantMessageId) {
                console.log("Found duplicate assistant message, cleaning up");
                // Delete the duplicate message (it would be a newly created one)
                await db.messages.delete(sortedMessages[0].id);
              }
            }
          } else {
            console.log(
              `Could not find message ${assistantMessageId}, adding new one`
            );
            // If we can't find the message (might have been deleted), add a new one
            await db.messages.add({
              id: msg.id || crypto.randomUUID(),
              chatId: currentId,
              role: "assistant",
              content: msg.content,
              createdAt: new Date(),
              provider: currentProvider,
              model: currentModel,
              loading: false,
            });
          }
        } else {
          // Fallback: look for any loading assistant message if we don't have an ID
          console.log("No tracked message ID, searching for loading messages");
          const loadingMessages = await db.messages
            .where({ chatId: currentId, role: "assistant", loading: true })
            .toArray();

          if (loadingMessages.length > 0) {
            // Update the most recent loading message
            const mostRecent = loadingMessages.sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
            )[0];

            console.log(
              `Updating most recent loading message ${mostRecent.id}`
            );
            await db.messages.update(mostRecent.id, {
              content: msg.content || currentGeneratingContentRef.current,
              loading: false,
            });

            // Clean up any other loading messages that might exist
            const otherLoadingMsgIds = loadingMessages
              .filter((m) => m.id !== mostRecent.id)
              .map((m) => m.id);

            if (otherLoadingMsgIds.length > 0) {
              console.log(
                `Cleaning up ${otherLoadingMsgIds.length} additional loading messages`
              );
              await db.messages.bulkDelete(otherLoadingMsgIds);
            }
          } else {
            // No loading messages found, create a new one
            console.log("No loading messages found, adding new message");
            await db.messages.add({
              id: msg.id || crypto.randomUUID(),
              chatId: currentId,
              role: "assistant",
              content: msg.content || currentGeneratingContentRef.current,
              createdAt: new Date(),
              provider: currentProvider,
              model: currentModel,
            });
          }
        }

        // Update chat's updatedAt timestamp
        await db.chats.update(currentId, {
          updatedAt: new Date(),
        });

        // Reset refs for the next message
        currentAssistantMessageIdRef.current = null;
        currentGeneratingContentRef.current = "";
      } catch (error) {
        console.error("Error updating message:", error);
        // Try a last-resort save approach
        try {
          const finalContent =
            currentGeneratingContentRef.current || msg.content;

          await db.messages.add({
            id: crypto.randomUUID(),
            chatId: currentId,
            role: "assistant",
            content: finalContent,
            createdAt: new Date(),
            provider: currentProvider,
            model: currentModel,
          });
          console.log("Added new message as fallback after error");
        } catch (fallbackError) {
          console.error("Fallback save also failed:", fallbackError);
        }
      }

      // Refocus the input field
      inputRef.current?.focus();
    },
    onError: (error) => {
      console.error("Error streaming text:", error);

      // Update the loading message to show the error
      const handleError = async () => {
        const currentId = chatIdRef.current;
        if (!currentId) return;

        const assistantMessageId = currentAssistantMessageIdRef.current;
        if (assistantMessageId) {
          await db.messages.update(assistantMessageId, {
            content: `Error: ${
              error.message || "An error occurred during message generation"
            }`,
            loading: false,
          });

          // Reset refs for the next message
          currentAssistantMessageIdRef.current = null;
          currentGeneratingContentRef.current = "";
        }

        // Reset for next attempt
        completionFinishedRef.current = false;
      };

      handleError();
    },
    initialMessages: messages,
  });

  // Track changes to AI messages for streaming content updates
  useEffect(() => {
    if (status === "streaming" && aiMessages.length > 0) {
      // Get the latest assistant message
      const lastMessage = [...aiMessages]
        .reverse()
        .find((msg) => msg.role === "assistant");

      if (lastMessage?.content) {
        // Only update if we have a current assistant message ID and the content has changed
        if (
          currentAssistantMessageIdRef.current &&
          currentGeneratingContentRef.current !== lastMessage.content
        ) {
          currentGeneratingContentRef.current = lastMessage.content;

          // Immediately update the database with the new content to reduce UI lag
          // This is in addition to the interval updates
          const updateMessageContent = async () => {
            try {
              await db.messages.update(currentAssistantMessageIdRef.current!, {
                content: currentGeneratingContentRef.current,
              });
            } catch (error) {
              console.error(
                "Error updating message during content change:",
                error
              );
            }
          };

          updateMessageContent();
        }
      }
    }
  }, [aiMessages, status]);

  const handleSendMessage = async () => {
    if (input.trim() === "") return;

    if (getApiKey(currentProvider) === "") {
      toast.error("API Key is not set for " + currentProvider);
      return;
    }

    // Reset completion status flag for new message
    completionFinishedRef.current = false;
    currentGeneratingContentRef.current = "";

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
        isPublic: 0, // Default to not public
        notes: "",
        messages: [],
      });
      navigate(`/?id=${currentChatId}`);
      // Update chatIdRef so onFinish callback can access the new ID
      chatIdRef.current = currentChatId;
    }

    try {
      // First, check if there are any existing loading messages we should clean up
      const existingLoadingMessages = await db.messages
        .where({ chatId: currentChatId, loading: true, role: "assistant" })
        .toArray();

      if (existingLoadingMessages.length > 0) {
        console.log(
          `Cleaning up ${existingLoadingMessages.length} stale loading messages before adding new one`
        );
        await db.messages.bulkDelete(existingLoadingMessages.map((m) => m.id));
      }

      // Store user message
      const userMessageId = crypto.randomUUID();
      await db.messages.add({
        id: userMessageId,
        chatId: currentChatId,
        role: "user",
        content: input,
        createdAt: new Date(),
        provider: currentProvider,
        model: currentModel,
      });

      // Create a single loading assistant message
      const assistantMessageId = crypto.randomUUID();
      currentAssistantMessageIdRef.current = assistantMessageId;

      await db.messages.add({
        id: assistantMessageId,
        chatId: currentChatId,
        role: "assistant",
        content: "", // Empty content initially
        createdAt: new Date(),
        provider: currentProvider,
        model: currentModel,
        loading: true,
      });

      // Update chat's updatedAt
      await db.chats.update(currentChatId, { updatedAt: new Date() });

      // Submit to assistant
      handleSubmit();
    } catch (error) {
      console.error("Error preparing message:", error);
      // Reset refs in case of error
      currentAssistantMessageIdRef.current = null;
      completionFinishedRef.current = false;
    }
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
    <div className="h-screen flex flex-col mx-auto">
      {/* Messages area */}
      <div
        className="flex-1 p-4 space-y-4 overflow-y-auto pb-60"
        ref={messagesContainerRef}
        id="chatWindow"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-zinc-500">
              <div className="animate-spin rounded h-8 w-8 border-t-2 border-zinc-500 mx-auto mb-2" />
              <p>Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-[80vw] text-center relative">
              <div className="absolute top-0 left-1/2 -translate-x-[50px] -translate-y-[50px]">
                <div className="w-32 h-16 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-10 absolute top-0"></div>
                <div className="w-28 h-14 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-20 absolute top-1"></div>
                <div className="w-24 h-12 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-30 absolute top-2"></div>
                <div className="w-20 h-10 border-t-2 border-l-2 border-r-2 rounded-t-full border-zinc-500 opacity-40 absolute top-3"></div>
              </div>
              <h2 className="text-2xl font-medium text-zinc-100 mb-3">
                C R A Y
              </h2>
              <p className="text-zinc-400 mb-6">
                Ask anything, get instant answers.
              </p>
            </div>
          </div>
        ) : (
          <div className={clsx("max-w-7xl mx-auto w-full space-y-4")}>
            {messages
              .filter((msg, idx, arr) => {
                // Remove any empty non-loading assistant messages (likely duplicates)
                if (
                  msg.role === "assistant" &&
                  !msg.loading &&
                  !msg.content.trim()
                ) {
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
              })
              .map((message: Message) => (
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
                    message.loading === true ? (
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
                          <span className="animate-pulse text-zinc-400">
                            Generating...
                          </span>
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
                    )}
                    <div className="mt-2 text-xs opacity-70 flex justify-between items-center">
                      <span className="capitalize mr-1">
                        {message.role === "assistant"
                          ? message.provider
                          : "You"}
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
      <div className="bg-transparent fixed bottom-0 left-[20vw] right-0 p-4 pb-12 sidebar-offset">
        <div
          className={clsx(
            "max-w-3xl mx-auto space-y-3 w-full",
            messages.length > 0 && "px-4"
          )}
        >
          {chatError && (
            <div className="text-red-500 text-sm p-4 bg-red-900/50 border border-red-800 rounded-lg mb-4">
              <div className="font-semibold mb-1">
                {
                  // @ts-ignore
                  (chatError as unknown)?.status === 401 ||
                  chatError.message?.includes("API key")
                    ? "API Key Required"
                    : "An Error Occurred"
                }
                <span className="capitalize ml-1">
                  {getApiKey(currentProvider)
                    ? ""
                    : " - No API Key Set for " + currentProvider}
                </span>
              </div>
              <div className="text-red-300">
                {/* @ts-ignore */}
                {(chatError as unknown)?.status === 401 ||
                chatError.message?.toLocaleLowerCase().includes("api key")
                  ? `Please set your ${currentProvider} API key in the settings to continue.`
                  : chatError.message ||
                    // @ts-ignore
                    (chatError as unknown as Error)?.error?.message ||
                    // @ts-ignore

                    (chatError as unknown as Error)?.data?.error ||
                    "Please try again."}
              </div>
              {/* @ts-ignore */}
              {(chatError as unknown as Error)?.status === 401 && (
                <button
                  onClick={() => {
                    // Assuming you have a settings route
                    navigate("/settings");
                  }}
                  className="mt-2 text-white bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm transition-colors"
                >
                  Go to Settings
                </button>
              )}
            </div>
          )}
          <div className="flex items-end shadow-xl shadow-black/20 mx-auto">
            <div className="flex-1 relative shadow-2xl shadow-black">
              <textarea
                // Using ref to focus instead of autoFocus to avoid accessibility warnings
                ref={inputRef}
                className={
                  "w-full p-4 pr-20 rounded-t-xl resize-none focus:outline-none border-2 border-zinc-800/50 border-b-0 inset-shadow"
                }
                placeholder={
                  messages.length === 0
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
                  {navigator.userAgent.includes("Mac") ? "CMD" : "Ctrl"} /
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
