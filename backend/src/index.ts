import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { createDbClient, schema } from "./db";
import { and, eq } from "drizzle-orm";
import { Message } from "./schema";
import chat from "./routes/chat";
import { User } from "./schema";
import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { genSaltSync, hashSync, compareSync } from "bcrypt-edge";
import { DataStreamWriter, pipeDataStreamToResponse } from "ai";
import { stream } from "hono/streaming";
import { mockChat } from "./routes/mockChat";

const app = new Hono<{
  Variables: {
    db: ReturnType<typeof createDbClient>["db"];
    JWT_SECRET: string;
    user: User;
  };
}>().basePath("/api");

app.use(
  "*",
  cors({
    // any origin can access the API
    origin: [
      "http://localhost:5173",
      "http://localhost:8787",
      "https://cray.lalit.sh",
    ],
    // allow credentials (cookies) to be sent
    credentials: true,
  })
);

const authMiddleware = async (c: Context, next: Next) => {
  const token = (getCookie(c, "token") || c.req.header("token")) as string;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const decoded = (await verify(token, c.get("JWT_SECRET"))) as {
      email: string;
      userId: string;
      name: string;
    };
    // Set the user in context with all the decoded data
    c.set("user", decoded);
    await next();
  } catch (err) {
    return c.json({ error: "Invalid token" }, 401);
  }
};

app.use("*", async (c, next) => {
  const { db } = createDbClient(c.env);
  c.set("db", db);
  const JWT_SECRET = (c.env as { JWT_SECRET: string }).JWT_SECRET;
  c.set("JWT_SECRET", JWT_SECRET);

  // Only try to get user if there's a token
  const token =
    getCookie(c, "token") || c.req.header("authorization")?.split(" ")[1];
  if (token) {
    try {
      const decoded = (await verify(token, JWT_SECRET)) as { userId: string };
      if (decoded?.userId) {
        const users = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.userId, decoded.userId))
          .limit(1);
        if (users[0]) {
          c.set("user", users[0] as User);
        }
      }
    } catch (err) {
      // Token verification failed, proceed without user
      console.error("Token verification failed:", err);
    }
  }

  await next();
});

app.post("/signup", async (c) => {
  const { email, password, name } = await c.req.json();
  const salt = genSaltSync(10);
  const passwordHash = hashSync(password, salt);
  const result = await c.var.db
    .insert(schema.users)
    .values({
      email,
      name,
      passwordHash,
    })
    .returning();
  if (!result) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  const user = result[0];
  // Create token for the new user
  const token = await sign(
    {
      email: user.email,
      userId: user.userId,
      name: user.name,
    },
    c.var.JWT_SECRET,
    "HS256"
  );

  // Set HttpOnly Secure Cookie
  c.header(
    "Set-Cookie",
    `token=${token}; HttpOnly; Secure; SameSite=None; Path=/`
  );

  // Return user data without sensitive information
  const { passwordHash: _, ...userData } = user;
  return c.json({
    message: "User created and logged in",
    token: token,
    user: userData,
  });
});

app.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const users = await c.var.db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (!users[0]) {
    return c.json({ error: "User not found" }, 404);
  }
  console.log({ users });
  const user = users[0];
  if (!user || !compareSync(password, user.passwordHash)) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await sign(
    {
      email: user.email,
      userId: user.userId,
      name: user.name,
    },
    c.get("JWT_SECRET"),
    "HS256"
  );

  // Set HttpOnly Secure Cookie
  c.header(
    "Set-Cookie",
    `token=${token}; HttpOnly; Secure; SameSite=None; Path=/`
  );

  // Return user data without sensitive information
  const { passwordHash, ...userData } = user;
  return c.json({
    message: "Logged in",
    token: token,
    user: userData,
  });
});

app.post("/logout", async (c) => {
  c.header(
    "Set-Cookie",
    `token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`
  );
  return c.json({ message: "Logged out" });
});

app.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ user });
});

app.get("/", (c) => {
  return c.json({ message: "Hello Hono!" }, 200);
});

app.post("/chat", authMiddleware, async (c) => {
  return await mockChat(c);
  // return await chat(c);
});

// create a new chat
app.post("/chats", authMiddleware, async (c) => {
  try {
    const { title, notes, tags } = await c.req.json();
    const newChat = await c.var.db
      .insert(schema.chats)
      .values({
        title,
        notes: notes || "",
        tags: tags || [],
        messages: [],
        userId: c.get("user").userId,
      })
      .returning();
    return c.json(newChat, 201);
  } catch (err) {
    console.error("Error creating chat:", err);
    return c.json({ error: "Failed to create chat" }, 500);
  }
});

// get all chats
app.get("/chats", authMiddleware, async (c) => {
  try {
    const chats = await c.var.db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.userId, c.get("user").userId));
    return c.json(chats);
  } catch (err) {
    console.error("Error fetching chats:", err);
    return c.json({ error: "Failed to fetch chats" }, 500);
  }
});

// add a message to a chat
app.post("/chats/:id/messages", authMiddleware, async (c) => {
  try {
    const chatId = c.req.param("id");
    const { role, content } = await c.req.json();

    const chat = await c.var.db
      .select()
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.id, chatId),
          eq(schema.chats.userId, c.get("user").userId)
        )
      )
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
      .where(
        and(
          eq(schema.chats.id, chatId),
          eq(schema.chats.userId, c.get("user").userId)
        )
      )
      .returning();

    return c.json(updatedChat[0], 200);
  } catch (err) {
    console.error("Error adding message:", err);
    return c.json({ error: "Failed to add message" }, 500);
  }
});

// get a chat
app.get("/chats/:id", authMiddleware, async (c) => {
  try {
    const chatId = c.req.param("id");
    const chat = await c.var.db
      .select()
      .from(schema.chats)
      .where(
        and(
          eq(schema.chats.id, chatId),
          eq(schema.chats.userId, c.get("user").userId)
        )
      )
      .limit(1);
    return c.json(chat[0]);
  } catch (err) {
    console.error("Error fetching chat:", err);
    return c.json({ error: "Failed to fetch chat" }, 500);
  }
});

export default app;
