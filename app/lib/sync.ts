import api from "./axios";
import { db, KeyVal, Messages } from "../localdb";
import { SyncRequest, SyncResponse, Message, Chat } from "./sync-interface";

// Helper to update sync status in localStorage
const setSyncStatus = (
  status: "SYNCING" | "SYNCED" | "ERROR",
  error?: string
) => {
  localStorage.setItem("syncStatus", status);
  if (error) {
    console.error("Sync error:", error);
    localStorage.setItem("syncError", error);
  } else {
    localStorage.removeItem("syncError");
  }

  // Create a custom event so components can react to sync status changes
  window.dispatchEvent(
    new CustomEvent("syncStatusChange", {
      detail: { status, error },
    })
  );
};

// Convert a server/network message to a local database message
const convertToLocalMessage = (m: Message, chatId: string): Messages => ({
  id: m.id,
  chatId: chatId,
  role: m.role,
  content: m.content || "", // Ensure content is never null/undefined
  createdAt:
    typeof m.createdAt === "string"
      ? new Date(m.createdAt)
      : (m.createdAt as unknown as Date),
  provider: m.provider,
  model: m.model,
  loading: false, // Messages from server are never in loading state
});

const saveChatWithMessages = async (chat: Chat) => {
  try {
    console.log(
      `Saving chat: ${chat.id} with ${chat.messages?.length || 0} messages`
    );

    // Use a transaction to ensure all operations succeed or fail together
    await db.transaction("rw", [db.chats, db.messages], async () => {
      // 1. Save the chat record
      await db.chats.put({
        id: chat.id,
        title: chat.title,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
        inTrash: chat.inTrash ? 1 : 0,
        isPinned: chat.isPinned ? 1 : 0,
        tags: chat.tags || [],
        notes: chat.notes || "",
        messages: [], // We don't store messages in the chat record in IndexedDB, they're in a separate table
      });

      // 2. Find existing non-loading messages
      const existingMessages = await db.messages
        .where("chatId")
        .equals(chat.id)
        .filter((m) => !m.loading)
        .toArray();

      // 3. Prepare messages and filter out any empties
      const localMessages: Messages[] = [];
      if (chat.messages && chat.messages.length > 0) {
        chat.messages
          .filter((m) => m.content?.trim() !== "") // Skip empty messages
          .forEach((m) => {
            localMessages.push(convertToLocalMessage(m, chat.id));
          });
      }

      // 4. Delete existing messages that are in the incoming set
      // (but preserve any loading messages that aren't in the incoming set)
      const incomingIds = new Set(localMessages.map((m) => m.id));
      const messagesToDelete = existingMessages
        .filter((m) => incomingIds.has(m.id))
        .map((m) => m.id);

      if (messagesToDelete.length > 0) {
        await db.messages.bulkDelete(messagesToDelete);
      }

      // 5. Save the new messages
      if (localMessages.length > 0) {
        await db.messages.bulkPut(localMessages);
        console.log(
          `Saved ${localMessages.length} messages for chat ${chat.id}`
        );
      }
    });
  } catch (error) {
    console.error(`Error saving chat ${chat.id}:`, error);
    throw error;
  }
};

