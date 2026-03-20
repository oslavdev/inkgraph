import { useCallback, useEffect, useRef, useState } from "react"
import { redirect, useFetcher, useLoaderData, useNavigate } from "react-router"
import { ToastContainer, useToast } from "../components/toast"
import {
  C,
  Canvas,
  CharactersPanel,
  ExportPanel,
  GuideModal,
  HOTKEYS,
  IBtn,
  NodePanel,
  PANELS,
  ScenesPanel,
  Tooltip,
  VariablesPanel,
  useTree,
} from "../components/editor-core"
import {
  getLastOpenedProject,
  getProject,
  saveProject,
  touchProject,
  updateProjectMeta,
} from "../server/projects.server"
import { getSession } from "../server/session.server"

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request, params }: { request: Request; params: Record<string, string | undefined> }) {
  const session = await getSession(request)

  // Guest mode — allow through, project data comes from localStorage
  if (!session) {
    if (params.projectId) throw redirect("/editor") // guests have no server projects
    return { user: null, project: null }
  }

  const user = session.user

  // /editor/:projectId — load specific project
  if (params.projectId) {
    const project = await getProject(params.projectId, user.id)
    if (!project) throw redirect("/projects")
    await touchProject(project.id, user.id)
    return { user, project }
  }

  // /editor — load last opened, or send to projects to create one
  const last = await getLastOpenedProject(user.id)
  if (last) {
    throw redirect(`/editor/${last.id}`)
  }
  throw redirect('/projects')
}

// ─── Action — auto-save ───────────────────────────────────────────────────────

export async function action({ request, params }: { request: Request; params: Record<string, string | undefined> }) {
  const session = await getSession(request)
  if (!session) return { ok: false, error: "Not authenticated" }
  const user = session.user
  const form = await request.formData()
  const intent = form.get("intent") as string

  if (intent === "autosave") {
    // Read id from form — more reliable than params which can be undefined on parent route
    const id = (form.get("id") as string) || params.projectId
    if (!id) return { ok: false, error: "No project ID" }
    const name = (form.get("name") as string) || "Untitled"
    const description = (form.get("description") as string) || ""
    const data = JSON.parse(form.get("data") as string)
    await saveProject(id, user.id, name, description, data)
    return { ok: true }
  }

  if (intent === "rename") {
    const id = (form.get("id") as string) || params.projectId
    if (!id) return { ok: false, error: "No project ID" }
    const name = (form.get("name") as string) || "Untitled"
    await updateProjectMeta(id, user.id, name, "")
    return { ok: true }
  }

  return { ok: false, error: "Unknown intent" }
}

// ─── DownloadBtn ──────────────────────────────────────────────────────────────

function DownloadBtn({ mobile = false }: { mobile?: boolean }) {
  const size = mobile ? 38 : 36
  return (
    <button
      type="button"
      disabled
      title="Download desktop app — coming soon"
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        color: "#444",
        cursor: "not-allowed",
        borderRadius: 4,
        position: "relative",
      }}
    >
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M8 10l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="12"
          y1="6"
          x2="12"
          y2="14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#2a2a2a",
          border: "1px solid #111",
        }}
      />
    </button>
  )
}

// ─── Ko-fi nudge ──────────────────────────────────────────────────────────────

