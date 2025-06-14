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
}

// export interface KeyVal {
//   id: "latestLocalCommitSha" | "latestLocalCommitTime" | "localLastUpdatedTime";
//   value: string;
// }

export class AppDatabase extends Dexie {
  chats!: Table<Chats>;
  messages!: Table<Messages>;
  // keyvals!: Table<KeyVal>;

  constructor() {
    super("cray");
    this.version(1.0).stores({
      chats:
        "id, title, createdAt, updatedAt, *tags, *notes, inTrash, isPinned",
      messages: "id, chatId, role, content, createdAt",
      // keyvals: "id, value",
    });
  }
}

export const db = new AppDatabase();

// v1: initial version
