import { useEffect, useRef, useState } from "react"
import { redirect, useFetcher, useNavigate } from "react-router"
import {
  createProject,
  deleteProject,
  listProjects,
  touchProject,
  updateProjectMeta,
} from "../server/projects.server"
import type { Project } from "../server/schema.server"
import { getSession } from "../server/session.server"

// Client-safe copy — cannot import from server module in component body
function emptyProjectData() {
  const sceneId = crypto.randomUUID()
  const nodeId = crypto.randomUUID()
  return {
    scenes: [{ id: sceneId, name: "Scene 1", description: "" }],
    nodesByScene: {
      [sceneId]: {
        root: nodeId,
        nodes: {
          [nodeId]: {
            id: nodeId, x: 200, y: 120, speaker: "", characterId: null,
            text: "", choices: [], nextId: null, tag: "none",
            conditions: [], effects: [],
          },
        },
      },
    },
    characters: [],
    variables: [],
  }
}

const C = {
  bg: "#0a0a0a",
  surface: "#0f0f0f",
  surface2: "#111",
  border: "#1e1e1e",
  border2: "#272727",
  accent: "#6366f1",
  text: "#e5e5e5",
  muted: "#555",
  dim: "#888",
  danger: "#ef4444",
  success: "#22c55e",
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request)
  if (!session) return { user: null, projects: [] }
  const projects = await listProjects(session.user.id)
  return { user: session.user, projects }
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request }: { request: Request }) {
  const session = await getSession(request)
  if (!session) return { ok: false, error: "Not authenticated" }
  const user = session.user
  const form = await request.formData()
  const intent = form.get("intent") as string

  if (intent === "create") {
    const name = (form.get("name") as string).trim() || "Untitled project"
    const description = (form.get("description") as string).trim()
    const p = await createProject(user.id, name, description, emptyProjectData())
    throw redirect(`/editor/${p.id}`)
  }

  if (intent === "open") {
    const id = form.get("id") as string
    await touchProject(id, user.id)
    throw redirect(`/editor/${id}`)
  }

  if (intent === "rename") {
    const id = form.get("id") as string
    const name = (form.get("name") as string).trim() || "Untitled project"
    const description = (form.get("description") as string).trim()
    await updateProjectMeta(id, user.id, name, description)
    return { ok: true }
  }

  if (intent === "delete") {
    const id = form.get("id") as string
    await deleteProject(id, user.id)
    return { ok: true }
  }

  return { ok: false }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: number | null): string {
  if (!d) return "Never"
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(d * 1000) // convert Unix seconds to ms
  )
}

function sceneCount(p: Project): number {
  try {
    const data = JSON.parse(p.data) as { scenes?: unknown[] }
    return data.scenes?.length ?? 0
  } catch {
    return 0
  }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#0d0d0d",
  border: "1px solid #2a2a2a",
  borderRadius: 5,
  color: C.text,
  fontSize: 14,
  padding: "9px 12px",
  outline: "none",
  fontFamily: "inherit",
}

// ─── Create modal ─────────────────────────────────────────────────────────────

interface ProjectFormProps {
  title: string
  initialName?: string
  initialDesc?: string
  intent: "create" | "rename"
  projectId?: string
  onCancel: () => void
  fetcher: ReturnType<typeof useFetcher>
  onGuestSubmit?: (name: string, description: string) => void
}

