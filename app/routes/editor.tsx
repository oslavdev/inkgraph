import { useCallback, useEffect, useRef, useState } from "react"
import { useFetcher, useLoaderData, useNavigate } from "react-router"
import {
  C,
  Canvas,
  CharactersPanel,
  ExportPanel,
  GuideModal,
  HOTKEYS,
  IBtn,
  LocalStorageNotice,
  NodePanel,
  PANELS,
  ProfileModal,
  ScenesPanel,
  Tooltip,
  VariablesPanel,
  useTree,
} from "../components/editor-core"
import { createProject, deleteProject, listProjects, saveProject } from "../server/projects.server"
import type { Project } from "../server/schema.server"
import { requireUser } from "../server/session.server"
import type { Route } from "./+types/editor"

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request)
  const projects = await listProjects(user.id)
  return { user, projects }
}

// ─── Action ───────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request)
  const form = await request.formData()
  const intent = form.get("intent") as string

  if (intent === "save") {
    const id = form.get("id") as string | null
    const name = (form.get("name") as string) || "Untitled"
    const data = JSON.parse(form.get("data") as string)
    if (id) {
      await saveProject(id, user.id, name, data)
      return { ok: true, id }
    }
    const project = await createProject(user.id, name, data)
    return { ok: true, id: project.id }
  }

  if (intent === "delete") {
    const id = form.get("id") as string
    await deleteProject(id, user.id)
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

// ─── Editor component ─────────────────────────────────────────────────────────

export default function EditorRoute() {
  const navigate = useNavigate()
  const { user, projects } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<typeof action>()

  // tree must be declared before any hook that references it
  const tree = useTree()
  const { nodes, sel, setSel, addNode, addChoice, delNode, movNode, rootId } = tree

  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState("Untitled")
  const [saveMsg, setSaveMsg] = useState("")
  const [showHelp, setShowHelp] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [showLsNotice, setShowLsNotice] = useState(true)
  const [expanded, setExpanded] = useState(true)
  const [activePanel, setActivePanel] = useState("scenes")
  const [showNodeSheet, setShowNodeSheet] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const viewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMobile(window.innerWidth < 700)
    function check() {
      setIsMobile(window.innerWidth < 700)
    }
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const prevSel = useRef<string | null>(null)
  useEffect(() => {
    if (isMobile && sel && sel !== prevSel.current) setShowNodeSheet(true)
    prevSel.current = sel
  }, [sel, isMobile])

  function doSave() {
    const sd = tree.nodesByScene ?? {}
    const data = {
      scenes: tree.scenes,
      nodesByScene: sd,
      characters: tree.characters,
      variables: tree.variables,
    }
    const form = new FormData()
    form.set("intent", "save")
    form.set("name", projectName)
    form.set("data", JSON.stringify(data))
    if (projectId) form.set("id", projectId)
    fetcher.submit(form, { method: "post" })
  }

  // Auto-save every 30 seconds when a project is open
  useEffect(() => {
    const interval = setInterval(() => {
      if (projectId) doSave()
    }, 30_000)
    return () => clearInterval(interval)
    // doSave is stable enough; tree is intentionally excluded to avoid constant re-subscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, projectName])

  // When save returns a new id, store it
  useEffect(() => {
    if (
      fetcher.data &&
      "ok" in fetcher.data &&
      fetcher.data.ok &&
      "id" in fetcher.data &&
      fetcher.data.id
    ) {
      setProjectId(fetcher.data.id as string)
      setSaveMsg("Saved")
      setTimeout(() => setSaveMsg(""), 2000)
    }
  }, [fetcher.data])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "n" || e.key === "N") {
        if (sel) addNode(sel)
      } else if (e.key === "c" || e.key === "C") {
        if (sel) addChoice(sel)
      } else if (e.key === "Delete") {
        if (sel && sel !== rootId) delNode(sel)
      } else if (e.key === "ArrowLeft") {
        if (sel) movNode(sel, -10, 0)
      } else if (e.key === "ArrowRight") {
        if (sel) movNode(sel, 10, 0)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        if (sel) movNode(sel, 0, -10)
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        if (sel) movNode(sel, 0, 10)
      } else if (e.key === "Tab") {
        e.preventDefault()
        const ids = Object.keys(nodes)
        const idx = ids.indexOf(sel ?? "")
        setSel(ids[(idx + 1) % ids.length])
      } else if (e.key === "?") {
        setShowHelp((h) => !h)
      } else if (e.key === "Escape") {
        setShowHelp(false)
        setShowLsNotice(false)
        setShowNodeSheet(false)
        setShowProfile(false)
      }
    },
    [sel, nodes, addNode, addChoice, delNode, movNode, rootId, setSel]
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

  function loadProject(p: Project) {
    setProjectId(p.id)
    setProjectName(p.name)
    const d = JSON.parse(p.data) as {
      scenes?: unknown
      nodesByScene?: unknown
      characters?: unknown
      variables?: unknown
    }
    if (d.scenes) localStorage.setItem("vn2-scenes", JSON.stringify(d.scenes))
    if (d.nodesByScene) localStorage.setItem("vn2-nbs", JSON.stringify(d.nodesByScene))
    if (d.characters) localStorage.setItem("vn2-chars", JSON.stringify(d.characters))
    if (d.variables) localStorage.setItem("vn2-vars", JSON.stringify(d.variables))
    window.location.reload()
  }

  const initials = (user.name || user.email).slice(0, 2).toUpperCase()

  const notice = showLsNotice && (
    <LocalStorageNotice
      onClose={() => setShowLsNotice(false)}
      onLogin={() => setShowLsNotice(false)}
      onRegister={() => setShowLsNotice(false)}
    />
  )

  // ── Mobile ──────────────────────────────────────────────────────────────────

  if (isMobile) {
    interface BarAction {
      label: string
      color: string
      action: () => void
      active?: boolean
    }

    const barActions: BarAction[] = [
      {
        label: "+ Node",
        color: sel ? C.accent : C.textMuted,
        action: () => {
          if (sel) addNode(sel)
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
        {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
        {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

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
            onClick={() => setShowProfile(true)}
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
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}

      {/* Save bar */}
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
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
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
            flex: "0 1 240px",
          }}
          placeholder="Untitled"
        />
        <div style={{ flex: 1 }} />
        {saveMsg && (
          <span style={{ fontSize: 11, color: C.success, fontFamily: "monospace" }}>{saveMsg}</span>
        )}
        {fetcher.state === "submitting" && (
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>Saving…</span>
        )}
        <select
          value={projectId ?? ""}
          aria-label="Open project"
          onChange={(e) => {
            const id = e.target.value
            if (!id) {
              setProjectId(null)
              setProjectName("Untitled")
              return
            }
            const p = projects.find((x) => x.id === id)
            if (p) loadProject(p)
          }}
          style={{
            background: "#111",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.textDim,
            fontSize: 11,
            padding: "3px 6px",
            fontFamily: "monospace",
            outline: "none",
            maxWidth: 180,
          }}
        >
          <option value="">— new project —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={doSave}
          style={{
            background: C.accent,
            border: "none",
            borderRadius: 4,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 12px",
            cursor: "pointer",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
          }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => navigate("/account")}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            color: C.textMuted,
            fontSize: 11,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          {user.name.split(" ")[0]}
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
          <Tooltip label="My Profile">
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: `linear-gradient(135deg,${C.accent},#a855f7)`,
                border: "none",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 2,
                letterSpacing: 0.5,
              }}
            >
              {initials}
            </button>
          </Tooltip>
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
              onClick={() => sel && addNode(sel)}
            >
              + Node
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
            <span style={{ color: "#1a3a1a" }}>{projectId ? "server-synced" : "localStorage"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