function KofiNudge({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 500,
        width: "min(320px, calc(100vw - 48px))",
        background: "#0f0f0f",
        border: "1px solid #2a2a2a",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
        animation: "slideUp 0.25s ease-out",
      }}
    >
      <style>
        {`
        @keyframes slideUp { 
          from { opacity:0; transform:translateY(12px); } 
          to { opacity:1; transform:translateY(0); } 
        }`}
      </style>
      <div style={{ height: 3, background: "linear-gradient(90deg,#ff5f5f,#ff9f9f)" }} />
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>☕</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", marginBottom: 4 }}>
              Enjoying Inkgraph?
            </div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
              If it&apos;s useful, consider supporting development on Ko-fi. It keeps the project
              alive!
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              window.open("https://ko-fi.com/oslavdevelopment#", "_blank", "noopener,noreferrer")
              onDismiss()
            }}
            style={{
              flex: 1,
              background: "#ff5f5f",
              border: "none",
              borderRadius: 5,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 8h1a4 4 0 0 1 0 8h-1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Support on Ko-fi
          </button>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: 5,
              color: "#555",
              fontSize: 12,
              padding: "8px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}

interface BarAction {
  label: string
  color: string
  action: () => void
  active?: boolean
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: top-level route component with necessarily complex state
export default function EditorRoute() {
  const navigate = useNavigate()
  const { user, project } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()

  // Seed localStorage keyed by project.id — re-seeds whenever project changes
  const seededRef = useRef("")
  if (project && seededRef.current !== project.id && typeof window !== "undefined") {
    seededRef.current = project.id
    try {
      const d = JSON.parse(project.data) as {
        scenes?: unknown
        nodesByScene?: unknown
        characters?: unknown
        variables?: unknown
      }
      // Always overwrite so switching projects clears stale canvas state
      localStorage.setItem("vn2-scenes", JSON.stringify(d.scenes ?? []))
      localStorage.setItem("vn2-nbs", JSON.stringify(d.nodesByScene ?? {}))
      localStorage.setItem("vn2-chars", JSON.stringify(d.characters ?? []))
      localStorage.setItem("vn2-vars", JSON.stringify(d.variables ?? []))
      localStorage.removeItem("vn2-active-scene") // let useTree pick the first scene fresh
    } catch {
      /* ignore parse errors — useTree will init defaults */
    }
  }

  // tree must be declared before any hook that references it
  const initialData = (() => {
    try { return project ? JSON.parse(project.data) : null } catch { return null }
  })()
  const tree = useTree(initialData)
  const { nodes, sel, setSel, addNode, addNodeSmart, addChoice, delNode, movNode, rootId, undo } = tree
  const [projectName, setProjectName] = useState(() => {
    if (project?.name) return project.name
    // Guest: name was stored in localStorage when the project was opened
    if (typeof window !== "undefined") {
      return localStorage.getItem("vn2-project-name") ?? "Untitled"
    }
    return "Untitled"
  })
  const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved">("idle")
  const lastSavedDataRef = useRef<string>("")
  const [showHelp, setShowHelp] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [activePanel, setActivePanel] = useState("scenes")
  const [showNodeSheet, setShowNodeSheet] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)

  // ── localStorage-first save system ────────────────────────────────────────
  // Keys:
  //   vn2-scenes / vn2-nbs / vn2-chars / vn2-vars  — live tree (written by useTree on every change)
  //   vn2-project-name                              — project name
  //   inkgraph-guest-projects                       — guest project list (includes data)
  //   vn2-pending-{projectId}                       — logged-in: unsync'd snapshot waiting for DB

  const PENDING_KEY = project ? `vn2-pending-${project.id}` : null

  // Initialise lastSavedDataRef — the DB-synced snapshot for logged-in,
  // or the last localStorage write for guests
  if (!lastSavedDataRef.current && initialData) {
    lastSavedDataRef.current = JSON.stringify({
      scenes: initialData.scenes ?? [],
      nodesByScene: initialData.nodesByScene ?? {},
      characters: initialData.characters ?? [],
      variables: initialData.variables ?? [],
    })
  }

  // Current serialised tree — recomputed every render
  const currentDataStr = JSON.stringify({
    scenes: tree.scenes,
    nodesByScene: tree.nodesByScene ?? {},
    characters: tree.characters,
    variables: tree.variables,
  })

  // ── On mount: check for pending unsync'd data (logged-in only) ─────────────
  useEffect(() => {
    if (!project || !PENDING_KEY) return
    const pending = localStorage.getItem(PENDING_KEY)
    if (!pending) return
    // Unsync'd data found from a previous session — push to DB silently
    try {
      const snap = JSON.parse(pending) as { data: string; name: string; ts: number }
      const form = new FormData()
      form.set("intent", "autosave")
      form.set("id", project.id)
      form.set("name", snap.name ?? projectName)
      form.set("description", project.description ?? "")
      form.set("data", snap.data)
      fetcher.submit(form, { method: "post" })
      showToast("Syncing unsaved changes from your last session…", "loading")
    } catch { /* corrupted — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setIsMobile(window.innerWidth < 700)
    function check() { setIsMobile(window.innerWidth < 700) }
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Mark dirty when tree data changes
  useEffect(() => {
    if (lastSavedDataRef.current && currentDataStr !== lastSavedDataRef.current) {
      setSaveStatus((s) => (s === "saving" ? s : "dirty"))
    }
  }, [currentDataStr])

  // ── Write to localStorage on every tree change (both guest and logged-in) ──
  useEffect(() => {
    if (typeof window === "undefined") return

    // Always keep vn2-project-name current
    localStorage.setItem("vn2-project-name", projectName)

    if (!project) {
      // Guest: also update inkgraph-guest-projects entry
      try {
        const GUEST_KEY = "inkgraph-guest-projects"
        const stored = JSON.parse(localStorage.getItem(GUEST_KEY) ?? "[]") as Array<{
          id: string; name: string; data: string; lastOpenedAt: number; updatedAt: number;
          userId: string; description: string; createdAt: number
        }>
        const now = Math.floor(Date.now() / 1000)
        const sorted = [...stored].sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))
        if (sorted.length > 0) {
          const updated = stored.map((p) =>
            p.id === sorted[0].id
              ? { ...p, name: projectName, data: currentDataStr, updatedAt: now }
              : p
          )
          localStorage.setItem(GUEST_KEY, JSON.stringify(updated))
        }
      } catch { /* noop */ }
      // Guest has no DB — mark as saved immediately
      lastSavedDataRef.current = currentDataStr
      setSaveStatus("saved")
      const t = setTimeout(() => setSaveStatus("idle"), 1500)
      return () => clearTimeout(t)
    }

    // Logged-in: write pending snapshot so a hard close won't lose data
    if (PENDING_KEY) {
      try {
        localStorage.setItem(PENDING_KEY, JSON.stringify({
          data: currentDataStr,
          name: projectName,
          ts: Date.now(),
        }))
      } catch { /* noop */ }
    }
  }, [currentDataStr, projectName])

  const prevSel = useRef<string | null>(null)
  useEffect(() => {
    if (isMobile && sel && sel !== prevSel.current) setShowNodeSheet(true)
    prevSel.current = sel
  }, [sel, isMobile])

  // ── doSave: for logged-in users, syncs pending localStorage data to DB ──────
  function doSave() {
    if (!project) return // guests are already saved continuously above
    const form = new FormData()
    form.set("intent", "autosave")
    form.set("id", project.id)
    form.set("name", projectName)
    form.set("description", project.description ?? "")
    form.set("data", currentDataStr)
    lastSavedDataRef.current = currentDataStr
    fetcher.submit(form, { method: "post" })
    setSaveStatus("saving")
  }

  // Rename-only save
  function doRenameSave() {
    localStorage.setItem("vn2-project-name", projectName)
    if (!project) return
    const form = new FormData()
    form.set("intent", "rename")
    form.set("id", project.id)
    form.set("name", projectName)
    fetcher.submit(form, { method: "post" })
  }

  // Auto-sync to DB every 60s for logged-in users (localStorage is the real-time backup)
  const doSaveRef = useRef(doSave)
  useEffect(() => { doSaveRef.current = doSave })
  useEffect(() => {
    if (!project) return // guests don't need DB sync
    const interval = setInterval(() => { doSaveRef.current() }, 60_000)
    return () => clearInterval(interval)
  }, [project?.id ?? null])

  // Warn on hard close if pending DB sync
  useEffect(() => {
    function onUnload(e: BeforeUnloadEvent) {
      if (project && saveStatus === "dirty") {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [project, saveStatus])

  // Handle DB save results — clear pending key on success
  useEffect(() => {
    if (!fetcher.data) return
    if ("ok" in fetcher.data && fetcher.data.ok) {
      if (PENDING_KEY) localStorage.removeItem(PENDING_KEY)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } else if ("error" in fetcher.data && fetcher.data.error) {
      setSaveStatus("idle")
      showToast(`Could not sync to server: ${fetcher.data.error}`, "error")
    }
  }, [fetcher.data])

  function handleMovement(e: KeyboardEvent) {
    if (!sel) return
    if (e.key === "ArrowLeft") movNode(sel, -10, 0)
    else if (e.key === "ArrowRight") movNode(sel, 10, 0)
    else if (e.key === "ArrowUp") {
      e.preventDefault()
      movNode(sel, 0, -10)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      movNode(sel, 0, 10)
    }
  }

  function handleTab(e: KeyboardEvent) {
    e.preventDefault()
    const ids = Object.keys(nodes)
    const idx = ids.indexOf(sel ?? "")
    setSel(ids[(idx + 1) % ids.length])
  }

  function handleEscape() {
    setShowHelp(false)
    setShowNodeSheet(false)
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: keyboard handler needs all cases
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      switch (e.key) {
        case "n":
        case "N":
          if (sel) addNodeSmart(sel)
          break
        case "c":
        case "C":
          if (sel) addChoice(sel)
          break
        case "Delete":
          if (sel && sel !== rootId) delNode(sel)
          break
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
          handleMovement(e)
          break
        case "Home":
          if (rootId && nodes[rootId]) setSel(rootId)
          break
        case "Tab":
          handleTab(e)
          break
        case "z":
        case "Z":
          undo()
          break
        case "?":
          setShowHelp((h) => !h)
          break
        case "Escape":
          handleEscape()
          break
        default:
          break
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, nodes, addNode, addNodeSmart, addChoice, delNode, movNode, rootId, setSel, undo]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleKey])

  function togglePanel(p: string) {
    if (activePanel === p && expanded) {
      setExpanded(false)
    } else {
      setActivePanel(p)
      setExpanded(true)
    }
  }

  function railBtn(active: boolean): React.CSSProperties {
    return {
      width: 36,
      height: 36,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: active ? "#141422" : "transparent",
      border: "none",
      color: active ? C.accent : C.textMuted,
      cursor: "pointer",
      borderRadius: 4,
    }
  }

  function panelContent() {
    if (activePanel === "scenes") return <ScenesPanel tree={tree} />
    if (activePanel === "characters") return <CharactersPanel tree={tree} />
    if (activePanel === "variables") return <VariablesPanel tree={tree} />
    if (activePanel === "export") return <ExportPanel tree={tree} />
    return null
  }

  const initials = user ? (user.name || user.email).slice(0, 2).toUpperCase() : "??"

  // Ko-fi nudge after first 2 nodes created
  const nodeCount = Object.keys(nodes).length
  const [kofiNudgeDismissed, setKofiNudgeDismissed] = useState(false)
  const showKofiNudge = nodeCount >= 2 && !kofiNudgeDismissed

  const { toasts, show: showToast, dismiss: dismissToast } = useToast()

  // Guests are redirected to /projects by the loader — no guest modal needed here
  const notice = null

  // ── Mobile ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    const barActions: BarAction[] = [
      {
        label: "+ Node",
        color: sel ? C.accent : C.textMuted,
        action: () => {
          if (sel) addNodeSmart(sel)
        },
      },
      {
        label: "⑂ Choice",
        color: sel ? C.warn : C.textMuted,
        action: () => {
          if (sel) {
            tree.upd(sel, { nextId: null })
            tree.addChoice(sel)
          }
        },
      },
      {
        label: "✎ Edit",
        color: sel ? C.accent : C.textMuted,
        action: () => {
          if (sel) setShowNodeSheet(true)
        },
        active: showNodeSheet && !!sel,
      },
      {
        label: "✕ Del",
        color: sel && sel !== rootId ? C.danger : C.textMuted,
        action: () => {
          if (sel && sel !== rootId) {
            delNode(sel)
            setShowNodeSheet(false)
          }
        },
      },
    ]

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          width: "100vw",
          overflow: "hidden",
          background: C.bg,
          fontFamily: "'Inter',system-ui,sans-serif",
          color: C.text,
        }}
      >
        {notice}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
        {showKofiNudge && <KofiNudge onDismiss={() => setKofiNudgeDismissed(true)} />}

        <div
          style={{
            height: 48,
            flexShrink: 0,
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 2,
            paddingInline: 8,
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.accent,
              fontFamily: "monospace",
              letterSpacing: 1,
              marginRight: 4,
            }}
          >
            IG
          </span>
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => togglePanel(p.id)}
              style={{ ...railBtn(activePanel === p.id && expanded), width: 38, height: 38 }}
            >
              {p.icon}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => navigate("/account")}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `linear-gradient(135deg,${C.accent},#a855f7)`,
              border: "none",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              marginRight: 2,
              letterSpacing: 0.5,
              flexShrink: 0,
            }}
          >
            {initials}
          </button>
          <button
            type="button"
            style={{ ...railBtn(false), color: "#ff5f5f", width: 38, height: 38 }}
            onClick={() =>
              window.open("https://ko-fi.com/oslavdevelopment#", "_blank", "noopener,noreferrer")
            }
            aria-label="Support on Ko-fi"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 8h1a4 4 0 0 1 0 8h-1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <DownloadBtn mobile />
          <button
            type="button"
            style={{ ...railBtn(showHelp), width: 38, height: 38 }}
            onClick={() => setShowHelp((h) => !h)}
            aria-label="Hotkeys"
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 17v-1M12 13c0-2 3-2 3-4a3 3 0 1 0-6 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {expanded && (
          <>
            <div
              style={{
                position: "fixed",
                top: 48,
                left: 0,
                bottom: 0,
                width: "80vw",
                maxWidth: 300,
                background: C.surface2,
                borderRight: `1px solid ${C.border}`,
                display: "flex",
                flexDirection: "column",
                zIndex: 20,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: C.textMuted,
                  letterSpacing: 1,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {PANELS.find((p) => p.id === activePanel)?.label.toUpperCase()}
                <IBtn style={{ fontSize: 18, color: "#444" }} onClick={() => setExpanded(false)}>
                  ×
                </IBtn>
              </div>
              {panelContent()}
            </div>
            <div
              role="presentation"
              style={{
                position: "fixed",
                inset: 0,
                top: 48,
                background: "rgba(0,0,0,0.5)",
                zIndex: 15,
              }}
              onClick={() => setExpanded(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setExpanded(false)
              }}
            />
          </>
        )}

        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Canvas tree={tree} viewRef={viewRef} />
          {showHelp && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(10,10,10,0.97)",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "12px 16px",
                zIndex: 50,
                minWidth: 190,
              }}
            >
              <div
                style={{
                  color: C.textMuted,
                  fontSize: 9,
                  fontFamily: "monospace",
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                HOTKEYS
              </div>
              {HOTKEYS.map(([k, d]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 5,
                    fontSize: 11,
                  }}
                >
                  <code
                    style={{
                      color: C.accent,
                      background: "#141422",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  >
                    {k}
                  </code>
                  <span style={{ color: C.textDim }}>{d}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            height: 52,
            flexShrink: 0,
            background: C.surface,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "stretch",
          }}
        >
          {barActions.map(({ label, color, action, active }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              style={{
                flex: 1,
                background: active ? "#141422" : "transparent",
                border: "none",
                borderRight: `1px solid ${C.border}`,
                color,
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {showNodeSheet && sel && (
          <>
            <div
              role="presentation"
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
              onClick={() => setShowNodeSheet(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowNodeSheet(false)
              }}
            />
            <div
              style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                height: "70dvh",
                background: "#111",
                borderTop: `2px solid ${C.border}`,
                borderRadius: "14px 14px 0 0",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${C.border}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: C.textMuted,
                    letterSpacing: 1,
                  }}
                >
                  NODE EDITOR
                </span>
                <IBtn
                  style={{ fontSize: 20, color: C.textMuted }}
                  onClick={() => setShowNodeSheet(false)}
                >
                  ×
                </IBtn>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <NodePanel node={sel ? nodes[sel] : undefined} tree={tree} />
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Desktop ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: C.bg,
        fontFamily: "'Inter',system-ui,sans-serif",
        color: C.text,
      }}
    >
      {notice}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
      {showKofiNudge && <KofiNudge onDismiss={() => setKofiNudgeDismissed(true)} />}

      {/* Top bar */}
      <div
        style={{
          height: 38,
          flexShrink: 0,
          background: "#0d0d0d",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          paddingInline: 12,
          gap: 8,
          zIndex: 5,
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (project && saveStatus === "dirty") {
              // Logged-in with unsynced data — confirm before leaving
              if (!window.confirm("You have changes not synced to the server. Leave anyway? (Your work is saved locally and will sync next time you open this project.)")) return
            }
            navigate("/projects")
          }}
          style={{
            background: "transparent",
            border: "none",
            color: C.textMuted,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
            padding: "0 4px 0 0",
          }}
          aria-label="Back to projects"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19 12H5M5 12l7-7M5 12l7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Projects
        </button>
        <span style={{ color: C.border, fontSize: 14 }}>/</span>
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onBlur={doRenameSave}
          aria-label="Project name"
          style={{
            background: "transparent",
            border: "none",
            color: C.text,
            fontSize: 13,
            fontWeight: 500,
            outline: "none",
            fontFamily: "inherit",
            minWidth: 0,
            flex: "0 1 200px",
          }}
          placeholder="Untitled"
        />
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={doSave}
          disabled={!project || saveStatus === "saving" || saveStatus === "saved" || saveStatus === "idle"}
          title={!project ? "Saved to local storage" : saveStatus === "dirty" ? "Click to sync to server" : saveStatus === "saving" ? "Syncing…" : "Synced to server"}
          style={{
            background: saveStatus === "saved"
              ? "#0a2a0a"
              : saveStatus === "dirty"
              ? C.accent
              : "transparent",
            border: `1px solid ${saveStatus === "saved" ? C.success : saveStatus === "dirty" ? C.accent : C.border}`,
            borderRadius: 5,
            color: saveStatus === "saved" ? C.success : saveStatus === "dirty" ? "#fff" : C.textMuted,
            fontSize: 11,
            fontWeight: 700,
            padding: "5px 12px",
            cursor: saveStatus === "dirty" ? "pointer" : "default",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s ease",
            opacity: saveStatus === "saving" ? 0.6 : 1,
            boxShadow: saveStatus === "saved" ? "0 0 8px rgba(34,197,94,0.25)" : saveStatus === "dirty" ? "0 0 8px rgba(99,102,241,0.3)" : "none",
          }}
        >
          {saveStatus === "saved" ? (
            <>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved
            </>
          ) : saveStatus === "saving" ? (
            "Saving…"
          ) : saveStatus === "dirty" ? (
            "Save"
          ) : (
            <>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate("/simulator")}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.textMuted,
            fontSize: 10,
            fontWeight: 600,
            padding: "3px 9px",
            cursor: "pointer",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
          title="Open dialogue simulator"
        >
          <span>🎭</span> Simulate
        </button>
        <button
          type="button"
          onClick={() => navigate(user ? "/account" : "/login?from=/editor")}
          style={{
            background: user ? `linear-gradient(135deg,${C.accent},#a855f7)` : "transparent",
            border: user ? "none" : `1px solid ${C.border}`,
            borderRadius: 4,
            color: user ? "#fff" : C.textMuted,
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: "monospace",
            letterSpacing: 0.3,
          }}
        >
          {user ? user.name.split(" ")[0] : "Sign in"}
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Rail */}
        <div
          style={{
            width: 44,
            background: C.surface,
            borderRight: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px 0",
            gap: 2,
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: C.accent,
              marginBottom: 8,
              fontFamily: "monospace",
              letterSpacing: 1,
            }}
          >
            IG
          </div>
          {PANELS.map((p) => (
            <Tooltip key={p.id} label={p.label}>
              <button
                type="button"
                style={railBtn(activePanel === p.id && expanded)}
                onClick={() => togglePanel(p.id)}
              >
                {p.icon}
              </button>
            </Tooltip>
          ))}
          <div style={{ flex: 1 }} />
          <Tooltip label="User Guide">
            <button
              type="button"
              style={railBtn(showGuide)}
              onClick={() => setShowGuide((h) => !h)}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 19V6a2 2 0 0 1 2-2h13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M4 19a2 2 0 0 0 2 2h13V4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M9 9h6M9 13h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip label="Support on Ko-fi ☕">
            <button
              type="button"
              style={{ ...railBtn(false), color: "#ff5f5f" }}
              onClick={() =>
                window.open("https://ko-fi.com/oslavdevelopment#", "_blank", "noopener,noreferrer")
              }
              aria-label="Support on Ko-fi"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M18 8h1a4 4 0 0 1 0 8h-1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip label="Download desktop app">
            <DownloadBtn />
          </Tooltip>
          <Tooltip label="Hotkeys (?)">
            <button type="button" style={railBtn(showHelp)} onClick={() => setShowHelp((h) => !h)}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 17v-1M12 13c0-2 3-2 3-4a3 3 0 1 0-6 0"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </Tooltip>
        </div>

        {/* Sidebar */}
        {expanded && (
          <div
            style={{
              width: 240,
              background: C.surface2,
              borderRight: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: `1px solid ${C.border}`,
                fontSize: 9,
                fontFamily: "monospace",
                color: C.textMuted,
                letterSpacing: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {PANELS.find((p) => p.id === activePanel)?.label.toUpperCase()}
              <IBtn style={{ fontSize: 15, color: "#333" }} onClick={() => setExpanded(false)}>
                ‹
              </IBtn>
            </div>
            {panelContent()}
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <Canvas tree={tree} viewRef={viewRef} />
          {showHelp && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                background: "rgba(10,10,10,0.96)",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "12px 16px",
                minWidth: 210,
                zIndex: 50,
              }}
            >
              <div
                style={{
                  color: C.textMuted,
                  fontSize: 9,
                  fontFamily: "monospace",
                  marginBottom: 8,
                  letterSpacing: 1,
                }}
              >
                HOTKEYS
              </div>
              {HOTKEYS.map(([k, d]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    marginBottom: 5,
                    fontSize: 11,
                  }}
                >
                  <code
                    style={{
                      color: C.accent,
                      background: "#141422",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  >
                    {k}
                  </code>
                  <span style={{ color: C.textDim }}>{d}</span>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              bottom: 130,
              left: 12,
              fontSize: 10,
              fontFamily: "monospace",
              color: "#1e1e1e",
            }}
          >
            Drag ports · Click arrow to unlink
          </div>
        </div>

        {/* Node editor panel */}
        <div
          style={{
            width: 264,
            background: C.surface,
            borderLeft: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: "9px 12px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{ fontSize: 9, fontFamily: "monospace", color: C.textMuted, letterSpacing: 1 }}
            >
              NODE EDITOR
            </span>
            <button
              type="button"
              style={{
                background: C.accent,
                border: "none",
                borderRadius: 3,
                color: "#fff",
                fontSize: 10,
                padding: "3px 9px",
                cursor: "pointer",
                fontFamily: "monospace",
              }}
              onClick={() => sel && addNodeSmart(sel)}
            >
              + Node
            </button>
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: 3,
                color: "#444",
                fontSize: 10,
                padding: "3px 9px",
                cursor: "pointer",
                fontFamily: "monospace",
                title: "Undo (Z)",
              }}
              onClick={undo}
              title="Undo (Z)"
            >
              ↩ Undo
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <NodePanel node={sel ? nodes[sel] : undefined} tree={tree} />
          </div>
          <div
            style={{
              padding: "5px 12px",
              borderTop: `1px solid ${C.border}`,
              fontSize: 9,
              fontFamily: "monospace",
              color: "#222",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>auto-saved</span>
            <span style={{ color: "#1a3a1a" }}>server-synced</span>
          </div>
        </div>
      </div>
    </div>
  )
}