// filepath: /home/lalit/Documents/dev/cray/backend/src/lib/chat.ts
import { Context } from "hono";
import { streamText } from "ai";
import { stream } from "hono/streaming";
import { getModel, Providers, ChatRequest } from "../models";

export default async function (c: Context) {
  try {
    const { messages, provider, model, apiKey } =
      (await c.req.json()) as ChatRequest;

    console.log("Request received:", {
      provider,
      model,
      apiKey: apiKey ? "provided" : "not provided",
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: "Messages array is required" }, 400);
    }

    const PROVIDERS_REQUIRING_KEY: Providers[] = [
      "openai",
      "anthropic",
      "deepseek",
      "perplexity",
    ];

    if (PROVIDERS_REQUIRING_KEY.includes(provider as Providers) && !apiKey) {
      return c.json({ error: `API key is required for ${provider}` }, 400);
    }

    try {
      console.log("Initializing model:", { provider, model });
      const modelInstance = getModel({
        provider,
        modelId: model,
        apiKey,
      });

      console.log("Model initialized, streaming text...");

      // Sanitize messages to ensure they alternate correctly (user->assistant->user)
      const sanitizedMessages = [];
      let lastRole = null;

      for (const message of messages) {
        // If this is a consecutive message with the same role, skip it
        if (lastRole === message.role) {
          console.log(
            `Skipping consecutive ${message.role} message:`,
            message.content.substring(0, 50)
          );
          continue;
        }

        // Otherwise, add the message and update lastRole
        sanitizedMessages.push(message);
        lastRole = message.role;
      }

      // Ensure last message is from user for better response
      if (
        sanitizedMessages.length > 0 &&
        sanitizedMessages[sanitizedMessages.length - 1].role === "assistant"
      ) {
        console.log(
          "Removing assistant message at the end of the conversation"
        );
        sanitizedMessages.pop();
      }

      // Additional validation specifically for Perplexity API - they're stricter about message format
      if (provider === "perplexity") {
        // Ensure we start with a user message
        if (
          sanitizedMessages.length > 0 &&
          sanitizedMessages[0].role !== "user"
        ) {
          sanitizedMessages.shift();
        }

        // Ensure we have proper alternating messages
        const validatedMessages = [];
        let expectedRole = "user";

        for (const message of sanitizedMessages) {
          if (message.role === expectedRole) {
            validatedMessages.push(message);
            expectedRole = expectedRole === "user" ? "assistant" : "user";
          }
        }

        // If we have at least one message and it's a user message, we're good to go
        if (
          validatedMessages.length > 0 &&
          validatedMessages[validatedMessages.length - 1].role === "user"
        ) {
          sanitizedMessages.length = 0;
          sanitizedMessages.push(...validatedMessages);
        }
      }

      // Special handling for Google models - they require non-empty content in parts arrays
      if (provider === "google") {
        // Filter out any message that has empty content
        const filteredMessages = sanitizedMessages.filter(
          (message) =>
            message.content !== undefined &&
            message.content !== null &&
            message.content.trim() !== ""
        );

        if (filteredMessages.length !== sanitizedMessages.length) {
          console.log(
            `Filtered out ${
              sanitizedMessages.length - filteredMessages.length
            } empty messages for Google API`
          );
          sanitizedMessages.length = 0;
          sanitizedMessages.push(...filteredMessages);
        }
      }

      console.log(
        `Sanitized from ${messages.length} to ${sanitizedMessages.length} messages`
      );

      // Final validation to ensure no provider-specific requirements are broken
      let processedMessages = sanitizedMessages;

      // Special handling before sending to model
      if (provider === "google") {
        // Double check for any empty messages or parts
        processedMessages = sanitizedMessages.filter(
          (message) =>
            message.content !== undefined &&
            message.content !== null &&
            message.content.trim() !== ""
        );

        // Add system instructions if needed (sometimes helps Google models)
        if (!processedMessages.some((m) => m.role === "system")) {
          processedMessages.unshift({
            role: "system",
            content:
              "You are a helpful AI assistant. Respond concisely and accurately.",
          });
        }

        console.log(
          `Prepared ${processedMessages.length} valid messages for Google API`
        );
      }

      const result = await streamText({
        model: modelInstance,
        messages: processedMessages,
        onFinish: (msg) => {
          console.log("Message received:", msg);
        },
        onError: (error) => {
          console.error("Error streaming text:", error);
        },
      });

      c.header("X-Vercel-AI-Data-Stream", "v1");
      c.header("Content-Type", "text/plain; charset=utf-8");

      return stream(c, (stream) => stream.pipe(result.toDataStream()));
    } catch (modelError) {
      console.error("Model initialization/execution error:", {
        error: modelError,
        message: (modelError as Error)?.message,
        provider,
        model,
        stack: (modelError as Error)?.stack,
      });

      // Extract error information
      const errorMessage = (modelError as Error)?.message || "";
      const responseBody =
        (modelError as { responseBody?: string })?.responseBody || "";

      // Find the last user message for potential fallbacks
      const lastUserMessage = messages.findLast((m) => m.role === "user");

      // Check for Perplexity API errors
      const isPerplexityError =
        provider === "perplexity" &&
        (errorMessage.includes("alternate with assistant") ||
          responseBody.includes("alternate with assistant") ||
          errorMessage.includes("invalid_message") ||
          responseBody.includes("invalid_message"));

      // Check for Google API errors
      const isGoogleError =
        provider === "google" &&
        (errorMessage.includes("parts must not be empty") ||
          responseBody.includes("parts must not be empty") ||
          errorMessage.includes("INVALID_ARGUMENT") ||
          responseBody.includes("INVALID_ARGUMENT"));

      // Try fallback approach if we have specific API errors
      if ((isPerplexityError || isGoogleError) && lastUserMessage) {
        console.log(`Detected ${provider} API error, trying fallback approach`);

        try {
          console.log("Using fallback with only the last user message");

          // Create a fresh model instance for the fallback attempt
          const fallbackModel = getModel({
            provider,
            modelId: model,
            apiKey,
          });

          // Create appropriate fallback messages based on provider
          const fallbackMessages = [lastUserMessage];

          // For Google models, add a system message too
          if (provider === "google") {
            fallbackMessages.unshift({
              role: "system",
              content:
                "You are a helpful AI assistant. Respond concisely and accurately.",
            });
          }

          const fallbackResult = await streamText({
            model: fallbackModel,
            messages: fallbackMessages,
            onFinish: (msg) => {
              console.log("Fallback message received:", msg);
            },
            onError: (fallbackError) => {
              console.error("Fallback also failed:", fallbackError);
            },
          });

          return stream(c, (stream) =>
            stream.pipe(fallbackResult.toDataStream())
          );
        } catch (fallbackError) {
          console.error("Fallback attempt failed:", fallbackError);

          // Last resort fallback for Google models - try switching to a different model
          if (provider === "google") {
            try {
              console.log(
                "Attempting last resort fallback with a different Google model"
              );

              // Try a different Google model as a last resort
              const alternateModel = model.includes("flash")
                ? "gemini-2.5-pro-exp-03-25"
                : "gemini-2.5-flash-preview-04-17";

              const lastResortModel = getModel({
                provider,
                modelId: alternateModel,
                apiKey,
              });

              // Get content from last user message
              const userMessageContent =
                lastUserMessage.content || "Please help me with my question.";

              const finalFallbackResult = await streamText({
                model: lastResortModel,
                messages: [
                  {
                    role: "user",
                    content: userMessageContent,
                  },
                ],
                onFinish: (msg) => {
                  console.log("Last resort fallback succeeded:", msg);
                },
                onError: (finalError) => {
                  console.error("Last resort also failed:", finalError);
                },
              });

              return stream(c, (stream) =>
                stream.pipe(finalFallbackResult.toDataStream())
              );
            } catch (finalError) {
              console.error("All fallback attempts failed:", finalError);
              // Continue to standard error response
            }
          }
        }
      }

      // Standard error response if all fallbacks failed
      return c.json(
        {
          error: `Error with ${provider} model: ${model}`,
          details: (modelError as Error)?.message,
          provider,
          model,
        },
        500
      );
    }
  } catch (error) {
    console.error("Chat endpoint error:", {
      error: error as Error,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });

    return c.json(
      {
        error: "Internal server error",
        details: (error as Error)?.message,
      },
      500
    );
  }
}
