export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "data";
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
}

export interface Chat {
  id: string;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  inTrash: boolean;
  isPinned: boolean;
  isPublic: boolean; // Added isPublic field
  tags: string[];
  notes: string;
  messages: Message[];
}

export interface SyncRequest {
  lastSyncedAt?: string;
  updatedChats: Chat[];
  ids?: string[];
}

export interface SyncResponse {
  serverChanges: Chat[];
}
