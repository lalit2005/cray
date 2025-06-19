import React from "react";
import { useNavigate } from "@remix-run/react";
import { getApiKey } from "~/lib/apiKeys";
import { LLMProvider } from "./types";

interface ChatErrorDisplayProps {
  error: Error;
  provider: LLMProvider;
}

export const ChatErrorDisplay: React.FC<ChatErrorDisplayProps> = ({
  error,
  provider,
}) => {
  const navigate = useNavigate();

  if (!error) return null;

  const isApiKeyError =
    // @ts-expect-error Status might be on the error object
    (error as unknown)?.status === 401 || error.message?.includes("API key");

  const apiKeySet = getApiKey(provider) !== "";

  return (
    <div className="text-red-500 text-sm p-4 bg-red-900/50 border border-red-800 rounded-lg mb-4">
      <div className="font-semibold mb-1">
        {isApiKeyError ? "API Key Required" : "An Error Occurred"}
        <span className="capitalize ml-1">
          {apiKeySet ? "" : " - No API Key Set for " + provider}
        </span>
      </div>
      <div className="text-red-300">
        {isApiKeyError
          ? `Please set your ${provider} API key in the settings to continue.`
          : error.message ||
            // @ts-expect-error Error might have non-standard properties
            (error as unknown as Error)?.error?.message ||
            // @ts-expect-error Error might have non-standard properties
            (error as unknown as Error)?.data?.error ||
            "Please try again."}
      </div>
      {isApiKeyError && (
        <button
          onClick={() => navigate("/settings")}
          className="mt-2 text-white bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm transition-colors"
        >
          Go to Settings
        </button>
      )}
    </div>
  );
};
