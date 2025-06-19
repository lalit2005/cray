import { useEffect, useRef } from "react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