function ProjectForm({
  title,
  initialName = "",
  initialDesc = "",
  intent,
  projectId,
  onCancel,
  fetcher,
  onGuestSubmit,
}: ProjectFormProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDesc)
  const loading = fetcher.state !== "idle"

  function submit() {
    if (onGuestSubmit) {
      onGuestSubmit(name.trim() || "Untitled project", description.trim())
      onCancel()
      return
    }
    const form = new FormData()
    form.set("intent", intent)
    form.set("name", name)
    form.set("description", description)
    if (projectId) form.set("id", projectId)
    fetcher.submit(form, { method: "post" })
    if (intent === "rename") onCancel()
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(4px)",
      }}
      role="presentation"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel()
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(480px,92vw)",
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: 10,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
        }}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div style={{ height: 3, background: "linear-gradient(90deg,#6366f1,#a855f7)" }} />
        <div style={{ padding: "24px 24px 20px" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: C.text }}>
            {title}
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label
              htmlFor="proj-name"
              style={{
                display: "block",
                fontSize: 10,
                fontFamily: "monospace",
                color: C.muted,
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              PROJECT NAME
            </label>
            <input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="proj-desc"
              style={{
                display: "block",
                fontSize: 10,
                fontFamily: "monospace",
                color: C.muted,
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              DESCRIPTION <span style={{ color: "#333" }}>(optional)</span>
            </label>
            <textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of your project…"
              rows={2}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              type="button"
              onClick={submit}
              disabled={loading || !name.trim()}
              style={{
                flex: 1,
                background: !name.trim() ? "#1a1a2e" : C.accent,
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px",
                cursor: !name.trim() ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: !name.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "…" : intent === "create" ? "Create project" : "Save changes"}
            </button>
            <button
              type="button"
              type="button"
              onClick={onCancel}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.muted,
                fontSize: 13,
                padding: "10px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: Project
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

function ProjectCard({ project: p, onOpen, onRename, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const scenes = sceneCount(p)

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        cursor: "pointer",
        transition: "border-color 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "#3a3a6a"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = C.border
      }}
    >
      {/* Colour accent bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#6366f1,#a855f7)" }} />

      <button
        type="button"
        type="button"
        onClick={onOpen}
        style={{
          display: "block",
          width: "100%",
          background: "none",
          border: "none",
          padding: "18px 18px 14px",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
        aria-label={`Open project ${p.name}`}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          {p.name}
        </div>
        {p.description && (
          <div
            style={{
              fontSize: 12,
              color: C.dim,
              lineHeight: 1.6,
              marginBottom: 10,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as React.CSSProperties["WebkitBoxOrient"],
              overflow: "hidden",
            }}
          >
            {p.description}
          </div>
        )}
        <div
          style={{
            display: "flex",
            gap: 14,
            fontSize: 11,
            color: C.muted,
            fontFamily: "monospace",
          }}
        >
          <span>
            {scenes} scene{scenes !== 1 ? "s" : ""}
          </span>
          <span>opened {formatDate(p.lastOpenedAt)}</span>
        </div>
      </button>

      {/* ⋯ dropdown menu */}
      <div style={{ position: "absolute", top: 12, right: 12 }}>
        <button
          type="button"
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((o) => !o)
          }}
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "inherit",
          }}
          aria-label="Project options"
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div
              role="presentation"
              style={{ position: "fixed", inset: 0, zIndex: 10 }}
              onClick={() => setMenuOpen(false)}
              onKeyDown={(e) => { if (e.key === "Escape") setMenuOpen(false) }}
            />
            <div
              style={{
                position: "absolute",
                top: 32,
                right: 0,
                zIndex: 20,
                background: "#111",
                border: `1px solid ${C.border2}`,
                borderRadius: 8,
                overflow: "hidden",
                minWidth: 150,
                boxShadow: "0 12px 32px rgba(0,0,0,0.7)",
              }}
            >
              {[
                { label: "Open", action: onOpen, color: C.text },
                { label: "Rename / Edit", action: onRename, color: C.text },
                { label: "Delete", action: onDelete, color: C.danger },
              ].map(({ label, action, color }) => (
                <button
                  type="button"
                  key={label}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                    action()
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    color,
                    fontSize: 13,
                    padding: "10px 16px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Guest localStorage helpers ──────────────────────────────────────────────

const GUEST_KEY = "inkgraph-guest-projects"

function loadGuestProjects(): Project[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]") as Project[]
  } catch { return [] }
}

function saveGuestProjects(projects: Project[]) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(projects)) } catch { /* noop */ }
}

