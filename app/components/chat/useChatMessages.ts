import { useEffect, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "~/localdb";
import { Message } from "./types";

export function useChatMessages(chatId: string | null) {
  // Get messages for the current chat
  const messages = useLiveQuery(
    () =>
      chatId
        ? db.messages.where("chatId").equals(chatId).sortBy("createdAt")
        : [],
    [chatId],
    []
  ) as Message[];

  const isLoading = messages === undefined;
  const messagesEndRef = useRef<HTMLDivElement>(null); // Simple reference to track message count for scroll optimization
  const lastMessageCountRef = useRef<number>(0);

  // Simplified scroll to bottom that skips during typing
  const scrollToBottom = useCallback(() => {
    // Skip scrolling during typing to prevent layout thrashing
    try {
      // @ts-expect-error - Accessing custom property from window
      const isTyping = window.__crayIsTyping?.current === true;
      if (isTyping) {
        return; // Don't scroll while typing
      }
    } catch (e) {
      // Continue if property access fails
    }

    // Perform smooth scroll
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Simplified scroll logic to prevent scrolling during typing
  useEffect(() => {
    // Skip this effect if we don't have any messages yet
    if (!messages.length) return;

    // Check if a new message was added
    const newMessageAdded = messages.length > lastMessageCountRef.current;

    // Check if this is an assistant message or a loading message
    const hasNewAssistantMessage =
      messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant";

    const isLoading = messages.some((m) => m.loading);

    // Determine if we need to scroll
    if (newMessageAdded || hasNewAssistantMessage || isLoading) {
      // Just call our simplified scrollToBottom which already checks for typing
      scrollToBottom();
    }

    // Always update our reference count
    lastMessageCountRef.current = messages.length;
  }, [messages, scrollToBottom]);

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
              // 5 minutes old - Delete very old loading messages
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

        // Also check if we have completed messages followed by loading messages
        // This fixes the case where a loading "Generating..." message is left after a valid response
        const allAssistantMessages = await db.messages
          .where({ chatId, role: "assistant" })
          .sortBy("createdAt");

        if (allAssistantMessages.length > 1) {
          // Check if we have non-loading messages (with content) followed by loading ones
          const hasCompletedMessages = allAssistantMessages.some(
            (m) => !m.loading && m.content.trim()
          );

          if (hasCompletedMessages) {
            // Find any loading messages that need to be cleaned up
            const loadingMessagesToDelete = allAssistantMessages
              .filter((m) => m.loading)
              .map((m) => m.id);

            if (loadingMessagesToDelete.length > 0) {
              console.log(
                `Found ${loadingMessagesToDelete.length} loading messages to clean up after completed messages`
              );
              await db.messages.bulkDelete(loadingMessagesToDelete);
            }
          }
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

  return {
    messages,
    isLoading,
    messagesEndRef,
  };
}
