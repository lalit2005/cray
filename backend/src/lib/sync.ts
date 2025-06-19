import { Context } from "hono";
import { and, eq, gt, inArray, or } from "drizzle-orm";
import { chats } from "../schema";
import { createDbClient } from "../db";
import { SyncRequest, SyncResponse, Message, Chat } from "./sync-interface";

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

// Main bidirectional sync endpoint implementing the strategy outlined above.
// The algorithm is simple:
// 1.  Client sends `lastSyncedAt` + the chats changed since then.
// 2.  Server loads (a) those chats whose ids were sent **OR** (b) chats changed since `lastSyncedAt`.
// 3.  For overlapping ids we perform **latest-timestamp-wins** conflict resolution.
//     •  If client version is newer -> we upsert on the server and echo back the new server copy.
//     •  If server version is newer -> we send the server copy to the client untouched.
// 4.  For chats only present on client -> insert & echo back.
// 5.  For chats only present on server but newer than `lastSyncedAt` -> send to client.
// 6.  Response is a list of authoritative `serverChanges` for the client to upsert, plus nothing else.
export const sync = async (c: Context) => {
  const db: ReturnType<typeof createDbClient>["db"] = c.var.db;
  const user = c.get("user");

  const body: SyncRequest = await c.req.json();
  const { lastSyncedAt, updatedChats, ids } = body;
  console.log("Sync request:", {
    lastSyncedAt,
    updatedChatsCount: updatedChats.length,
    idsCount: ids?.length,
  });

  // --- Build quick lookup maps for the incoming (client) chats
  const clientChatsById = new Map(updatedChats.map((c) => [c.id, c]));
  const clientIds =
    ids && ids.length ? ids : Array.from(clientChatsById.keys());

  const lastSyncDateStr = lastSyncedAt ?? undefined;

  // --- Pull all server-side candidates in one go.
  // We're interested in any chat that the client sent us, OR any chat that's
  // been updated on the server since the client's last sync timestamp.
  const orConditions = [];
  if (clientIds.length > 0) {
    orConditions.push(inArray(chats.id, clientIds));
  }
  if (lastSyncDateStr) {
    orConditions.push(gt(chats.updatedAt, lastSyncDateStr));
  }

  const combinedServerChats: (typeof chats.$inferSelect)[] =
    orConditions.length > 0
      ? await db
          .select()
          .from(chats)
          .where(and(eq(chats.userId, user.userId), or(...orConditions)))
      : [];

  const normalizeDate = (d: string | Date): string =>
    typeof d === "string" ? d : (d as Date).toISOString();

  // --- Prepare response container
  const serverChanges: SyncResponse = { serverChanges: [] };

  // Helper to convert a DB row -> API response Chat shape (normalises dates & booleans)
  const toChatResponse = (record: typeof chats.$inferSelect) => ({
    ...record,
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
    inTrash: !!record.inTrash,
    isPinned: !!record.isPinned,
    isPublic: !!record.isPublic,
    tags: record.tags || [],
    notes: record.notes || "",
    userId: record.userId || "",
    title: record.title || "",
    messages: (record.messages as Message[]).map((m) => ({
      ...m,
      createdAt: m.createdAt,
    })),
  });

  const processedIds = new Set<string>();

  // --- Conflict resolution / upserts
  for (const serverChat of combinedServerChats) {
    const clientChat = clientChatsById.get(serverChat.id);

    if (!clientChat) {
      // This chat was not sent by client but is newer than lastSyncedAt – push to client
      serverChanges.serverChanges.push(toChatResponse(serverChat));
      continue;
    }

    // Use milliseconds for accurate comparison
    const clientUpdatedAt = new Date(clientChat.updatedAt).getTime();
    const serverUpdatedAt = new Date(serverChat.updatedAt || 0).getTime();

    if (clientUpdatedAt > serverUpdatedAt) {
      // Client is newer – update server copy
      // --- Client version wins -> update server
      await db
        .update(chats)
        .set({
          title: clientChat.title,
          // Store as Date object for DB timestamp column
          updatedAt: new Date().toISOString(),
          tags: clientChat.tags,
          notes: clientChat.notes,
          inTrash: clientChat.inTrash ?? false,
          isPinned: clientChat.isPinned ?? false,
          isPublic: clientChat.isPublic ?? false,
          messages: clientChat.messages.map((m) => ({
            ...m,
            createdAt: normalizeDate(m.createdAt),
          })) as Message[],
        })
        .where(and(eq(chats.id, serverChat.id), eq(chats.userId, user.userId)));

      // Push updated copy back to client
      const updatedRow = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, serverChat.id), eq(chats.userId, user.userId)));
      if (updatedRow[0])
        serverChanges.serverChanges.push(toChatResponse(updatedRow[0]));
    } else if (serverUpdatedAt > clientUpdatedAt) {
      // --- Server wins -> send to client
      serverChanges.serverChanges.push(toChatResponse(serverChat));
    }

    processedIds.add(serverChat.id);
    clientChatsById.delete(serverChat.id);
  }

  // --- Remaining client chats are new to server
  for (const newChat of clientChatsById.values()) {
    // Use Postgres UPSERT semantics to avoid duplicate-key errors if the chat
    // (accidentally) already exists on the server. If it does, we simply keep
    // the existing row and continue – it will be picked up below when we read
    // it back and echoed to the client.
    await db
      .insert(chats)
      .values({
        id: newChat.id,
        userId: user.userId,
        title: newChat.title,
        createdAt: newChat.createdAt,
        updatedAt: new Date().toISOString(),
        tags: newChat.tags,
        notes: newChat.notes,
        inTrash: newChat.inTrash ?? false,
        isPinned: newChat.isPinned ?? false,
        isPublic: newChat.isPublic ?? false,
        messages: newChat.messages.map((m) => ({
          ...m,
          createdAt: normalizeDate(m.createdAt),
        })) as Message[],
      })
      .onConflictDoNothing();
    processedIds.add(newChat.id);

    // Echo back the newly created chat
    const newServerChat = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, newChat.id), eq(chats.userId, user.userId)));
    if (newServerChat[0]) {
      serverChanges.serverChanges.push(toChatResponse(newServerChat[0]));
    }
  }

  // --- For any client inserts we already echoed back when inserting. For new server-only chats we already pushed above.

  return c.json(serverChanges);
};
