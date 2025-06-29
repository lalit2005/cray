import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { getApiKey } from "~/lib/apiKeys";
import { db } from "~/localdb";
import axios, { API_BASE_URL } from "~/lib/axios";
import { LLMProvider, Message } from "./types";
import toast from "react-hot-toast";
import { useNavigate } from "@remix-run/react";
import { useAuth } from "~/lib/auth";

// LocalStorage keys for model selection
const MODEL_PROVIDER_KEY = "cray-model-provider";
const MODEL_NAME_KEY = "cray-model-name";

export function useChatInteraction(chatId: string | null, messages: Message[]) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with values from localStorage or defaults
  const [currentProvider, setCurrentProvider] = useState<LLMProvider>(() => {
    const savedProvider =
      typeof window !== "undefined"
        ? (localStorage.getItem(MODEL_PROVIDER_KEY) as LLMProvider)
        : null;
    return savedProvider || "google";
  });

  const [currentModel, setCurrentModel] = useState<string>(() => {
    const savedModel =
      typeof window !== "undefined"
        ? localStorage.getItem(MODEL_NAME_KEY)
        : null;
    return savedModel || "gemini-2.5-flash-preview-04-17";
  });

  // Custom setters to persist to localStorage
  const setPersistedProvider = (provider: LLMProvider) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MODEL_PROVIDER_KEY, provider);
    }
    setCurrentProvider(provider);
  };

  const setPersistedModel = (model: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(MODEL_NAME_KEY, model);
    }
    setCurrentModel(model);
  };

  const { token } = useAuth();

  // Keep track of the assistant message ID that's currently being updated
  const currentAssistantMessageIdRef = useRef<string | null>(null);
  // Track completion status to avoid duplicate updates
  const completionFinishedRef = useRef<boolean>(false);
  // Track message content being generated
  const currentGeneratingContentRef = useRef<string>("");
  // Keep a ref to always have the latest chatId inside callbacks
  const chatIdRef = useRef<string | null>(chatId);

  // Update refs when chatId changes
  useEffect(() => {
    chatIdRef.current = chatId;
    // Reset completion status and generated content when chatId changes
    completionFinishedRef.current = false;
    currentGeneratingContentRef.current = "";

    // Clear assistant message ID when switching chats
    if (chatId !== null) {
      currentAssistantMessageIdRef.current = null;
    }
  }, [chatId]);

  // Set up message update interval to handle streaming
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
      Authorization: "Bearer " + token,
      Token: token!,
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

      // Immediately clean up any other loading messages for this chat
      try {
        const loadingMessages = await db.messages
          .where({ chatId: currentId, role: "assistant", loading: true })
          .toArray();

        if (loadingMessages.length > 0) {
          // If we're updating one of these, remove the others
          const msgsToDelete = loadingMessages
            .filter((m) => m.id !== currentAssistantMessageIdRef.current)
            .map((m) => m.id);

          if (msgsToDelete.length > 0) {
            await db.messages.bulkDelete(msgsToDelete);
            console.log(
              `Cleaned up ${msgsToDelete.length} loading messages on completion`
            );
          }
        }
      } catch (cleanupErr) {
        console.error("Error cleaning up loading messages:", cleanupErr);
      }

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

            // Force-remove loading state from all assistant messages for this chat
            // This ensures no "Generating..." message persists after completion
            await db.messages
              .where({ chatId: currentId, role: "assistant", loading: true })
              .modify({ loading: false });

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

        // Check if this is the first message of the chat and generate metadata
        const allMessages = await db.messages
          .where({ chatId: currentId })
          .toArray();

        // Count user messages to see if this was the first user message
        const userMessages = allMessages.filter((m) => m.role === "user");

        if (userMessages.length === 1) {
          // This was the first user message, generate metadata
          console.log("First message completed, generating metadata...");
          try {
            const firstUserMessage = userMessages[0];
            // Only use the first 250 characters for metadata generation
            const messageExcerpt = firstUserMessage.content.substring(0, 250);
            const response = await axios.post("metadata", {
              message: messageExcerpt,
              provider: currentProvider,
              model: currentModel,
              apiKey: getApiKey(currentProvider),
            });

            // Validate response data before processing
            if (
              response.data &&
              typeof response.data.title === "string" &&
              Array.isArray(response.data.tags)
            ) {
              // Additional processing to ensure tags are clean
              const processedTags = response.data.tags
                .filter((tag: unknown) => typeof tag === "string") // Ensure only strings
                .map((tag: string) =>
                  tag
                    .toLowerCase()
                    .replace(/[#@$%^&*()+=[\]{}|\\:";'<>?,./]/g, "") // Remove special characters
                    .replace(/\s+/g, " ") // Normalize whitespace
                    .trim()
                )
                .filter((tag: string) => tag.length > 0); // Remove empty tags

              // Ensure we have at least some tags
              if (processedTags.length === 0) {
                processedTags.push("conversation", "chat", "discussion");
              }

              // Update the chat with generated metadata
              await db.chats.update(currentId, {
                title: response.data.title,
                tags: processedTags,
                updatedAt: new Date(),
              });
              console.log("Metadata generated successfully:", {
                title: response.data.title,
                tags: processedTags,
              });
            } else {
              console.warn("Invalid metadata response format:", response.data);
            }
          } catch (metadataError) {
            console.error("Error generating metadata:", metadataError);
            // Provide fallback metadata if API fails
            try {
              const fallbackTitle =
                userMessages[0].content.length > 47
                  ? userMessages[0].content.substring(0, 47) + "..."
                  : userMessages[0].content;

              await db.chats.update(currentId, {
                title: fallbackTitle,
                tags: ["conversation", "chat", "discussion"],
                updatedAt: new Date(),
              });
              console.log("Applied fallback metadata");
            } catch (fallbackError) {
              console.error(
                "Failed to apply fallback metadata:",
                fallbackError
              );
            }
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

  // Set up keyboard shortcut to focus input field
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

  // Store a global reference to track typing state that can be accessed by other hooks
  const isTypingRef = useRef(false);

  // We'll use a separate ref to store the timeout ID to avoid TypeScript errors
  const typingTimeoutRef = useRef<number | null>(null);

  // Make the isTypingRef available on the window for access by useChatMessages
  useEffect(() => {
    // Make the typing state available globally using a cleanly typed approach
    Object.defineProperty(window, "__crayIsTyping", {
      value: isTypingRef,
      writable: true,
      configurable: true,
    });

    return () => {
      if ("__crayIsTyping" in window) {
        Object.defineProperty(window, "__crayIsTyping", {
          value: undefined,
          writable: true,
          configurable: true,
        });
      }
    };
  }, []);
  // Simplified input handler to track typing state and ensure responsive input
  const optimizedHandleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Set typing flag before processing input
      isTypingRef.current = true;

      // Process input change
      handleInputChange(e);

      // Reset typing flag after a short delay
      if (typingTimeoutRef.current !== null) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        isTypingRef.current = false;
        typingTimeoutRef.current = null;
      }, 500);
    },
    [handleInputChange]
  );

  return {
    input,
    handleInputChange: optimizedHandleInputChange,
    handleSendMessage,
    chatError,
    status,
    currentProvider,
    setCurrentProvider: setPersistedProvider,
    currentModel,
    setCurrentModel: setPersistedModel,
    inputRef,
  };
}
