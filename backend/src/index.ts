import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { createDbClient, schema } from "./db";
import { and, eq, gt, or } from "drizzle-orm";
import { User } from "./schema";
import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { genSaltSync, hashSync, compareSync } from "bcrypt-edge";
import { sync } from "./lib/sync";
import { SyncRequest, SyncResponse } from "./lib/sync-interface";
import chat from "./lib/chat";

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
  try {
    // Improved token extraction with better logging
    const token =
      getCookie(c, "token") ||
      c.req.header("authorization")?.split(" ")[1] ||
      c.req.header("token");

    if (!token) {
      console.log("[Auth] No token found");
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const JWT_SECRET = c.get("JWT_SECRET");
    if (!JWT_SECRET) {
      console.error("[Auth] JWT_SECRET not available in context");
      return c.json({ error: "Server configuration error" }, 500);
    }

    const decoded = (await verify(token, JWT_SECRET)) as {
      email: string;
      userId: string;
      name: string;
    };

    console.log(`[Auth] Successful verification for user: ${decoded.email}`);
    c.set("user", decoded);
    await next();
  } catch (err) {
    console.error("[Auth] Token verification failed:", err);
    return c.json({ error: "Invalid or expired token" }, 401);
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
    `token=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${
      60 * 60 * 24 * 7
    }`
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
    `token=${token}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${
      60 * 60 * 24 * 7
    }`
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
    'token=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0'
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
  // return await mockChat(c);
  return await chat(c);
});

// New endpoint for fetching shared chats (no auth required)
app.get("/shared-chat/:id", async (c) => {
  const chatId = c.req.param("id");
  const db = c.var.db;

  if (!chatId) {
    return c.json({ error: "Chat ID is required" }, 400);
  }

  try {
    // First, check if the chat exists and is public
    const chats = await db
      .select()
      .from(schema.chats)
      .where(
        and(eq(schema.chats.id, chatId), eq(schema.chats.isPublic, true)) // Only return public chats (boolean true)
      )
      .limit(1);

    if (!chats.length) {
      return c.json({ error: "Chat not found or is not public" }, 404);
    }

    const chat = chats[0];

    // Get user info (creator of the chat) for attribution but exclude sensitive data
    const users = await db
      .select({
        name: schema.users.name,
        userId: schema.users.userId,
      })
      .from(schema.users)
      .where(eq(schema.users.userId, chat.userId))
      .limit(1);

    const creatorName = users.length ? users[0].name : "Anonymous";

    // Get messages from the chat object
    const messages = Array.isArray(chat.messages) ? chat.messages : [];

    // Return the chat with creator's name and messages
    return c.json({
      chat: {
        ...chat,
        createdBy: creatorName, // Include the name of the user who created the chat
      },
      messages,
    });
  } catch (error) {
    console.error("Error fetching shared chat:", error);
    return c.json({ error: "Failed to fetch shared chat" }, 500);
  }
});

// Sync endpoint: handle bidirectional sync of chats
app.post("/sync", authMiddleware, async (c) => {
  return await sync(c);
});

// fetch records since lastSyncedAt
app.post("/fetch-new-records", authMiddleware, async (c) => {
  const db = c.var.db;
  const userId = c.get("user");

  const body: SyncRequest = await c.req.json();
  const { lastSyncedAt } = body;

  const serverChanges: SyncResponse = {
    serverChanges: [],
  };

  // Fetch both newly created chats AND chats with updated messages since lastSyncedAt
  const newChats = await db
    .select()
    .from(schema.chats)
    .where(
      and(
        eq(schema.chats.userId, userId.userId),
        or(
          gt(
            schema.chats.createdAt,
            new Date(lastSyncedAt || "").toISOString()
          ),
          gt(schema.chats.updatedAt, new Date(lastSyncedAt || "").toISOString())
        )
      )
    );

  serverChanges.serverChanges = newChats.map((c) => ({
    ...c,
    createdAt: c.createdAt || "",
    updatedAt: c.updatedAt || "",
    inTrash: !!c.inTrash,
    isPinned: !!c.isPinned,
    isPublic: !!c.isPublic,
    tags: c.tags || [],
    notes: c.notes || "",
    userId: c.userId || "",
    title: c.title || "",
    messages: c.messages
      ? c.messages.map((m) => ({
          ...m,
          createdAt: m.createdAt,
        }))
      : [],
  }));

  console.log({ serverChanges });

  return c.json(serverChanges);
});

export default app;
