import type { Config } from "drizzle-kit"

const url = process.env.TURSO_DATABASE_URL
if (!url) throw new Error("TURSO_DATABASE_URL is not set")

export default {
  schema: "./app/server/schema.server.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config
