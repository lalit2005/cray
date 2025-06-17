import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import schema from "./schema";

export const createDbClient = (env: any) => {
  // For query builder
  const queryClient = postgres(env.DB_URL);
  const db = drizzle(queryClient, { schema });

  return { db };
};

export { schema };
