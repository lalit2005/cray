import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LanguageModelV1 } from "ai";

export type Providers =
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "perplexity"
  | "openrouter";

export const SUPPORTED_MODELS = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1-nano", "gpt-3.5-turbo"],
  anthropic: [
    "claude-3-5-sonnet-20241022",
    "claude-3-7-sonnet-20250219",
    "claude-4-sonnet-20250514",
  ],
  google: [
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-pro-exp-03-25",
    "gemini-2.0-flash-lite",
  ],
  deepseek: ["deepseek-chat"],
  perplexity: ["sonar", "sonar-pro"],
  openrouter: [
    "openai/gpt-4.1-nano",
    "openai/gpt-4o-mini",
    "openai/gpt-3.5-turbo",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.5-pro-exp-03-25",
    "google/gemini-2.0-flash-exp:free",
    "x-ai/grok-3-beta",
    "x-ai/grok-3-mini-beta",
    "mistralai/devstral-small:free",
    "sarvamai/sarvam-m:free",
    "meta-llama/llama-3.3-8b-instruct:free",
  ],
};

export interface ChatRequest {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  provider: Providers;
  model: string;
  apiKey?: string;
}

export function getModel(p: {
  provider: Providers;
  modelId: string;
  apiKey?: string;
}): LanguageModelV1 {
  // Validate model support first
  if (!SUPPORTED_MODELS[p.provider].includes(p.modelId)) {
    throw new Error("Unsupported model");
  }

  switch (p.provider) {
    case "openai":
      return createOpenAI({ apiKey: p.apiKey })(p.modelId);
    case "anthropic":
      return createAnthropic({ apiKey: p.apiKey })(p.modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: p.apiKey })(p.modelId);
    case "deepseek":
      return createDeepSeek({ apiKey: p.apiKey })(p.modelId);
    case "perplexity":
      return createPerplexity({ apiKey: p.apiKey })(p.modelId);
    case "openrouter":
      return createOpenRouter({ apiKey: p.apiKey }).chat(p.modelId);
    default:
      throw new Error("Unsupported provider");
  }
}
