import { createProject, listProjects } from "../server/projects.server"
import { requireUser } from "../server/session.server"

interface GuestProject {
  id: string
  name: string
  description: string
  data: string
}

/**
 * POST /api/migrate-guest-projects
 *
 * Called client-side immediately after sign-in or registration when the
 * browser has guest projects in localStorage. Imports them into the DB,
 * merging with any existing projects the account already has.
 *
 * Body: { projects: GuestProject[] }
 * Response: { imported: number; skipped: number }
 *
 * Merge strategy:
 *   - If account already has a project with the exact same name → rename
 *     the incoming project "<name> (imported)" to avoid silent overwrites.
 *   - Otherwise → create as-is.
 */
export async function action({ request }: { request: Request }) {
  const user = await requireUser(request)

  let body: { projects: GuestProject[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const incoming = body.projects
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return Response.json({ imported: 0, skipped: 0 })
  }

  // Fetch existing project names to detect conflicts
  const existing = await listProjects(user.id)
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase().trim()))

  let imported = 0
  let skipped = 0

  for (const gp of incoming) {
    // Validate minimal shape
    if (!gp.name || !gp.data) {
      skipped += 1
      continue
    }

    let data: object
    try {
      data = JSON.parse(gp.data)
    } catch {
      skipped += 1
      continue
    }

    // Resolve name conflict
    let name = gp.name.trim() || "Untitled"
    if (existingNames.has(name.toLowerCase())) {
      name = `${name} (imported)`
    }
    existingNames.add(name.toLowerCase())

    await createProject(user.id, name, gp.description?.trim() ?? "", data)
    imported += 1
  }

  return Response.json({ ok: true, imported, skipped })
}

// GET not supported
export async function loader() {
  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 })
}
