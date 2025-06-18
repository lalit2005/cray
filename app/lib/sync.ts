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
  provider: m.provider as string,
  model: m.model as string,
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
        isPublic: chat.isPublic ? 1 : 0, // Convert boolean to 0/1
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

// -----------------------------------------------------------------------------
// Bidirectional sync implementing the same algorithm as backend `sync.ts`.
// -----------------------------------------------------------------------------
// 1. Collect local chat changes since `lastSyncedAt`.
// 2. Send them together with `lastSyncedAt` + their ids to `/sync`.
// 3. Upsert serverChanges returned.
// 4. Persist new `lastSyncedAt` and broadcast status.

export const syncAllData = async () => {
  try {
    setSyncStatus("SYNCING");

    // 1. Figure out last sync timestamp
    const kv: KeyVal | undefined = await db.keyvals.get("lastSyncedAt");
    const lastSyncedAt = kv?.value ?? new Date(0).toISOString();
    const lastDate = new Date(lastSyncedAt);

    // 2a. Collect chats changed directly (updatedAt)
    const changedChatsRaw = await db.chats
      .filter((c) => new Date(c.updatedAt) > lastDate)
      .toArray();

    // 2b. Detect chats that have new messages even if chat.updatedAt wasn't bumped
    const recentMsgs = await db.messages
      .filter((m) => new Date(m.createdAt) > lastDate && !m.loading)
      .toArray();
    const chatIdsFromMsgs = new Set(recentMsgs.map((m) => m.chatId));

    // 2c. Ensure we include those chats as well
    for (const chatId of chatIdsFromMsgs) {
      if (!changedChatsRaw.some((c) => c.id === chatId)) {
        const chatEntity = await db.chats.get(chatId);
        if (chatEntity) {
          changedChatsRaw.push(chatEntity);
        }
      }
    }
    const changedChats = changedChatsRaw;

    // 3. Build payload chats
    const updatedChats: Chat[] = await Promise.all(
      changedChats.map(async (chat) => {
        const msgs = await db.messages
          .where("chatId")
          .equals(chat.id)
          .filter((m) => !m.loading && m.content.trim() !== "")
          .toArray();

        const messages: Message[] = msgs.map((m) => ({
          id: m.id,
          chatId: m.chatId,
          role: m.role,
          content: m.content,
          createdAt:
            m.createdAt instanceof Date
              ? m.createdAt.toISOString()
              : new Date(m.createdAt).toISOString(),
          provider: m.provider,
          model: m.model,
        }));

        return {
          id: chat.id,
          title: chat.title,
          userId: "",
          createdAt:
            chat.createdAt instanceof Date
              ? chat.createdAt.toISOString()
              : new Date(chat.createdAt).toISOString(),
          updatedAt: (() => {
            const baseDate =
              chat.updatedAt instanceof Date
                ? chat.updatedAt
                : new Date(chat.updatedAt);
            const latest = messages.length
              ? messages.reduce(
                  (acc, cur) =>
                    new Date(cur.createdAt).getTime() > acc.getTime()
                      ? new Date(cur.createdAt)
                      : acc,
                  baseDate
                )
              : baseDate;
            return latest.toISOString();
          })(),
          inTrash: !!chat.inTrash,
          isPinned: !!chat.isPinned,
          isPublic: !!chat.isPublic, // Convert 0/1 to boolean
          tags: chat.tags,
          notes: chat.notes,
          messages,
        } as Chat;
      })
    );

    const payload: SyncRequest = {
      lastSyncedAt,
      updatedChats,
      ids: updatedChats
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .map((c) => c.id),
    };

    // 4. Send to server
    const { data } = await api.post<SyncResponse>("/sync", payload);

    // 5. Upsert server changes locally
    for (const chat of data.serverChanges) {
      await saveChatWithMessages(chat);
    }

    // 6. Persist new lastSyncedAt
    await db.keyvals.put({
      id: "lastSyncedAt",
      value: new Date().toISOString(),
    });

    setSyncStatus("SYNCED");
    return {
      fetchedChats: updatedChats.length,
      receivedServerChanges: data.serverChanges.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setSyncStatus("ERROR", msg);
    console.error("Sync failed:", msg);
    throw err;
  }
};

// try {
//   setSyncStatus("SYNCING");

//   // --- 1. Determine last sync timestamp (defaults to epoch start)
//   const kv = await db.keyvals.get("lastSyncedAt");
//   const lastSyncedAt = kv?.value ?? new Date(0).toISOString();
//   const lastDate = new Date(lastSyncedAt);

//   // --- 2. Gather chats modified after last sync
//   const changedChats = await db.chats
//     .filter((c) => new Date(c.updatedAt) > lastDate)
//     .toArray();

//   // --- 3. Convert to network DTOs
//   const updatedChats: Chat[] = await Promise.all(
//     changedChats.map(async (chat) => {
//       const msgs = await db.messages
//         .where("chatId")
//         .equals(chat.id)
//         .filter((m) => !m.loading && m.content.trim() !== "")
//         .toArray();

//       const messages: Message[] = msgs.map((m) => ({
//         id: m.id,
//         chatId: m.chatId,
//         role: m.role,
//         content: m.content,
//         createdAt:
//           m.createdAt instanceof Date
//             ? m.createdAt.toISOString()
//             : new Date(m.createdAt).toISOString(),
//         provider: m.provider,
//         model: m.model,
//       }));

//       return {
//         id: chat.id,
//         title: chat.title,
//         userId: "", // resolved by server auth
//         createdAt:
//           chat.createdAt instanceof Date
//             ? chat.createdAt.toISOString()
//             : new Date(chat.createdAt).toISOString(),
//         updatedAt:
//           chat.updatedAt instanceof Date
//             ? chat.updatedAt.toISOString()
//             : new Date(chat.updatedAt).toISOString(),
//         inTrash: !!chat.inTrash,
//         isPinned: !!chat.isPinned,
//         tags: chat.tags,
//         notes: chat.notes,
//         messages,
//       } as Chat;
//     })
//   );

//   const payload: SyncRequest = {
//     lastSyncedAt,
//     updatedChats,
//     ids: updatedChats
//       .slice()
//       .sort(
//         (a, b) =>
//           new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
//       )
//       .map((c) => c.id),
//   };

//   // --- 4. Send to server
//   const { data } = await api.post<SyncResponse>("/sync", payload);

//   // --- 5. Upsert server changes locally
//   for (const chat of data.serverChanges) {
//     await saveChatWithMessages(chat);
//   }

//   // --- 6. Save new lastSyncedAt
//   await db.keyvals.put({ id: "lastSyncedAt", value: new Date().toISOString() });

//   setSyncStatus("SYNCED");
//   return {
//     sentChats: updatedChats.length,
//     receivedChats: data.serverChanges.length,
//   };
// } catch (err) {
//   const msg = err instanceof Error ? err.message : String(err);
//   setSyncStatus("ERROR", msg);
//   console.error("Sync failed:", msg);
//   throw err;
// }
