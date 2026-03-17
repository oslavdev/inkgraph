import { createClient } from "@libsql/client"
import { config } from "dotenv"
import { drizzle } from "drizzle-orm/libsql"
import { migrate } from "drizzle-orm/libsql/migrator"

// Load .env when running outside of React Router (e.g. CLI scripts)
config()

const url = process.env.TURSO_DATABASE_URL
if (!url) throw new Error("TURSO_DATABASE_URL is not set")

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
const db = drizzle(client)

await migrate(db, { migrationsFolder: "./drizzle" })
console.info("✓ Migrations applied")
client.close()
