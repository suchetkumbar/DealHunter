import { neon } from "@neondatabase/serverless";

let client: ReturnType<typeof neon> | null = null;

/** Neon's HTTP driver: no connection pool to manage, which suits serverless functions. */
export function db() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not configured.");
    client = neon(url);
  }
  return client;
}
