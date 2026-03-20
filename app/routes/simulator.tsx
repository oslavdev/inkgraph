import { useEffect, useRef, useState } from "react"
import { redirect, useLoaderData, useNavigate } from "react-router"
import { listProjects } from "../server/projects.server"
import { getSession } from "../server/session.server"

const C = {
  bg: "#0a0a0a",
  surface: "#0f0f0f",
  surface2: "#111",
  border: "#1e1e1e",
  accent: "#6366f1",
  text: "#e5e5e5",
  muted: "#555",
  dim: "#888",
  success: "#22c55e",
  warn: "#f59e0b",
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Choice {
  id: string
  label: string
  nextId: string | null
  conditions?: unknown[]
}

interface Node {
  id: string
  x: number
  y: number
  speaker: string
  characterId: string | null
  text: string
  choices: Choice[]
  nextId: string | null
  tag: string
}

interface SceneData {
  root: string
  nodes: Record<string, Node>
}

interface Scene {
  id: string
  name: string
  description: string
}

interface Character {
  id: string
  name: string
  color: string
}

interface ProjectData {
  scenes: Scene[]
  nodesByScene: Record<string, SceneData>
  characters: Character[]
  variables: unknown[]
}

interface Project {
  id: string
  name: string
  data: string
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request)
  if (!session) throw redirect("/login")
  const projects = await listProjects(session.user.id)
  return { projects }
}

// ─── Human silhouette SVG ─────────────────────────────────────────────────────

function Silhouette({ color = "#444", size = 80 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="40" cy="22" r="13" fill={color} opacity="0.7" />
      <path d="M14 72c0-14.36 11.64-26 26-26h0c14.36 0 26 11.64 26 26" fill={color} opacity="0.7" />
    </svg>
  )
}

// ─── Typewriter text ──────────────────────────────────────────────────────────

function TypewriterText({
  text,
  onDone,
  speed = 28,
}: {
  text: string
  onDone: () => void
  speed?: number
}) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const indexRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0

    function tick() {
      if (indexRef.current >= text.length) {
        setDone(true)
        onDone()
        return
      }
      setDisplayed(text.slice(0, indexRef.current + 1))
      indexRef.current += 1
      timerRef.current = setTimeout(tick, speed)
    }
    timerRef.current = setTimeout(tick, speed)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, speed, onDone])

  function skip() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setDisplayed(text)
    setDone(true)
    onDone()
  }

  return (
    <div
      onClick={!done ? skip : undefined}
      onKeyDown={(e) => {
        if (!done && (e.key === "Enter" || e.key === " ")) {
          skip()
        }
      }}
      style={{ cursor: done ? "default" : "pointer" }}
    >
      <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{displayed}</span>
      {!done && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            background: C.accent,
            marginLeft: 2,
            verticalAlign: "middle",
            animation: "blink 0.7s step-end infinite",
          }}
        />
      )}
    </div>
  )
}

