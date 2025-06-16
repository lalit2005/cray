import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import { streamText } from "ai";
import { createDbClient, schema } from "./db";
import { eq } from "drizzle-orm";
import { Message } from "./schema";
import { getModel, type Providers, type ChatRequest } from "./models";
import chat from "./routes/chat";

const app = new Hono<{
  Variables: {
    db: ReturnType<typeof createDbClient>["db"];
  };
}>();

app.use("*", async (c, next) => {
  const { db } = createDbClient(c.env);
  c.set("db", db);
  await next();
});

app.use(
  "*",
  cors({
    // any origin can access the API
    origin: ["http://localhost:5173", "http://localhost:8787"],
    // allow credentials (cookies) to be sent
    credentials: true,
  })
);

app.get("/", (c) => {
  return c.json({ message: "Hello Hono!" }, 200);
});

app.post("/chat", async (c) => {
  return await chat(c);
});

app.post("/chats", async (c) => {
  try {
    const { title, notes, tags } = await c.req.json();
    const newChat = await c.var.db
      .insert(schema.chats)
      .values({
        title,
        notes: notes || "",
        tags: tags || [],
        messages: [],
      })
      .returning();
    return c.json(newChat, 201);
  } catch (err) {
    console.error("Error creating chat:", err);
    return c.json({ error: "Failed to create chat" }, 500);
  }
});

app.get("/chats", async (c) => {
  try {
    const chats = await c.var.db.select().from(schema.chats);
    return c.json(chats);
  } catch (err) {
    console.error("Error fetching chats:", err);
    return c.json({ error: "Failed to fetch chats" }, 500);
  }
});

app.post("/chats/:id/messages", async (c) => {
  try {
    const chatId = c.req.param("id");
    const { role, content } = await c.req.json();

    const chat = await c.var.db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.id, chatId))
      .limit(1);

    if (!chat[0]) {
      return c.json({ error: "Chat not found" }, 404);
    }

    const currentMessages = chat[0].messages || [];

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role,
      content,
      createdAt: new Date(),
      provider: "openai",
      model: "gpt-4o",
    };

    const updatedChat = await c.var.db
      .update(schema.chats)
      .set({
        messages: [...currentMessages, newMessage],
        updatedAt: new Date(),
      })
      .where(eq(schema.chats.id, chatId))
      .returning();

    return c.json(updatedChat[0], 200);
  } catch (err) {
    console.error("Error adding message:", err);
    return c.json({ error: "Failed to add message" }, 500);
  }
});

app.get("/chats/:id", async (c) => {
  try {
    const chatId = c.req.param("id");
    const chat = await c.var.db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.id, chatId))
      .limit(1);
    return c.json(chat[0]);
  } catch (err) {
    console.error("Error fetching chat:", err);
    return c.json({ error: "Failed to fetch chat" }, 500);
  }
});

export default app;
