import { streamText, simulateReadableStream } from "ai";
import { MockLanguageModelV1 } from "ai/test";
import { Context } from "hono";
import { stream } from "hono/streaming";

export const mockChat = async (c: Context) => {
  // delay for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const result = await streamText({
    model: new MockLanguageModelV1({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            {
              type: "text-delta",
              textDelta: "Hello world, how are you?\n",
            },
            {
              type: "finish",
              finishReason: "stop",
              logprobs: undefined,
              usage: { completionTokens: 45, promptTokens: 8 },
            },
          ],
          // chunks: [
          //   { type: "text-delta", textDelta: "# The Developer's Journey\n\n" },
          //   {
          //     type: "text-delta",
          //     textDelta:
          //       "The journey begins with **a single step**, leading to\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "endless opportunities and discoveries waiting\n",
          //   },
          //   { type: "text-delta", textDelta: "to be uncovered each day.\n\n" },
          //   { type: "text-delta", textDelta: "## Key Technologies\n\n" },
          //   {
          //     type: "text-delta",
          //     textDelta: "| Language | Use Case | Difficulty |\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "|----------|----------|------------|\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "| JavaScript | Web Development | ⭐⭐⭐ |\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "| Python | Data Science | ⭐⭐⭐⭐ |\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "| Rust | Systems Programming | ⭐⭐⭐⭐⭐ |\n\n",
          //   },
          //   { type: "text-delta", textDelta: "### Getting Started Code\n\n" },
          //   { type: "text-delta", textDelta: "```\n" },
          //   {
          //     type: "text-delta",
          //     textDelta: "function embraceAdventure() {\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "  console.log('Challenge the limits');\n",
          //   },
          //   {
          //     type: "text-delta",
          //     textDelta: "  return 'of your imagination!';\n",
          //   },
          //   { type: "text-delta", textDelta: "}\n```\n\n" },
          //   {
          //     type: "text-delta",
          //     textDelta:
          //       "> **Embrace the adventure** and challenge the limits\n",
          //   },
          //   { type: "text-delta", textDelta: "> of your imagination!\n\n" },
          //   { type: "text-delta", textDelta: "- Start the journey\n" },
          //   { type: "text-delta", textDelta: "- Master new skills\n" },
          //   { type: "text-delta", textDelta: "- Build amazing projects\n" },
          //   {
          //     type: "finish",
          //     finishReason: "stop",
          //     logprobs: undefined,
          //     usage: { completionTokens: 45, promptTokens: 8 },
          //   },
          // ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    }),
    prompt: "Hello, test!",
  });

  return stream(c, (stream) => stream.pipe(result.toDataStream()));
};