// ─── Main Simulator ───────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const { projects } = useLoaderData<typeof loader>()
  const navigate = useNavigate()

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedSceneId, setSelectedSceneId] = useState<string>("")
  const [started, setStarted] = useState(false)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)
  const [textDone, setTextDone] = useState(false)
  const [log, setLog] = useState<Array<{ speaker: string; text: string; color?: string }>>([])
  const [choiceLog, setChoiceLog] = useState<Array<{ choice: string; speaker: string }>>([])
  const [ended, setEnded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const projectData: ProjectData | null = (() => {
    if (!selectedProject) return null
    try {
      return JSON.parse(selectedProject.data)
    } catch {
      return null
    }
  })()

  const scenes = projectData?.scenes ?? []
  const characters = projectData?.characters ?? []
  const sceneData: SceneData | null =
    projectData && selectedSceneId ? (projectData.nodesByScene[selectedSceneId] ?? null) : null
  const nodes = sceneData?.nodes ?? {}
  const currentNode: Node | null = currentNodeId ? (nodes[currentNodeId] ?? null) : null

  function getCharacter(id: string | null): Character | undefined {
    return characters.find((c) => c.id === id)
  }

  function start() {
    if (!sceneData) return
    setCurrentNodeId(sceneData.root)
    setLog([])
    setChoiceLog([])
    setEnded(false)
    setTextDone(false)
    setStarted(true)
  }

  function advance() {
    if (!currentNode) return
    if (currentNode.choices.length === 0) {
      if (currentNode.nextId) {
        addToLog(currentNode)
        setCurrentNodeId(currentNode.nextId)
        setTextDone(false)
      } else {
        addToLog(currentNode)
        setCurrentNodeId(null)
        setEnded(true)
      }
    }
  }

  function addToLog(node: Node) {
    const char = getCharacter(node.characterId)
    setLog((l) => [
      ...l,
      { speaker: node.speaker || char?.name || "Narrator", text: node.text, color: char?.color },
    ])
  }

  function pickChoice(choice: Choice) {
    if (!currentNode) return
    addToLog(currentNode)
    const char = getCharacter(currentNode.characterId)
    setChoiceLog((cl) => [
      ...cl,
      { choice: choice.label, speaker: currentNode.speaker || char?.name || "Player" },
    ])
    if (choice.nextId) {
      setCurrentNodeId(choice.nextId)
      setTextDone(false)
    } else {
      setCurrentNodeId(null)
      setEnded(true)
    }
  }

  function reset() {
    setStarted(false)
    setCurrentNodeId(null)
    setLog([])
    setChoiceLog([])
    setEnded(false)
    setTextDone(false)
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [log, currentNodeId])

  const char = currentNode ? getCharacter(currentNode.characterId) : undefined
  const speakerName = currentNode?.speaker || char?.name || (currentNode ? "Narrator" : "")
  const speakerColor = char?.color ?? C.muted

  // ── Project/scene picker ──────────────────────────────────────────────────

  if (!started) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          fontFamily: "'Inter',system-ui,sans-serif",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <style>{"@keyframes blink { 50% { opacity: 0 } }"}</style>
        <nav
          style={{
            height: 52,
            background: C.surface,
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            paddingInline: "clamp(16px,4vw,48px)",
            gap: 16,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/projects")}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
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
          <span style={{ color: C.border }}>|</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.accent,
              fontFamily: "monospace",
              letterSpacing: 2,
            }}
          >
            SIMULATOR
          </span>
        </nav>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
          }}
        >
          <div style={{ width: "min(480px, 100%)" }}>
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎭</div>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: "-0.5px",
                }}
              >
                Dialogue Simulator
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: C.muted, lineHeight: 1.7 }}>
                Play through any scene exactly as a player would experience it.
              </p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="sim-project"
                style={{
                  display: "block",
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: C.muted,
                  letterSpacing: 0.5,
                  marginBottom: 6,
                }}
              >
                PROJECT
              </label>
              <select
                id="sim-project"
                value={selectedProject?.id ?? ""}
                onChange={(e) => {
                  const p = projects.find((x) => x.id === e.target.value) ?? null
                  setSelectedProject(p as Project | null)
                  setSelectedSceneId("")
                }}
                style={{
                  width: "100%",
                  background: "#0d0d0d",
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 14,
                  padding: "10px 12px",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              >
                <option value="">Choose a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProject && scenes.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <label
                  htmlFor="sim-scene"
                  style={{
                    display: "block",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: C.muted,
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  SCENE
                </label>
                <select
                  id="sim-scene"
                  value={selectedSceneId}
                  onChange={(e) => setSelectedSceneId(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0d0d0d",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    fontSize: 14,
                    padding: "10px 12px",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                >
                  <option value="">Choose a scene…</option>
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={start}
              disabled={!selectedSceneId || !sceneData}
              style={{
                width: "100%",
                background: selectedSceneId && sceneData ? C.accent : "#1a1a2e",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                padding: "14px",
                cursor: selectedSceneId && sceneData ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                opacity: selectedSceneId && sceneData ? 1 : 0.4,
                letterSpacing: 0.3,
              }}
            >
              Start simulation →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Ended screen ──────────────────────────────────────────────────────────

  if (ended) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          fontFamily: "'Inter',system-ui,sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <style>{"@keyframes blink { 50% { opacity: 0 } }"}</style>
        <div style={{ width: "min(560px, 100%)" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎬</div>
            <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700 }}>Scene complete</h2>
            <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
              {scenes.find((s) => s.id === selectedSceneId)?.name ?? ""}
            </p>
          </div>

          {choiceLog.length > 0 && (
            <div
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: C.muted,
                  letterSpacing: 1,
                }}
              >
                CHOICES MADE
              </div>
              {choiceLog.map((cl, i) => (
                <div
                  key={`choice-${i}-${cl.choice}`}
                  style={{
                    padding: "10px 16px",
                    borderBottom: i < choiceLog.length - 1 ? `1px solid ${C.border}` : "none",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{ color: C.warn, fontFamily: "monospace", flexShrink: 0, marginTop: 1 }}
                  >
                    ⑂
                  </span>
                  <div>
                    <div style={{ color: C.text }}>{cl.choice}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{cl.speaker}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 24,
              maxHeight: 260,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${C.border}`,
                fontSize: 10,
                fontFamily: "monospace",
                color: C.muted,
                letterSpacing: 1,
              }}
            >
              FULL DIALOGUE LOG
            </div>
            {log.map((entry, i) => (
              <div
                key={`log-${i}-${entry.speaker}`}
                style={{
                  padding: "8px 16px",
                  borderBottom: i < log.length - 1 ? "1px solid #151515" : "none",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    color: entry.color ?? C.accent,
                    fontWeight: 600,
                    marginRight: 8,
                    fontFamily: "monospace",
                  }}
                >
                  {entry.speaker}:
                </span>
                <span style={{ color: C.dim }}>{entry.text || "(no text)"}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={start}
              style={{
                flex: 1,
                background: C.accent,
                border: "none",
                borderRadius: 7,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Replay scene
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                color: C.muted,
                fontSize: 13,
                padding: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Choose different scene
            </button>
            <button
              type="button"
              onClick={() => navigate("/projects")}
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                color: C.muted,
                fontSize: 13,
                padding: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
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
              Project list
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Active simulation ─────────────────────────────────────────────────────

  const hasChoices = currentNode && currentNode.choices.length > 0
  const isLinear = currentNode && !hasChoices

  return (
    <div
      style={{
        height: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter',system-ui,sans-serif",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes blink { 50% { opacity: 0 } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* Top bar */}
      <div
        style={{
          height: 44,
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          paddingInline: 16,
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={reset}
          style={{
            background: "none",
            border: "none",
            color: C.muted,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: "monospace",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M19 12H5M5 12l7-7M5 12l7 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <span style={{ color: C.border }}>|</span>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>
          {scenes.find((s) => s.id === selectedSceneId)?.name ?? ""}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace" }}>
          {Object.keys(nodes).length} nodes
        </span>
      </div>

      {/* Log of past dialogue */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px clamp(16px,5vw,80px)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {log.map((entry, i) => (
          <div
            key={`past-${entry.speaker}-${entry.text}`}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              opacity: 0.45,
              fontSize: 13,
            }}
          >
            <Silhouette color={entry.color ?? "#333"} size={32} />
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "monospace",
                  color: entry.color ?? C.muted,
                  marginBottom: 3,
                }}
              >
                {entry.speaker}
              </div>
              <div style={{ color: "#666", lineHeight: 1.6 }}>{entry.text || "(no text)"}</div>
            </div>
          </div>
        ))}

        {/* Current node */}
        {currentNode && (
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              animation: "fadeIn 0.25s ease",
              marginTop: log.length > 0 ? 12 : 0,
            }}
          >
            <Silhouette color={speakerColor} size={52} />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: speakerColor,
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                {speakerName}
              </div>
              <div
                style={{
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                  borderRadius: "4px 12px 12px 12px",
                  padding: "14px 18px",
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: C.text,
                  maxWidth: 560,
                }}
              >
                <TypewriterText
                  key={currentNode.id}
                  text={currentNode.text || "(no text)"}
                  onDone={() => setTextDone(true)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Choices / Next */}
      <div
        style={{
          background: C.surface,
          borderTop: `1px solid ${C.border}`,
          padding: "16px clamp(16px,5vw,80px)",
          flexShrink: 0,
        }}
      >
        {textDone && hasChoices && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              animation: "fadeIn 0.2s ease",
              maxWidth: 560,
            }}
          >
            <div style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, marginBottom: 4 }}>
              CHOOSE YOUR RESPONSE
            </div>
            {currentNode.choices.map((ch, i) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => pickChoice(ch)}
                style={{
                  background: "#0d0d1a",
                  border: "1px solid #2a2a5a",
                  borderRadius: 8,
                  color: C.text,
                  fontSize: 14,
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = C.accent
                  ;(e.currentTarget as HTMLButtonElement).style.background = "#111122"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a5a"
                  ;(e.currentTarget as HTMLButtonElement).style.background = "#0d0d1a"
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: "#1a1a3a",
                    border: "1px solid #3a3a7a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: C.accent,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {ch.label || "(no label)"}
                {!ch.nextId && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      color: C.muted,
                      fontFamily: "monospace",
                    }}
                  >
                    END
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {textDone && isLinear && (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={advance}
              style={{
                background: C.accent,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 28px",
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {currentNode?.nextId ? "Next →" : "End scene"}
            </button>
          </div>
        )}

        {!textDone && (
          <div style={{ fontSize: 11, color: "#333", fontFamily: "monospace" }}>
            Click text to skip…
          </div>
        )}
      </div>
    </div>
  )
}
