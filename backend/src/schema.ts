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
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  provider: string;
  model: string;
}

export interface User {
  userId: string;
  name: string;
  createdAt: Date;
  passwordHash: string;
  email: string;
}

export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").notNull(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  userId: uuid("user_id").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  tags: jsonb("tags").$type<string[]>(),
  notes: text("notes"),
  inTrash: boolean("in_trash").default(false),
  isPinned: boolean("is_pinned").default(false),
  messages: jsonb("messages").$type<Message[]>().default([]),
});

export const schema = {
  users,
  chats,
};

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;

export default schema;
