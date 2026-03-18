import { and, desc, eq } from "drizzle-orm"
import { db } from "./db.server"
import { project } from "./schema.server"
import type { Project } from "./schema.server"

function newId() {
  return crypto.randomUUID()
}

// libsql stores timestamps as Unix seconds (integer) — never pass Date objects
function now() {
  return Math.floor(Date.now() / 1000)
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

export async function getLastOpenedProject(userId: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.userId, userId))
    .orderBy(desc(project.lastOpenedAt))
    .limit(1)
  return rows[0] ?? null
}

export async function createProject(
  userId: string,
  name: string,
  description: string,
  data: object
): Promise<Project> {
  const id = newId()
  const ts = now()
  await db.insert(project).values({
    id,
    userId,
    name,
    description,
    data: JSON.stringify(data),
    lastOpenedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  })
  const row = await getProject(id, userId)
  if (!row) throw new Error("Failed to create project")
  return row
}

export async function saveProject(
  id: string,
  userId: string,
  name: string,
  description: string,
  data: object
): Promise<Project> {
  const existing = await getProject(id, userId)
  if (!existing) {
    return createProject(userId, name, description, data)
  }
  await db
    .update(project)
    .set({ name, description, data: JSON.stringify(data), updatedAt: now() })
    .where(and(eq(project.id, id), eq(project.userId, userId)))
  const updated = await getProject(id, userId)
  if (!updated) throw new Error("Failed to fetch project after save")
  return updated
}

export async function touchProject(id: string, userId: string): Promise<void> {
  await db
    .update(project)
    .set({ lastOpenedAt: now() })
    .where(and(eq(project.id, id), eq(project.userId, userId)))
}

export async function updateProjectMeta(
  id: string,
  userId: string,
  name: string,
  description: string
): Promise<void> {
  await db
    .update(project)
    .set({ name, description, updatedAt: now() })
    .where(and(eq(project.id, id), eq(project.userId, userId)))
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await db.delete(project).where(and(eq(project.id, id), eq(project.userId, userId)))
}

export function emptyProjectData() {
  // Must include a valid initial scene with a root node so useTree
  // doesn't start with null rootId and an empty canvas
  const sceneId = crypto.randomUUID()
  const nodeId = crypto.randomUUID()
  return {
    scenes: [{ id: sceneId, name: "Scene 1", description: "" }],
    nodesByScene: {
      [sceneId]: {
        root: nodeId,
        nodes: {
          [nodeId]: {
            id: nodeId,
            x: 200,
            y: 120,
            speaker: "",
            characterId: null,
            text: "",
            choices: [],
            nextId: null,
            tag: "none",
            conditions: [],
            effects: [],
          },
        },
      },
    },
    characters: [],
    variables: [],
  }
}
