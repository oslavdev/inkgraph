import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { redirect, useNavigate } from "react-router"
import { NodePreview } from "../components/NodePreview"
import { getSession } from "../server/session.server"

// C is only used for accent colour in one place — inline it to avoid
// importing from the JSX-only editor-core module into a TSX route
const ACCENT = "#6366f1"

interface Blob {
  x: number
  y: number
  r: number
  hue: number
  sat: number
  speed: number
}

interface FeatureProps {
  icon: ReactNode
  title: string
  desc: string
}

function Feature({ icon, title, desc }: FeatureProps) {
  return (
    <div
      style={{
        padding: "28px 24px",
        background: "#0e0e0e",
        border: "1px solid #1e1e1e",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: "#141422",
          border: "1px solid #2a2a4a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#e5e5e5" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>{desc}</div>
    </div>
  )
}

const BLOBS: Blob[] = [
  { x: 0.22, y: 0.38, r: 0.6, hue: 255, sat: 80, speed: 0.00045 },
  { x: 0.78, y: 0.52, r: 0.52, hue: 280, sat: 70, speed: 0.0003 },
  { x: 0.5, y: 0.82, r: 0.42, hue: 240, sat: 60, speed: 0.0006 },
]

export async function loader({ request }: { request: Request }) {
  const session = await getSession(request)
  if (session) throw redirect("/editor")
  return null
}

export default function HomeRoute() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function onEnter() {
    navigate("/projects")
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf = 0
    let t = 0

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    resize()
    window.addEventListener("resize", resize)

    function draw() {
      if (!canvas || !ctx) return
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      BLOBS.forEach((b, i) => {
        const ox = Math.sin(t * b.speed * 1000 + i * 2.1) * 0.08
        const oy = Math.cos(t * b.speed * 800 + i * 1.7) * 0.06
        const cx = (b.x + ox) * W
        const cy = (b.y + oy) * H
        const r = b.r * Math.min(W, H)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        g.addColorStop(0, `hsla(${b.hue},${b.sat}%,55%,0.20)`)
        g.addColorStop(0.5, `hsla(${b.hue},${b.sat}%,45%,0.09)`)
        g.addColorStop(1, `hsla(${b.hue},${b.sat}%,35%,0.00)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      })
      t++
      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "'Inter',system-ui,sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* ── Nav ── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 56,
          display: "flex",
          alignItems: "center",
          paddingInline: "clamp(20px,5vw,80px)",
          borderBottom: "1px solid #141414",
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: ACCENT,
            fontFamily: "monospace",
            letterSpacing: 2,
          }}
        >
          INKGRAPH
        </span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onEnter}
          style={{
            background: ACCENT,
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 20px",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Open Editor
        </button>
      </nav>

      {/* ── Hero ── */}
      <section
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          paddingInline: "clamp(20px,5vw,80px)",
          paddingTop: 56,
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(99,102,241,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.035) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", maxWidth: 740, zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#0e0e1e",
              border: "1px solid #2a2a5a",
              borderRadius: 100,
              padding: "5px 14px",
              fontSize: 11,
              color: "#8080cc",
              fontFamily: "monospace",
              letterSpacing: 0.5,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ACCENT,
                display: "inline-block",
                boxShadow: `0 0 8px ${ACCENT}`,
              }}
            />
            FREE · RUNS IN YOUR BROWSER · NO SIGN-UP NEEDED
          </div>

          <h1
            style={{
              fontSize: "clamp(36px,7vw,74px)",
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-2px",
              margin: "0 0 24px",
              background: "linear-gradient(135deg,#ffffff 30%,#a0a0ff 70%,#c084fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Your story.
            <br />
            Every choice matters.
          </h1>

          <p
            style={{
              fontSize: "clamp(15px,2vw,19px)",
              color: "#666",
              lineHeight: 1.8,
              maxWidth: 560,
              margin: "0 auto 16px",
            }}
          >
            Build rich branching dialogues for your visual novel or RPG — complex conversations with
            dozens of choices, conditions, and character arcs — all mapped out visually so nothing
            gets lost.
          </p>
          <p
            style={{
              fontSize: 14,
              color: "#444",
              lineHeight: 1.7,
              maxWidth: 480,
              margin: "0 auto 40px",
            }}
          >
            No spreadsheets. No tangled scripts. Just nodes, connections, and your story.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onEnter}
              style={{
                background: ACCENT,
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                padding: "14px 36px",
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: 0.2,
                boxShadow: "0 0 40px rgba(99,102,241,0.3)",
              }}
            >
              Start writing — it&apos;s free
            </button>
            <a
              href="#walkthrough"
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                borderRadius: 8,
                color: "#888",
                fontSize: 15,
                fontWeight: 500,
                padding: "14px 28px",
                cursor: "pointer",
                fontFamily: "inherit",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              See how it works
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 12h14M12 5l7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── Node Preview ── */}
      <section
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: "100px",
          borderTop: "1px solid #141414",
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: ACCENT,
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              HOW NODES LOOK
            </div>
            <h2
              style={{
                fontSize: "clamp(24px,4vw,38px)",
                fontWeight: 700,
                margin: "0 0 14px",
                letterSpacing: "-1px",
                color: "#e5e5e5",
              }}
            >
              A dialogue tree at a glance
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#555",
                margin: 0,
                maxWidth: 480,
                marginInline: "auto",
                lineHeight: 1.7,
              }}
            >
              Each box is one line of dialogue. Drag the ports to connect them. Branch with choices.
              It really is that simple.
            </p>
          </div>
          <div
            style={{
              background: "#0d0d0d",
              border: "1px solid #1e1e1e",
              borderRadius: 12,
              padding: "clamp(20px,4vw,48px)",
              overflow: "auto",
            }}
          >
            <NodePreview />
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 20,
              justifyContent: "center",
            }}
          >
            {(
              [
                { color: "#a855f7", label: "Colour stripe = character" },
                { color: "#f59e0b", label: "Amber ports = player choices" },
                { color: "#6366f1", label: "Indigo port = linear flow" },
                { color: "#3a1010", label: "Red border = scene end" },
              ] as const
            ).map((p) => (
              <div
                key={p.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: "#0e0e0e",
                  border: "1px solid #1e1e1e",
                  borderRadius: 100,
                  padding: "5px 12px",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: p.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}>
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: "100px",
          borderTop: "1px solid #141414",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: ACCENT,
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            FEATURES
          </div>
          <h2
            style={{
              fontSize: "clamp(26px,4vw,40px)",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-1px",
              color: "#e5e5e5",
            }}
          >
            Built for visual novels and RPGs
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 16,
          }}
        >
          <Feature
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="8" cy="8" r="3" stroke="#6366f1" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="3" stroke="#6366f1" strokeWidth="1.5" />
                <path
                  d="M8 11v2a5 5 0 0 0 5 5h0"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            }
            title="Infinite node canvas"
            desc="Map out hundreds of dialogue nodes across an infinite canvas — zoom out to see the full arc of your story."
          />
          <Feature
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2v4l-4-4H9a2 2 0 0 1-2-2v-1"
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 4h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7l-4 4V6a2 2 0 0 1 2-2Z"
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="Deep branching choices"
            desc="Give players real agency. Each choice leads to its own branch, with optional conditions that gate options based on story flags."
          />
          <Feature
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="9" cy="7" r="4" stroke="#22c55e" strokeWidth="1.5" />
                <path
                  d="M2 21c0-4 3-7 7-7s7 3 7 7"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M19 8v6M16 11h6"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            }
            title="Full cast management"
            desc="Every character gets a name and colour. Their stripe runs through every node they speak, so spotting who says what is instant."
          />
          <Feature
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16M4 12h10M4 18h6"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="19" cy="17" r="3" stroke="#f59e0b" strokeWidth="1.5" />
              </svg>
            }
            title="Variables & story flags"
            desc="Track reputation, quest flags, counters, and named strings. Nodes and choices appear or disappear based on what the player has done."
          />
          <Feature
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="3" width="18" height="4" rx="1" stroke="#06b6d4" strokeWidth="1.5" />
                <rect
                  x="3"
                  y="10"
                  width="18"
                  height="4"
                  rx="1"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                />
                <rect
                  x="3"
                  y="17"
                  width="18"
                  height="4"
                  rx="1"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                />
              </svg>
            }
            title="Scenes per chapter"
            desc="Organise your game into scenes — one per chapter, location, or NPC — each with its own self-contained tree."
          />
          <Feature
            icon={
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3v10m0 0-3-3m3 3 3-3"
                  stroke="#ec4899"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <path
                  d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                  stroke="#ec4899"
                  strokeWidth="1.5"
                />
              </svg>
            }
            title="Export to JSON"
            desc="One click gives you a clean JSON file ready to parse in Unity, Godot, Ren'Py, or any custom engine."
          />
        </div>
      </section>

      {/* ── Walkthrough ── */}
      <section
        id="walkthrough"
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: "100px",
          borderTop: "1px solid #141414",
        }}
      >
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: ACCENT,
                letterSpacing: 2,
                marginBottom: 12,
              }}
            >
              WALKTHROUGH
            </div>
            <h2
              style={{
                fontSize: "clamp(26px,4vw,40px)",
                fontWeight: 700,
                margin: "0 0 14px",
                letterSpacing: "-1px",
                color: "#e5e5e5",
              }}
            >
              The whole editor, explained
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#555",
                margin: 0,
                maxWidth: 460,
                marginInline: "auto",
                lineHeight: 1.7,
              }}
            >
              Four zones. Everything you need. Nothing you don&apos;t.
            </p>
          </div>

          <div
            style={{
              background: "#0d0d0d",
              border: "1px solid #1e1e1e",
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 48,
            }}
          >
            <svg
              viewBox="0 0 860 340"
              style={{ width: "100%", height: "auto", display: "block" }}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label="Editor layout diagram showing four zones: Rail, Sidebar, Canvas, Node Editor"
            >
              <title>Inkgraph editor layout — four zones overview</title>
              <rect x="0" y="0" width="44" height="340" fill="#0f0f0f" />
              <rect x="44" y="0" width="196" height="340" fill="#0c0c0c" />
              <rect x="240" y="0" width="376" height="340" fill="#0a0a0a" />
              <rect x="616" y="0" width="244" height="340" fill="#0f0f0f" />
              <line x1="44" y1="0" x2="44" y2="340" stroke="#1e1e1e" strokeWidth="1" />
              <line x1="240" y1="0" x2="240" y2="340" stroke="#1e1e1e" strokeWidth="1" />
              <line x1="616" y1="0" x2="616" y2="340" stroke="#1e1e1e" strokeWidth="1" />
              <rect x="4" y="10" width="36" height="6" rx="1" fill="#1e1e1e" />
              <rect x="4" y="24" width="36" height="6" rx="1" fill="#1e1e1e" />
              <rect x="4" y="38" width="36" height="6" rx="1" fill="#1e1e1e" />
              <circle cx="22" cy="64" r="10" fill="#141422" stroke="#6366f1" strokeWidth="1" />
              <text
                x="22"
                y="68"
                fill="#6366f1"
                fontSize="8"
                fontFamily="monospace"
                textAnchor="middle"
              >
                S
              </text>
              <text x="52" y="18" fill="#333" fontSize="8" fontFamily="monospace" letterSpacing="1">
                SCENES
              </text>
              <rect x="52" y="24" width="180" height="28" rx="3" fill="#141422" />
              <circle cx="62" cy="38" r="3" fill="#6366f1" />
              <text x="70" y="41" fill="#e5e5e5" fontSize="10" fontFamily="monospace">
                Scene 1
              </text>
              <rect x="52" y="56" width="180" height="28" rx="3" fill="#141414" />
              <circle cx="62" cy="70" r="3" fill="#2a2a2a" />
              <text x="70" y="73" fill="#555" fontSize="10" fontFamily="monospace">
                Scene 2
              </text>
              <rect
                x="310"
                y="30"
                width="160"
                height="66"
                rx="4"
                fill="#0e1a2e"
                stroke="#6366f1"
                strokeWidth="1.5"
              />
              <rect x="310" y="30" width="3" height="66" rx="2" fill="#6366f1" />
              <text
                x="320"
                y="56"
                fill="#a855f7"
                fontSize="10"
                fontFamily="monospace"
                fontWeight="600"
              >
                Lyra
              </text>
              <text x="320" y="70" fill="#777" fontSize="9" fontFamily="sans-serif">
                What do you want here?
              </text>
              <text x="320" y="86" fill="#f59e0b" fontSize="8" fontFamily="monospace">
                2 choices
              </text>
              <circle cx="390" cy="30" r="4" fill="#0a0a0a" stroke="#2a2a2a" strokeWidth="1.5" />
              <circle cx="360" cy="96" r="4" fill="#0a0a0a" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="420" cy="96" r="4" fill="#0a0a0a" stroke="#f59e0b" strokeWidth="1.5" />
              <text
                x="624"
                y="18"
                fill="#333"
                fontSize="8"
                fontFamily="monospace"
                letterSpacing="1"
              >
                NODE EDITOR
              </text>
              <rect
                x="624"
                y="130"
                width="220"
                height="44"
                rx="3"
                fill="#0d0d0d"
                stroke="#1e1e1e"
                strokeWidth="1"
              />
              <text x="630" y="148" fill="#888" fontSize="9" fontFamily="sans-serif">
                What do you want here?
              </text>
              <rect x="0" y="308" width="44" height="32" fill="rgba(10,10,10,0.9)" />
              <rect x="44" y="308" width="196" height="32" fill="rgba(10,10,10,0.9)" />
              <rect x="240" y="308" width="376" height="32" fill="rgba(10,10,10,0.9)" />
              <rect x="616" y="308" width="244" height="32" fill="rgba(10,10,10,0.9)" />
              <line x1="0" y1="308" x2="860" y2="308" stroke="#1e1e1e" strokeWidth="1" />
              <text
                x="22"
                y="328"
                fill="#6366f1"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                RAIL
              </text>
              <text
                x="142"
                y="328"
                fill="#6366f1"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                SIDEBAR
              </text>
              <text
                x="428"
                y="328"
                fill="#6366f1"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                CANVAS
              </text>
              <text
                x="738"
                y="328"
                fill="#6366f1"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="middle"
              >
                NODE EDITOR
              </text>
            </svg>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: 16,
            }}
          >
            {(
              [
                {
                  label: "Rail",
                  color: "#6366f1",
                  desc: "Switch between Scenes, Characters, Variables, and Export panels. Ko-fi and hotkey help live here too.",
                },
                {
                  label: "Sidebar",
                  color: "#a855f7",
                  desc: "Manage your scenes and cast. Create characters with colours, define story variables, import or export your project.",
                },
                {
                  label: "Canvas",
                  color: "#22c55e",
                  desc: "Your infinite workspace. Drag nodes anywhere, pan freely, draw connections between ports to build the tree.",
                },
                {
                  label: "Node Editor",
                  color: "#f59e0b",
                  desc: "Edit the selected node — tag, speaker, dialogue text, choices, conditions and effects all live in this panel.",
                },
              ] as const
            ).map((z) => (
              <div
                key={z.label}
                style={{
                  padding: "18px 20px",
                  background: "#0e0e0e",
                  border: "1px solid #1e1e1e",
                  borderRadius: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: z.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#e5e5e5",
                      fontFamily: "monospace",
                      letterSpacing: 0.5,
                    }}
                  >
                    {z.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.7 }}>{z.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Desktop Download ── */}
      <section
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: "80px",
          borderTop: "1px solid #141414",
        }}
      >
        <div
          style={{
            maxWidth: 700,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "monospace",
              color: ACCENT,
              letterSpacing: 2,
              marginBottom: 12,
            }}
          >
            DESKTOP APP
          </div>
          <h2
            style={{
              fontSize: "clamp(24px,4vw,36px)",
              fontWeight: 700,
              margin: "0 0 14px",
              letterSpacing: "-1px",
              color: "#e5e5e5",
            }}
          >
            Take it offline
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#555",
              lineHeight: 1.75,
              maxWidth: 460,
              marginBottom: 36,
            }}
          >
            Prefer a native app? The desktop version runs fully offline — no browser, no tabs, no
            distractions. Available for Windows and macOS.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {(["Windows", "macOS"] as const).map((os) => (
              <button
                key={os}
                type="button"
                disabled
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#111",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  color: "#444",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "12px 24px",
                  cursor: "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                Download for {os}
                <span
                  style={{
                    fontSize: 10,
                    background: "#1a1a1a",
                    border: "1px solid #2a2a2a",
                    borderRadius: 4,
                    padding: "2px 7px",
                    color: "#333",
                    fontFamily: "monospace",
                  }}
                >
                  soon
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#2a2a2a", marginTop: 20, fontFamily: "monospace" }}>
            Desktop app coming soon — use the browser version in the meantime.
          </p>
        </div>
      </section>

      {/* ── Simulator ── */}
      <section
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: "100px",
          borderTop: "1px solid #141414",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 48,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: ACCENT,
                  letterSpacing: 2,
                  marginBottom: 12,
                }}
              >
                SIMULATOR
              </div>
              <h2
                style={{
                  fontSize: "clamp(24px,4vw,38px)",
                  fontWeight: 700,
                  margin: "0 0 16px",
                  letterSpacing: "-1px",
                  color: "#e5e5e5",
                }}
              >
                Play it before you ship it
              </h2>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.8, margin: "0 0 12px" }}>
                The built-in simulator lets you walk through any scene exactly as a player would —
                revealing text line by line, choosing responses, and branching through your tree
                in real time.
              </p>
              <p style={{ fontSize: 14, color: "#555", lineHeight: 1.8, margin: "0 0 28px" }}>
                At the end of the scene, you get a full summary of every choice made and the
                complete dialogue log — perfect for spotting dead ends or missing branches before
                handing off to your engine.
              </p>
              <button
                type="button"
                onClick={onEnter}
                style={{
                  background: "transparent",
                  border: "1px solid #2a2a2a",
                  borderRadius: 8,
                  color: "#888",
                  fontSize: 14,
                  fontWeight: 500,
                  padding: "12px 24px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>🎭</span> Try the simulator
              </button>
            </div>

            {/* Mock dialogue window */}
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid #1e1e1e",
                borderRadius: 12,
                overflow: "hidden",
                fontFamily: "'Inter',system-ui,sans-serif",
              }}
            >
              <div
                style={{
                  height: 36,
                  background: "#0f0f0f",
                  borderBottom: "1px solid #1e1e1e",
                  display: "flex",
                  alignItems: "center",
                  paddingInline: 14,
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 10, fontFamily: "monospace", color: ACCENT, letterSpacing: 1 }}>SIMULATOR</span>
                <span style={{ fontSize: 10, color: "#333", fontFamily: "monospace", marginLeft: "auto" }}>Scene 1</span>
              </div>
              <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Past line */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: 0.4 }}>
                  <svg width="32" height="32" viewBox="0 0 80 80" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="40" cy="22" r="13" fill="#6366f1" opacity="0.7" />
                    <path d="M14 72c0-14.36 11.64-26 26-26h0c14.36 0 26 11.64 26 26" fill="#6366f1" opacity="0.7" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 10, color: "#6366f1", fontFamily: "monospace", marginBottom: 4 }}>LYRA</div>
                    <div style={{ fontSize: 12, color: "#555", background: "#111", borderRadius: "3px 8px 8px 8px", padding: "8px 12px" }}>
                      What brings you to the Ashwood?
                    </div>
                  </div>
                </div>
                {/* Current line */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <svg width="40" height="40" viewBox="0 0 80 80" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <circle cx="40" cy="22" r="13" fill="#ec4899" opacity="0.7" />
                    <path d="M14 72c0-14.36 11.64-26 26-26h0c14.36 0 26 11.64 26 26" fill="#ec4899" opacity="0.7" />
                  </svg>
                  <div>
                    <div style={{ fontSize: 10, color: "#ec4899", fontFamily: "monospace", marginBottom: 4 }}>WARDEN</div>
                    <div style={{ fontSize: 13, color: "#ccc", background: "#111", border: "1px solid #1e1e1e", borderRadius: "3px 10px 10px 10px", padding: "10px 14px", lineHeight: 1.6 }}>
                      I&apos;m looking for someone. A traveller, passed through last week.
                      <span style={{ display: "inline-block", width: 2, height: "1em", background: ACCENT, marginLeft: 3, verticalAlign: "middle", opacity: 0.8 }} />
                    </div>
                  </div>
                </div>
                {/* Choices */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {[
                    "Tell me more about this traveller",
                    "I haven't seen anyone like that",
                  ].map((label, i) => (
                    <div
                      key={label}
                      style={{
                        background: i === 0 ? "#0d0d1a" : "#0a0a0a",
                        border: `1px solid ${i === 0 ? "#3a3a7a" : "#1e1e1e"}`,
                        borderRadius: 7,
                        padding: "9px 12px",
                        fontSize: 12,
                        color: i === 0 ? "#aaa" : "#444",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ width: 18, height: 18, borderRadius: 3, background: "#1a1a3a", border: "1px solid #3a3a7a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontFamily: "monospace", color: ACCENT, flexShrink: 0 }}>
                        {i + 1}
                      </span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: "100px",
          borderTop: "1px solid #141414",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.09) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2
            style={{
              fontSize: "clamp(28px,5vw,52px)",
              fontWeight: 800,
              margin: "0 0 16px",
              letterSpacing: "-1.5px",
              color: "#e5e5e5",
            }}
          >
            Your next story starts here.
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#555",
              marginBottom: 36,
              maxWidth: 440,
              marginInline: "auto",
              lineHeight: 1.7,
            }}
          >
            No install. No account needed. Open the editor and start building in seconds.
          </p>
          <button
            type="button"
            onClick={onEnter}
            style={{
              background: ACCENT,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              padding: "16px 48px",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: 0.2,
              boxShadow: "0 0 60px rgba(99,102,241,0.25)",
            }}
          >
            Open the editor
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          paddingInline: "clamp(20px,5vw,80px)",
          paddingBlock: 24,
          borderTop: "1px solid #141414",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#2a2a2a", letterSpacing: 1 }}>
          INKGRAPH
        </span>
        <a
          href="https://ko-fi.com/oslavdevelopment#"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: "#444",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M18 8h1a4 4 0 0 1 0 8h-1"
              stroke="#ff5f5f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"
              stroke="#ff5f5f"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Support on Ko-fi
        </a>
      </footer>
    </div>
  )
}