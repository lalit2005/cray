import { Context } from "hono";
import { getModel } from "../models";
import { streamText } from "ai";
import { Providers, ChatRequest } from "../models";
import { stream } from "hono/streaming";

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

      const result = await streamText({
        model: modelInstance,
        messages,
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
