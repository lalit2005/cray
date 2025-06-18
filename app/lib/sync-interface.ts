export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  createdAt: string;
  provider: string;
  model: string;
  loading?: boolean; // Added to match the local schema
}

export type Chat = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  tags?: string[];
  notes?: string;
  inTrash?: boolean;
  isPinned?: boolean;
  messages: Message[];
};

export interface SyncRequest {
  lastSyncedAt?: string | null;
  updatedChats: Array<Chat>;
  ids: Array<string>;
}

export interface SyncResponse {
  serverChanges: Array<Chat>;
}