export const syncAllData = async () => {
  try {
    setSyncStatus("SYNCING");

    // 1. Get last sync time
    const kv: KeyVal | undefined = await db.keyvals.get("lastSyncedAt");
    const lastSyncedAt = kv?.value
      ? new Date(kv.value)
      : new Date(new Date().getTime() - 60 * 60 * 1000);

    console.log(
      `Starting sync. Last sync was at: ${lastSyncedAt.toISOString()}`
    );

    // 2. Fetch new chats from server
    console.log(`Fetching new chats since ${lastSyncedAt.toISOString()}`);
    const { data: newChats } = await api.post<SyncResponse>(
      "/fetch-new-records",
      {
        lastSyncedAt: lastSyncedAt.toISOString(),
      }
    );

    // 3. Save new chats from server
    console.log(
      `Received ${newChats.serverChanges.length} new chats from server`
    );
    for (const chat of newChats.serverChanges) {
      await saveChatWithMessages(chat);
    }

    // 4. Get local changes to push to server
    const localChanges = await db.chats
      .where("updatedAt")
      .above(lastSyncedAt)
      .toArray();

    console.log(`Found ${localChanges.length} locally changed chats to sync`);

    // 5. For each chat, load all its messages
    const fullLocalChanges: Chat[] = await Promise.all(
      localChanges.map(async (chat): Promise<Chat> => {
        // 1. Load all non-loading messages for this chat from IndexedDB
        // Exclude messages in loading state as they should not be synced to server
        const messages = await db.messages
          .where("chatId")
          .equals(chat.id)
          .filter((msg) => !msg.loading) // Filter out loading messages
          .toArray();

        // 2. Convert local `Messages` (with Date fields) to network `Message` (with ISO string fields)
        const convertedMessages: Message[] = messages
          .filter((m) => m.content?.trim() !== "") // Don't sync empty messages
          .map(
            (m): Message => ({
              id: m.id,
              chatId: m.chatId,
              role: m.role,
              content: m.content || "", // Ensure content is never null/undefined
              createdAt:
                m.createdAt instanceof Date
                  ? m.createdAt.toISOString()
                  : new Date(m.createdAt).toISOString(),
              provider: m.provider,
              model: m.model,
            })
          );

        // 3. Build a proper `Chat` object for the sync request (avoid spreading typed Dexie entity)
        const convertedChat: Chat = {
          id: chat.id,
          title: chat.title,
          userId: "", // server will fill this in based on the auth token
          createdAt:
            chat.createdAt instanceof Date
              ? chat.createdAt.toISOString()
              : new Date(chat.createdAt).toISOString(),
          updatedAt:
            chat.updatedAt instanceof Date
              ? chat.updatedAt.toISOString()
              : new Date(chat.updatedAt).toISOString(),
          inTrash: !!chat.inTrash,
          isPinned: !!chat.isPinned,
          tags: chat.tags,
          notes: chat.notes,
          messages: convertedMessages,
        };

        return convertedChat;
      })
    );

    // 6. Prepare payload for server
    const payload: SyncRequest = {
      lastSyncedAt: lastSyncedAt.toISOString(),
      updatedChats: fullLocalChanges,
      // ids are sorted in descending order of updatedAt
      ids: fullLocalChanges
        .sort((a, b) => {
          const dateA = new Date(a.updatedAt).getTime();
          const dateB = new Date(b.updatedAt).getTime();
          return dateB - dateA;
        })
        .map((c) => c.id),
    };

    // 7. Send changes to server and get back any server changes
    console.log(`Sending ${payload.updatedChats.length} chats to server`);

    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------
    // ---------------------------------------------------------------------

    const response = await api.post("/sync", payload);
    const resp: SyncResponse = response.data;

    // 8. Process server changes
    console.log(
      `Received ${resp.serverChanges.length} chat updates from server sync`
    );
    for (const chat of resp.serverChanges) {
      await saveChatWithMessages(chat);
    } // 9. Clean up any empty or corrupted messages before finalizing sync
    await db.transaction("rw", db.messages, async () => {
      const emptyMessages = await db.messages
        .filter(
          (m) =>
            m.content === null ||
            m.content === undefined ||
            m.content.trim() === ""
        )
        .toArray();

      if (emptyMessages.length > 0) {
        console.log(`Found ${emptyMessages.length} empty messages to clean up`);

        // Filter loading messages (they're allowed to be empty)
        const emptyNonLoadingMessages = emptyMessages.filter((m) => !m.loading);

        if (emptyNonLoadingMessages.length > 0) {
          console.log(
            `Removing ${emptyNonLoadingMessages.length} empty non-loading messages`
          );
          await db.messages.bulkDelete(
            emptyNonLoadingMessages.map((m) => m.id)
          );
        }
      }
    });

    // 10. Update last sync time
    await db.keyvals.put({
      id: "lastSyncedAt",
      value: new Date().toISOString(),
    });

    setSyncStatus("SYNCED");
    console.log("Sync completed successfully");

    // Return a summary of what was synced
    return {
      fetchedChats: newChats.serverChanges.length,
      sentChats: fullLocalChanges.length,
      receivedServerChanges: resp.serverChanges.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setSyncStatus("ERROR", errorMessage);
    console.error("Sync failed:", error);
    throw error;
  }
};
