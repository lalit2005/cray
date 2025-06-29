import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { createDbClient, schema } from "./db";
import { and, eq, gt, or } from "drizzle-orm";
import { sign, verify } from "hono/jwt";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { genSaltSync, hashSync, compareSync } from "bcrypt-edge";
import { sync } from "./lib/sync";
import { SyncRequest, SyncResponse } from "./lib/sync-interface";
import chat from "./lib/chat";
import { generateMetadata } from "./lib/metadata";

interface UserDataInToken {
  email: string;
  userId: string;
  name: string;
}

const app = new Hono<{
  Variables: {
    db: ReturnType<typeof createDbClient>["db"];
    JWT_SECRET: string;
    user: UserDataInToken;
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
    // expose cookie headers and allow Authorization header
    exposeHeaders: ["set-cookie", "Set-Cookie"],
    allowHeaders: ["Content-Type", "Authorization", "token"],
  })
);

const authMiddleware = async (c: Context, next: Next) => {
  // Check for token in cookie first, then in Authorization header, then in custom token header
  const token = (getCookie(c, "token") ||
    c.req.header("Authorization")?.replace("Bearer ", "") ||
    c.req.header("token")) as string;

  if (!token) {
    return c.json(
      {
        error: "Authentication required. Please log in.",
        code: "NO_TOKEN",
      },
      401
    );
  }

  try {
    const decoded = (await verify(
      token,
      c.get("JWT_SECRET")
    )) as unknown as UserDataInToken;

    // Set the user in context with all the decoded data
    c.set("user", decoded);
    await next();
  } catch (err) {
    console.log({
      err,
      token,
      cookie: getCookie(c, "token"),
      tokenHeader: c.req.header("token"),
      authHeader: c.req.header("Authorization"),
    });

    // Provide more specific error based on what went wrong
    if (err instanceof Error) {
      if (err.message.includes("expired")) {
        return c.json(
          {
            error: "Your session has expired. Please log in again.",
            code: "TOKEN_EXPIRED",
          },
          401
        );
      } else if (err.message.includes("invalid")) {
        return c.json(
          {
            error: "Invalid authentication token. Please log in again.",
            code: "TOKEN_INVALID",
          },
          401
        );
      }
    }

    return c.json(
      {
        error: "Authentication failed. Please log in again.",
        code: "AUTH_FAILED",
      },
      401
    );
  }
};

app.use("*", async (c, next) => {
  const { db } = createDbClient(c.env);
  c.set("db", db);
  const JWT_SECRET = (c.env as { JWT_SECRET: string }).JWT_SECRET;
  c.set("JWT_SECRET", JWT_SECRET);
  await next();
});

app.post("/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    // Input validation
    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    if (password.length < 6) {
      return c.json(
        { error: "Password must be at least 6 characters long" },
        400
      );
    }

    // Check if user with this email already exists
    const existingUsers = await c.var.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      return c.json({ error: "A user with this email already exists" }, 409);
    }

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
    if (!result || result.length === 0) {
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
    setCookie(c, "token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 31536000,
    });

    // Return user data without sensitive information
    const { passwordHash: _, ...userData } = user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _; // Prevent unused variable warning

    return c.json({
      message: "User created and logged in",
      token: token, // Explicitly return token in the response for in-memory storage
      user: userData,
    });
  } catch (error) {
    console.error("Signup error:", error);
    return c.json(
      {
        error: "An unexpected error occurred during signup. Please try again.",
      },
      500
    );
  }
});

app.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();

    // Input validation
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const users = await c.var.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!users[0]) {
      // For security, use a generic message rather than specifically saying the user doesn't exist
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const user = users[0];
    if (!compareSync(password, user.passwordHash)) {
      return c.json({ error: "Invalid email or password" }, 401);
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
    setCookie(c, "token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 31536000,
    });

    // Return user data without sensitive information
    const { passwordHash: _, ...userData } = user;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _; // Prevent unused variable warning

    return c.json({
      message: "Logged in successfully",
      token: token,
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      {
        error: "An unexpected error occurred during login. Please try again.",
      },
      500
    );
  }
});

app.post("/logout", async (c) => {
  // c.header("Set-Cookie", `token=; HttpOnly; Secure; SameSite=None;; Max-Age=0`);
  deleteCookie(c, "token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 0,
  });
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

app.post("/metadata", authMiddleware, async (c) => {
  try {
    const { message, provider, model, apiKey } = await c.req.json();

    if (!message || !provider || !model || !apiKey) {
      return c.json(
        { error: "Missing required fields: message, provider, model, apiKey" },
        400
      );
    }

    const metadata = await generateMetadata(message, provider, model, apiKey);
    return c.json(metadata);
  } catch (error) {
    console.error("Error generating metadata:", error);
    return c.json({ error: "Failed to generate metadata" }, 500);
  }
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

  // console.log({ serverChanges });

  return c.json(serverChanges);
});

export default app;
