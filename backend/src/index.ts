import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { createDbClient, schema } from "./db";
import { and, eq, gt, gte, or } from "drizzle-orm";
import { User } from "./schema";
import { sign, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { genSaltSync, hashSync, compareSync } from "bcrypt-edge";
import { mockChat } from "./lib/mockChat";
import { sync } from "./lib/sync";
import { SyncRequest, SyncResponse } from "./lib/sync-interface";

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
