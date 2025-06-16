import { Providers, SUPPORTED_MODELS } from "./models";

const STORAGE_KEY = "llm_api_keys";

const DEFAULT_KEYS = Object.keys(SUPPORTED_MODELS).reduce((acc, provider) => {
  acc[provider as Providers] = "";
  return acc;
}, {} as Record<Providers, string>);

export function getApiKeys(): Record<Providers, string> {
  if (typeof window === "undefined") return DEFAULT_KEYS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_KEYS, ...JSON.parse(stored) } : DEFAULT_KEYS;
  } catch {
    return DEFAULT_KEYS;
  }
}

export function getApiKey(provider: Providers): string | undefined {
  const keys = getApiKeys();
  return keys[provider];
}

export function setApiKey(provider: Providers, key: string): void {
  const keys = getApiKeys();
  keys[provider] = key;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}
