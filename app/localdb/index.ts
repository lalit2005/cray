import { Message } from "@ai-sdk/react";
import Dexie, { Table } from "dexie";

export interface Chats {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  inTrash: 0 | 1;
  isPinned: 0 | 1;
  messages: Messages[];
  notes: string;
}

export interface Messages {
  id: string;
  chatId: string;
  role: Message["role"];
  content: string;
  createdAt: Date;
  provider: string;
  model: string;
  loading?: boolean; // Added for tracking message generation status
}

export interface KeyVal {
  id: "lastSyncedAt";
  value: string; // ISO timestamp
}

export class AppDatabase extends Dexie {
  chats!: Table<Chats>;
  messages!: Table<Messages>;
  keyvals!: Table<KeyVal>;

  constructor() {
    super("cray");
    // database version 1: initial schema (no keyvals)
    this.version(1).stores({
      chats:
        "id, title, createdAt, updatedAt, *tags, *notes, inTrash, isPinned",
      messages: "id, chatId, role, content, createdAt, provider, model",
    });

    // database version 2: add keyvals store for metadata
    this.version(2).stores({
      chats:
        "id, title, createdAt, updatedAt, *tags, *notes, inTrash, isPinned",
      messages: "id, chatId, role, content, createdAt, provider, model",
      keyvals: "id, value",
    });

    // database version 3: add loading field to messages
    this.version(3).stores({
      chats:
        "id, title, createdAt, updatedAt, *tags, *notes, inTrash, isPinned",
      messages:
        "id, chatId, role, content, createdAt, provider, model, loading",
      keyvals: "id, value",
    });
  }
}

export const db = new AppDatabase();

// v1: initial version