function mkGuestProject(name: string, description: string): Project {
  const now = Math.floor(Date.now() / 1000)
  const id = Math.random().toString(36).slice(2, 11)
  return {
    id,
    userId: "guest",
    name,
    description,
    data: JSON.stringify(emptyProjectData()),
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProjectsPage({ loaderData }: { loaderData: { user: { name: string; email: string } | null; projects: Project[] } }) {
  const { user } = loaderData
  const navigate = useNavigate()
  const fetcher = useFetcher<typeof action>()
  const isGuest = !user

  // Guest projects live in localStorage; server projects come from loaderData
  const [guestProjects, setGuestProjects] = useState<Project[]>([])
  useEffect(() => { setGuestProjects(loadGuestProjects()) }, [])

  const projects: Project[] = isGuest ? guestProjects : loaderData.projects

  const [renaming, setRenaming] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  // Logged-in: projects from loader are available immediately
  // Guest: projects come from localStorage, loaded in the guestProjects effect below
  const [showCreate, setShowCreate] = useState(
    () => !isGuest && loaderData.projects.length === 0
  )
  // For guests: open modal after localStorage has been read and is still empty
  const guestChecked = useRef(false)
  useEffect(() => {
    if (!isGuest || guestChecked.current) return
    guestChecked.current = true
    // At this point guestProjects has been set by the effect below
    // We read directly from localStorage to avoid stale closure
    const stored = loadGuestProjects()
    if (stored.length === 0) setShowCreate(true)
  }, [guestProjects, isGuest])

  const initials = user ? (user.name || user.email).slice(0, 2).toUpperCase() : "??"

  function openProject(id: string) {
    if (isGuest) {
      // Seed localStorage with this project's data then open editor
      const p = guestProjects.find((x) => x.id === id)
      if (p) {
        try {
          const d = JSON.parse(p.data) as {
            scenes?: unknown; nodesByScene?: unknown; characters?: unknown; variables?: unknown
          }
          localStorage.setItem("vn2-scenes", JSON.stringify(d.scenes ?? []))
          localStorage.setItem("vn2-nbs", JSON.stringify(d.nodesByScene ?? {}))
          localStorage.setItem("vn2-chars", JSON.stringify(d.characters ?? []))
          localStorage.setItem("vn2-vars", JSON.stringify(d.variables ?? []))
          localStorage.setItem("vn2-project-name", p.name)
          localStorage.removeItem("vn2-active-scene")
        } catch { /* ignore */ }
        // Touch lastOpenedAt
        const updated = guestProjects.map((x) =>
          x.id === id ? { ...x, lastOpenedAt: Math.floor(Date.now() / 1000) } : x
        )
        saveGuestProjects(updated)
        setGuestProjects(updated)
      }
      navigate("/editor")
      return
    }
    // Logged-in: editor loader calls touchProject, just navigate directly
    navigate(`/editor/${id}`)
  }

  function confirmDelete(p: Project) {
    setDeleting(p)
  }

  function doDelete(p: Project) {
    if (isGuest) {
      setGuestProjects((prev) => {
        const updated = prev.filter((x) => x.id !== p.id)
        saveGuestProjects(updated)
        return updated
      })
      setDeleting(null)
      return
    }
    const form = new FormData()
    form.set("intent", "delete")
    form.set("id", p.id)
    fetcher.submit(form, { method: "post" })
    setDeleting(null)
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {/* Modals */}
      {showCreate && (
        <ProjectForm
          title="New project"
          intent="create"
          fetcher={fetcher}
          onCancel={() => {
            // If no projects exist, going back means going to landing page
            if (projects.length === 0) { navigate("/"); return }
            setShowCreate(false)
          }}
          onGuestSubmit={isGuest ? (name, description) => {
            const p = mkGuestProject(name, description)
            setGuestProjects((prev) => {
              const updated = [p, ...prev]
              saveGuestProjects(updated)
              return updated
            })
            try {
              const d = emptyProjectData()
              localStorage.setItem("vn2-scenes", JSON.stringify(d.scenes))
              localStorage.setItem("vn2-nbs", JSON.stringify(d.nodesByScene))
              localStorage.setItem("vn2-chars", JSON.stringify(d.characters ?? []))
              localStorage.setItem("vn2-vars", JSON.stringify(d.variables ?? []))
              localStorage.removeItem("vn2-active-scene")
            } catch { /* noop */ }
            navigate("/editor")
          } : undefined}
        />
      )}

      {renaming && (
        <ProjectForm
          title="Edit project"
          intent="rename"
          initialName={renaming.name}
          initialDesc={renaming.description}
          projectId={renaming.id}
          fetcher={fetcher}
          onCancel={() => setRenaming(null)}
          onGuestSubmit={isGuest ? (name, description) => {
            setGuestProjects((prev) => {
              const updated = prev.map((p) =>
                p.id === renaming.id
                  ? { ...p, name, description, updatedAt: Math.floor(Date.now() / 1000) }
                  : p
              )
              saveGuestProjects(updated)
              return updated
            })
          } : undefined}
        />
      )}

      {deleting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
          }}
        >
          <div
            style={{
              width: "min(400px,92vw)",
              background: C.surface,
              border: "1px solid #3a1010",
              borderRadius: 10,
              padding: "24px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: C.danger }}>
              Delete project?
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
              <strong style={{ color: C.text }}>{deleting.name}</strong> and all its scenes, nodes,
              and characters will be permanently deleted. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                type="button"
                onClick={() => doDelete(deleting)}
                style={{
                  flex: 1,
                  background: "#1a0a0a",
                  border: "1px solid #5a2020",
                  borderRadius: 6,
                  color: C.danger,
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Delete permanently
              </button>
              <button
                type="button"
                type="button"
                onClick={() => setDeleting(null)}
                style={{
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.muted,
                  fontSize: 13,
                  padding: "10px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav
        style={{
          height: 56,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          paddingInline: "clamp(20px,4vw,64px)",
          background: C.surface,
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <button
          type="button"
          type="button"
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            color: C.accent,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          INKGRAPH
        </button>
        <div style={{ flex: 1 }} />

        <button
          type="button"
          type="button"
          onClick={() => navigate(isGuest ? "/login" : "/account")}
          style={{
            background: isGuest ? "transparent" : "linear-gradient(135deg,#6366f1,#a855f7)",
            border: isGuest ? "1px solid #2a2a2a" : "none",
            borderRadius: 6,
            color: isGuest ? "#888" : "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "5px 12px",
            cursor: "pointer",
            fontFamily: "monospace",
            letterSpacing: 0.3,
          }}
        >
          {isGuest ? "Sign in" : initials}
        </button>
      </nav>

      {/* Top loading bar */}
      <div style={{ height: 2, background: C.border, position: "relative", overflow: "hidden" }}>
        {fetcher.state !== "idle" && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: "40%",
              background: C.accent,
              borderRadius: 2,
              animation: "loadbar 1s ease-in-out infinite",
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes loadbar {
          0% { left: -40%; width: 40%; }
          50% { left: 30%; width: 50%; }
          100% { left: 110%; width: 40%; }
        }
      `}</style>

      {/* Content */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px clamp(20px,4vw,64px)" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 40,
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                margin: "0 0 6px",
                fontSize: 28,
                fontWeight: 800,
                color: C.text,
                letterSpacing: "-0.5px",
              }}
            >
              Projects
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              {projects.length === 0
                ? "No projects yet — create your first one."
                : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              type="button"
              onClick={() => navigate("/simulator")}
              style={{
                background: "transparent",
                border: `1px solid ${C.border2}`,
                borderRadius: 7,
                color: C.dim,
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 18px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span>🎭</span>
              Simulate
            </button>
            <button
              type="button"
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                background: C.accent,
                border: "none",
                borderRadius: 7,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 20px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              New project
            </button>
          </div>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🖊️</div>
            <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 600, color: C.text }}>
              Start your first project
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
              Each project has its own scenes, characters, and variables.
              <br />
              You can create as many as you need.
            </p>
            <button
              type="button"
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                background: C.accent,
                border: "none",
                borderRadius: 7,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 28px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Create first project
            </button>
          </div>
        )}

        {/* Grid */}
        {projects.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
              gap: 16,
            }}
          >
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => openProject(p.id)}
                onRename={() => setRenaming(p)}
                onDelete={() => confirmDelete(p)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}