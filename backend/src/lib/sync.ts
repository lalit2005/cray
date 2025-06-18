import { Context } from "hono";
import { Message } from "./sync-interface";
import { chats } from "../schema";
import { eq, gte, and, inArray, desc } from "drizzle-orm";
import { SyncRequest, SyncResponse } from "./sync-interface";
import { createDbClient } from "../db";

// - then client asks a new route `/fetch-new-records` and sends `lastSyncedAt`
// - server fetches those records which were updated or created after `lastSyncedAt` and sends them to client
// - client upserts those records to indexeddb and updates `lastSyncedAt`

// - each user record in backend postgres has an updatedAt column which says when was the last update done to his chats and messages
// - client stores a `lastSyncedAt` in keyval table
// - while syncing, the client sends those records from indexeddb which were updated or created after `lastSyncedAt`
// - the client sends `lastSyncedAt`, array of those ids, and those corresponding records to the server
// - the server on receiving them, fetches those records whose id is in the array and also those which were updated or created after `lastSyncedAt`
// - for each of those fetched arrays, server sees which chat record was updated or created recently and sends them to the client
// - the client upserts those records in the indexeddb with dexie using the `put` method and updates `lastSyncedAt`

export const sync = async (c: Context) => {
  const db: ReturnType<typeof createDbClient>["db"] = c.var.db;
  const user = c.get("user");

  const body: SyncRequest = await c.req.json();
  const { updatedChats } = body;

  // Key updated chats by id for quick lookup
  const clientChatsById = new Map(updatedChats.map((chat) => [chat.id, chat]));
  const ids = Array.from(clientChatsById.keys());

  // Fetch corresponding chats that already exist on the server
  const existingServerChats = ids.length
    ? await db
        .select()
        .from(chats)
        .where(and(eq(chats.userId, user.userId), inArray(chats.id, ids)))
    : [];

  const normalizeDate = (d: string | Date): string =>
    typeof d === "string" ? d : (d as Date).toISOString();

  const serverChanges: SyncResponse = {
    serverChanges: [],
  };

  // Helper to convert a DB row -> API response Chat shape
  const toChatResponse = (record: (typeof existingServerChats)[number]) => ({
    ...record,
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
    inTrash: !!record.inTrash,
    isPinned: !!record.isPinned,
    tags: record.tags || [],
    notes: record.notes || "",
    userId: record.userId || "",
    title: record.title || "",
    messages: (record.messages as Message[]).map((m) => ({
      ...m,
      createdAt: m.createdAt,
    })),
  });

  const mutatedChatIds = new Set<string>();

  // 1. Handle records that already exist on the server
  for (const serverChat of existingServerChats) {
    const clientChat = clientChatsById.get(serverChat.id);
    if (!clientChat) continue; // should not happen

    const clientUpdatedAt = new Date(clientChat.updatedAt).getTime();
    const serverUpdatedAt = new Date(serverChat.updatedAt || 0).getTime();

    const serverMessages = serverChat.messages as Message[];
    const clientHasMoreMsgs =
      clientChat.messages.length > serverMessages.length;

    if (clientUpdatedAt > serverUpdatedAt || clientHasMoreMsgs) {
      // Client is newer – update server copy
      await db
        .update(chats)
        .set({
          title: clientChat.title,
          updatedAt: clientChat.updatedAt,
          tags: clientChat.tags,
          notes: clientChat.notes,
          inTrash: clientChat.inTrash ?? false,
          isPinned: clientChat.isPinned ?? false,
          messages: clientChat.messages.map((m) => ({
            ...m,
            createdAt: normalizeDate(m.createdAt),
          })) as Message[],
        })
        .where(and(eq(chats.id, serverChat.id), eq(chats.userId, user.userId)));
      mutatedChatIds.add(serverChat.id);
    } else if (serverUpdatedAt > clientUpdatedAt) {
      // Server is newer – send back to client
      serverChanges.serverChanges.push(toChatResponse(serverChat));
    }

    // Remove processed id from the map so that remaining are new chats
    clientChatsById.delete(serverChat.id);
  }

  // 2. Insert new chats that didn't exist on the server
  for (const newChat of clientChatsById.values()) {
    await db.insert(chats).values({
      id: newChat.id,
      userId: user.userId,
      title: newChat.title,
      createdAt: newChat.createdAt,
      updatedAt: newChat.updatedAt,
      tags: newChat.tags,
      notes: newChat.notes,
      inTrash: newChat.inTrash ?? false,
      isPinned: newChat.isPinned ?? false,
      messages: newChat.messages.map((m) => ({
        ...m,
        createdAt: normalizeDate(m.createdAt),
      })) as Message[],
    });
    mutatedChatIds.add(newChat.id);
  }

  // Fetch authoritative versions for all chats that were mutated (inserted/updated) so client can store server timestamps & echoes.
  if (mutatedChatIds.size) {
    const updatedRows = await db
      .select()
      .from(chats)
      .where(
        and(
          eq(chats.userId, user.userId),
          inArray(chats.id, Array.from(mutatedChatIds))
        )
      );

    updatedRows.forEach((r) =>
      serverChanges.serverChanges.push(toChatResponse(r))
    );
  }

  return c.json(serverChanges);
};
