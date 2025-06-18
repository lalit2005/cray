import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  createdAt: string;
  provider: string;
  model: string;
}

export interface User {
  userId: string;
  name: string;
  createdAt: string;
  passwordHash: string;
  email: string;
  chatsUpdatedAt: string;
}

export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").notNull(),
  chatsUpdatedAt: timestamp("chats_updated_at", {
    mode: "string",
  }).defaultNow(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  userId: uuid("user_id").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  inTrash: boolean("in_trash").default(false),
  isPinned: boolean("is_pinned").default(false),
  messages: jsonb("messages").$type<Message[]>().default([]),
  // isDiscardedDueToConflict: boolean("is_discarded_due_to_conflict").default(
  //   false
  // ),
  // actualIdForDiscardedDueToConflict: uuid(
  //   "actual_id_for_discarded_due_to_conflict"
  // ).defaultRandom(),
});

export const schema = {
  users,
  chats,
};

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;

export default schema;
