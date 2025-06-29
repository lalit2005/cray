import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type Providers } from "./models";

// Define the schema for the generated metadata
const metadataSchema = z.object({
  title: z
    .string()
    .max(50)
    .describe(
      "A concise and descriptive title for the conversation (max 50 characters)."
    ),
  tags: z
    .array(z.string())
    .length(10)
    .describe(
      "An array of exactly 10 relevant tags that capture the main topics."
    ),
});

/**
 * Generates a title and tags for a given message using the AI SDK.
 * @param message The message content to analyze (first 250 characters will be used).
 * @param provider The AI provider to use.
 * @param modelName The name of the model to use.
 * @param apiKey The API key for the provider.
 * @returns An object containing the generated title and tags.
 */
export const generateMetadata = async (
  message: string,
  provider: Providers,
  modelName: string,
  apiKey: string
) => {
  const model = getModel({ provider, modelId: modelName, apiKey });

  try {
    const { object } = await generateObject({
      model,
      schema: metadataSchema,
      prompt: `Based on the following message, generate a concise title and exactly 10 tags that summarize the content. 
      
      CRITICAL REQUIREMENTS:
      - Title MUST be 50 characters or less (very important!)
      - Generate exactly 10 tags
      - Tags should be single words or very short phrases
      - Tags should be lowercase
      - Tags should NOT contain # symbols or special characters
      - Tags should be relevant keywords that describe the content
      
      The message is: "${message}"`,
    });

    // Post-process the result to ensure it meets our requirements
    const processedTitle =
      object.title.length > 50
        ? object.title.substring(0, 47) + "..."
        : object.title;

    const processedTags = object.tags
      .map((tag) =>
        tag
          .toLowerCase()
          .replace(/[#@$%^&*()+=[\]{}|\\:";'<>?,./]/g, "") // Remove special characters
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim()
      )
      .filter((tag) => tag.length > 0) // Remove empty tags
      .slice(0, 10); // Ensure we have max 10 tags

    // Ensure we have exactly 10 tags, pad with generic ones if needed
    while (processedTags.length < 10) {
      processedTags.push(`topic${processedTags.length + 1}`);
    }

    return {
      title: processedTitle,
      tags: processedTags,
    };
  } catch (error) {
    console.error("Error in generateMetadata:", error);

    // Fallback response if AI generation fails
    const fallbackTitle =
      message.length > 47 ? message.substring(0, 47) + "..." : message;

    return {
      title: fallbackTitle,
      tags: [],
    };
  }
};
