import { Message as AISDKMessage } from "@ai-sdk/react";

export type LLMProvider =
  | "google"
  | "openai"
  | "anthropic"
  | "deepseek"
  | "perplexity";

export type Message = AISDKMessage & {
  id: string;
  chatId: string;
  createdAt: Date;
  provider: LLMProvider;
  model: string;
  loading?: boolean; // Indicates if this is a temporary/loading message
};
