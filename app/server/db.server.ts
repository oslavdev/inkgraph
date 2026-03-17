import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import * as schema from "./schema.server"

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle> | undefined
}

function createDb() {
  const url = process.env.TURSO_DATABASE_URL
  if (!url) throw new Error("TURSO_DATABASE_URL is not set")

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })

  return drizzle(client, { schema })
}

function getDb() {
  if (!global.__db) {
    global.__db = createDb()
  }
  return global.__db
}

export const db = getDb()
