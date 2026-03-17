import { and, desc, eq } from "drizzle-orm"
import { db } from "./db.server"
import { project } from "./schema.server"
import type { Project } from "./schema.server"

function newId() {
  return crypto.randomUUID()
}

export async function listProjects(userId: string): Promise<Project[]> {
  return db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.updatedAt))
}

export async function getProject(id: string, userId: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .limit(1)
  return rows[0] ?? null
}

export async function createProject(userId: string, name: string, data: object): Promise<Project> {
  const id = newId()
  const now = new Date()
  await db.insert(project).values({
    id,
    userId,
    name,
    data: JSON.stringify(data),
    createdAt: now,
    updatedAt: now,
  })
  const row = await getProject(id, userId)
  if (!row) throw new Error("Failed to create project")
  return row
}

export async function saveProject(
  id: string,
  userId: string,
  name: string,
  data: object
): Promise<Project> {
  const existing = await getProject(id, userId)
  if (!existing) {
    return createProject(userId, name, data)
  }
  await db
    .update(project)
    .set({ name, data: JSON.stringify(data), updatedAt: new Date() })
    .where(and(eq(project.id, id), eq(project.userId, userId)))

  const updated = await getProject(id, userId)
  if (!updated) throw new Error("Failed to fetch project after save")
  return updated
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await db.delete(project).where(and(eq(project.id, id), eq(project.userId, userId)))
}
