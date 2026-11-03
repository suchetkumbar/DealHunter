// Applies db/migrations/*.sql in order. Usage: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` first.");
const sql = neon(url);
const dir = join(import.meta.dirname, "..", "db", "migrations");

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const statements = readFileSync(join(dir, file), "utf8")
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`applied ${file} (${statements.length} statements)`);
}
