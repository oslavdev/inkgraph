import { useEffect, useRef, useState } from "react"

const C = {
  bg: "#0a0a0a",
  surface: "#111",
  surface2: "#0e0e0e",
  border: "#1e1e1e",
  accent: "#6366f1",
  text: "#e5e5e5",
  textMuted: "#555",
  textDim: "#888",
  danger: "#ef4444",
  success: "#22c55e",
  warn: "#f59e0b",
}
const NODE_W = 200,
  NODE_H = 82
const uid = () => Math.random().toString(36).slice(2, 9)

const TAG_DEFS = {
  none: { label: "Default", bg: "#161616", stripe: "#252525" },
  dialogue: { label: "Dialogue", bg: "#0e1a2e", stripe: "#1e3a5f" },
  action: { label: "Action", bg: "#0e1a0e", stripe: "#1f3a1a" },
  cutscene: { label: "Cutscene", bg: "#1a0e2e", stripe: "#3a1f5f" },
  branch: { label: "Branch", bg: "#1a140a", stripe: "#3a2d10" },
  end: { label: "End", bg: "#1a0a0a", stripe: "#3a1010" },
}

const CHAR_COLORS = [
  "#6366f1",
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#06b6d4",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#84cc16",
]
const VAR_TYPES = ["boolean", "number", "string"]

const mkNode = (id, x = 200, y = 100) => ({
  id,
  x,
  y,
  speaker: "",
  characterId: null,
  text: "",
  choices: [],
  nextId: null,
  tag: "none",
  conditions: [],
  effects: [],
})
const mkChoice = (label = "") => ({ id: uid(), label, nextId: null, conditions: [] })
const mkChar = () => ({ id: uid(), name: "", description: "", color: CHAR_COLORS[0] })
const mkVar = (name = "") => ({
  id: uid(),
  name,
  type: "boolean",
  defaultValue: "false",
  description: "",
})

const persist = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch (_) {}
}
const restore = (k, fb) => {
  try {
    const s = localStorage.getItem(k)
    if (s) return JSON.parse(s)
  } catch (_) {}
  return fb
}

// ─── useTree ──────────────────────────────────────────────────────────────────
function useTree(initialData = null) {
  const initScenes = () => {
    const id = uid()
    return [{ id, name: "Scene 1", description: "" }]
  }
  const [scenes, setScenes] = useState(() => {
    if (initialData?.scenes?.length) return initialData.scenes
    return restore("vn2-scenes", null) || initScenes()
  })
  const [activeSceneId, setActiveSceneId] = useState(() => {
    if (initialData?.scenes?.length) return initialData.scenes[0].id
    return restore("vn2-active-scene", null) || restore("vn2-scenes", null)?.[0]?.id || null
  })
  // Always-current ref so functional updaters inside setNodesByScene can read it without stale closure
  const activeSceneIdRef = useRef(null)
  activeSceneIdRef.current = activeSceneId
  const [nodesByScene, setNodesByScene] = useState(() => {
    if (initialData?.nodesByScene && Object.keys(initialData.nodesByScene).length) return initialData.nodesByScene
    const nb = restore("vn2-nbs", null)
    if (nb) return nb
    const sid = restore("vn2-scenes", null)?.[0]?.id || uid()
    const nid = uid()
    return { [sid]: { root: nid, nodes: { [nid]: mkNode(nid) } } }
  })
  const [characters, setCharacters] = useState(() => {
    if (initialData?.characters) return initialData.characters
    return restore("vn2-chars", [])
  })
  const [variables, setVariables] = useState(() => {
    if (initialData?.variables) return initialData.variables
    return restore("vn2-vars", [])
  })
  const [sel, setSel] = useState(null)
  const [history, setHistory] = useState([]) // stack of {nodesByScene} snapshots

  const pushHistory = (snap) =>
    setHistory((h) => [...h.slice(-49), snap]) // keep last 50

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h
      const prev = h[h.length - 1]
      setNodesByScene(prev)
      setSel(null)
      return h.slice(0, -1)
    })
  }

  useEffect(() => persist("vn2-scenes", scenes), [scenes])
  useEffect(() => persist("vn2-active-scene", activeSceneId), [activeSceneId])
  useEffect(() => persist("vn2-nbs", nodesByScene), [nodesByScene])
  useEffect(() => persist("vn2-chars", characters), [characters])
  useEffect(() => persist("vn2-vars", variables), [variables])

  const sd = nodesByScene[activeSceneId] || { root: null, nodes: {} }
  const nodes = sd.nodes || {}
  const rootId = sd.root

  // Auto-select the root node when nothing is selected (initial load or scene switch)
  useEffect(() => {
    if (!sel && rootId) setSel(rootId)
  }, [sel, rootId])

  const setNodes = (fn, skipHistory = false) =>
    setNodesByScene((nb) => {
      if (!skipHistory) pushHistory(nb)
      const cur = nb[activeSceneId] || { root: null, nodes: {} }
      const nxt = typeof fn === "function" ? fn(cur.nodes) : fn
      return { ...nb, [activeSceneId]: { ...cur, nodes: nxt } }
    })

  // scenes
  const switchScene = (id) => {
    setActiveSceneId(id)
    setSel(null)
  }
  const addScene = (name) => {
    const sc = { id: uid(), name, description: "" }
    const nid = uid()
    setScenes((s) => [...s, sc])
    setNodesByScene((nb) => ({ ...nb, [sc.id]: { root: nid, nodes: { [nid]: mkNode(nid) } } }))
    setActiveSceneId(sc.id)
    setSel(null)
  }
  const updateScene = (id, p) =>
    setScenes((s) => s.map((sc) => (sc.id === id ? { ...sc, ...p } : sc)))
  const deleteScene = (id) => {
    if (scenes.length === 1) return
    setScenes((s) => s.filter((sc) => sc.id !== id))
    setNodesByScene((nb) => {
      const n = { ...nb }
      delete n[id]
      return n
    })
    if (activeSceneId === id) setActiveSceneId(scenes.find((s) => s.id !== id)?.id)
  }
  const reorderScenes = (newOrder) => setScenes(newOrder)

  // characters
  const addChar = () => {
    const c = { ...mkChar(), color: CHAR_COLORS[characters.length % CHAR_COLORS.length] }
    setCharacters((ch) => [...ch, c])
    return c
  }
  const updateChar = (id, p) =>
    setCharacters((ch) => ch.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const deleteChar = (id) => setCharacters((ch) => ch.filter((c) => c.id !== id))

  // variables
  const addVar = () => {
    const v = mkVar("var_" + (variables.length + 1))
    setVariables((vv) => [...vv, v])
    return v
  }
  const updateVar = (id, p) =>
    setVariables((vv) => vv.map((v) => (v.id === id ? { ...v, ...p } : v)))
  const deleteVar = (id) => setVariables((vv) => vv.filter((v) => v.id !== id))

  // nodes
  const upd = (id, p) => setNodes((n) => ({ ...n, [id]: { ...n[id], ...p } }))
  const addNode = (fromId, choiceId = null, ox = 0) => {
    const from = nodes[fromId]
    const nid = uid()
    // Smart placement: if node has choices, offset horizontally
    const hasChoices = from.choices && from.choices.length > 0
    const effectiveOx = ox !== 0 ? ox : (hasChoices ? (from.choices.length - 1) * 120 - (from.choices.length - 1) * 60 : 0)
    const nn = mkNode(nid, from.x + effectiveOx, from.y + NODE_H + 70)
    setNodes((n) => {
      const nx = { ...n, [nid]: nn }
      if (choiceId) {
        nx[fromId] = {
          ...nx[fromId],
          choices: nx[fromId].choices.map((c) => (c.id === choiceId ? { ...c, nextId: nid } : c)),
        }
      } else {
        nx[fromId] = { ...nx[fromId], nextId: nid }
      }
      return nx
    })
    setSel(nid)
    return nid
  }

  // Smart N key: read fresh state to avoid stale-closure issues after addChoice
  const addNodeSmart = (fromId) => {
    setNodesByScene((nb) => {
      // Use ref to get current activeSceneId — avoids stale closure
      const sceneId = activeSceneIdRef.current
      const cur = nb[sceneId] || { root: null, nodes: {} }
      const freshNodes = cur.nodes
      const from = freshNodes[fromId]
      if (!from) return nb // no-op

      const nid = uid()

      // Find first unlinked choice
      const emptyChoice = from.choices?.find((c) => !c.nextId) ?? null

      let ox = 0
      let updatedFrom

      if (emptyChoice) {
        // Link the new node to the first empty choice
        const i = from.choices.indexOf(emptyChoice)
        const total = from.choices.length
        ox = (i - (total - 1) / 2) * 150
        updatedFrom = {
          ...from,
          choices: from.choices.map((c) =>
            c.id === emptyChoice.id ? { ...c, nextId: nid } : c
          ),
        }
      } else if (!from.choices || from.choices.length === 0) {
        // No choices at all — normal nextId link
        updatedFrom = { ...from, nextId: nid }
      } else {
        // All choices already linked — add a new choice and link it
        const newChoice = mkChoice("Option " + (from.choices.length + 1))
        newChoice.nextId = nid
        const total = from.choices.length + 1
        const i = from.choices.length
        ox = (i - (total - 1) / 2) * 150
        updatedFrom = { ...from, choices: [...from.choices, newChoice] }
      }

      const nn = mkNode(nid, from.x + ox, from.y + NODE_H + 70)
      const nextNodes = { ...freshNodes, [fromId]: updatedFrom, [nid]: nn }

      // Select the new node after state settles
      setTimeout(() => setSel(nid), 0)

      return { ...nb, [sceneId]: { ...cur, nodes: nextNodes } }
    })
  }
  const addChoice = (id) => {
    const c = mkChoice("Option " + (nodes[id].choices.length + 1))
    setNodes((n) => ({ ...n, [id]: { ...n[id], choices: [...n[id].choices, c] } }))
  }
  const remChoice = (nid, cid) =>
    setNodes((n) => ({
      ...n,
      [nid]: { ...n[nid], choices: n[nid].choices.filter((c) => c.id !== cid) },
    }))
  const updChoice = (nid, cid, p) =>
    setNodes((n) => ({
      ...n,
      [nid]: { ...n[nid], choices: n[nid].choices.map((c) => (c.id === cid ? { ...c, ...p } : c)) },
    }))
  const delNode = (id) => {
    if (id === rootId) return
    setNodes((n) => {
      const nx = { ...n }
      delete nx[id]
      Object.keys(nx).forEach((k) => {
        if (nx[k].nextId === id) nx[k] = { ...nx[k], nextId: null }
        nx[k] = {
          ...nx[k],
          choices: nx[k].choices.map((c) => (c.nextId === id ? { ...c, nextId: null } : c)),
        }
      })
      return nx
    })
    setSel(rootId)
  }
  const movNode = (id, dx, dy) =>
    setNodes((n) => ({ ...n, [id]: { ...n[id], x: n[id].x + dx, y: n[id].y + dy } }))
  const linkNodes = (fromId, toId, choiceId = null) =>
    setNodes((n) => {
      const nx = { ...n }
      if (choiceId)
        nx[fromId] = {
          ...nx[fromId],
          choices: nx[fromId].choices.map((c) => (c.id === choiceId ? { ...c, nextId: toId } : c)),
        }
      else nx[fromId] = { ...nx[fromId], nextId: toId }
      return nx
    })
  const unlinkNode = (fromId, choiceId = null) =>
    setNodes((n) => {
      const nx = { ...n }
      if (choiceId)
        nx[fromId] = {
          ...nx[fromId],
          choices: nx[fromId].choices.map((c) => (c.id === choiceId ? { ...c, nextId: null } : c)),
        }
      else nx[fromId] = { ...nx[fromId], nextId: null }
      return nx
    })

  const exportAll = () => {
    const blob = new Blob(
      [JSON.stringify({ scenes, nodesByScene, characters, variables }, null, 2)],
      { type: "application/json" }
    )
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "dialogue.json"
    a.click()
  }
  const importAll = (file) => {
    const r = new FileReader()
    r.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result)
        if (d.scenes) setScenes(d.scenes)
        if (d.nodesByScene) setNodesByScene(d.nodesByScene)
        if (d.characters) setCharacters(d.characters)
        if (d.variables) setVariables(d.variables)
        if (d.scenes?.[0]) setActiveSceneId(d.scenes[0].id)
        setSel(null)
      } catch (_) {
        alert("Invalid file")
      }
    }
    r.readAsText(file)
  }

  return {
    nodes,
    rootId,
    sel,
    setSel,
    upd,
    addNode,
    addNodeSmart,
    addChoice,
    remChoice,
    updChoice,
    delNode,
    movNode,
    linkNodes,
    unlinkNode,
    scenes,
    activeSceneId,
    switchScene,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    characters,
    addChar,
    updateChar,
    deleteChar,
    variables,
    addVar,
    updateVar,
    deleteVar,
    exportAll,
    importAll,
    undo,
    nodesByScene,
  }
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
const getOut = (nd, pan) => ({ x: nd.x + NODE_W / 2 + pan.x, y: nd.y + NODE_H + pan.y })
const getIn = (nd, pan) => ({ x: nd.x + NODE_W / 2 + pan.x, y: nd.y + pan.y })
const getChoiceOut = (nd, i, total, pan) => ({
  x: nd.x + (NODE_W / (total + 1)) * (i + 1) + pan.x,
  y: nd.y + NODE_H + pan.y,
})

function Arrow({ from, to, color, label, onClick }) {
  const dy = to.y - from.y
  const path = `M ${from.x} ${from.y} C ${from.x} ${from.y + Math.max(40, dy * 0.5)}, ${to.x} ${to.y - Math.max(40, dy * 0.5)}, ${to.x} ${to.y}`
  const mx = (from.x + to.x) / 2,
    my = (from.y + to.y) / 2
  const cid = color.replace(/[^a-z0-9]/gi, "")
  return (
    <g style={{ cursor: "pointer" }} onClick={onClick}>
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={0.6}
        markerEnd={`url(#ah${cid})`}
      />
      {label && (
        <text x={mx} y={my - 8} fill={C.textMuted} fontSize={10} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  )
}

function Port({ x, y, color, active, onMouseDown, onMouseUp }) {
  return (
    <circle
      cx={x}
      cy={y}
      r={5}
      fill={active ? color : "#0a0a0a"}
      stroke={color}
      strokeWidth={1.5}
      style={{ cursor: "crosshair" }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    />
  )
}

// ─── Minimap ──────────────────────────────────────────────────────────────────
function Minimap({ nodes, pan, viewW, viewH }) {
  const nlist = Object.values(nodes)
  if (!nlist.length) return null
  const MM_W = 180,
    MM_H = 110,
    PAD = 10
  const xs = nlist.map((n) => n.x),
    ys = nlist.map((n) => n.y)
  const minX = Math.min(...xs) - 20,
    maxX = Math.max(...xs) + NODE_W + 20
  const minY = Math.min(...ys) - 20,
    maxY = Math.max(...ys) + NODE_H + 20
  const scW = maxX - minX || 1,
    scH = maxY - minY || 1
  const scale = Math.min((MM_W - PAD * 2) / scW, (MM_H - PAD * 2) / scH)
  const tx = (v) => PAD + (v - minX) * scale
  const ty = (v) => PAD + (v - minY) * scale
  return (
    <div
      style={{
        position: "absolute",
        bottom: 14,
        right: 14,
        background: "rgba(8,8,8,0.92)",
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        overflow: "hidden",
        width: MM_W,
        height: MM_H,
        pointerEvents: "none",
      }}
    >
      <svg width={MM_W} height={MM_H}>
        <title>Minimap</title>
        {nlist.map((nd) => {
          const tag = TAG_DEFS[nd.tag || "none"]
          return (
            <rect
              key={nd.id}
              x={tx(nd.x)}
              y={ty(nd.y)}
              width={NODE_W * scale}
              height={NODE_H * scale}
              rx={1.5}
              fill={tag.bg}
              stroke={tag.stripe}
              strokeWidth={0.5}
            />
          )
        })}
        {nlist.map((nd) => {
          const lines = []
          if (nd.nextId && nodes[nd.nextId]) {
            const t = nodes[nd.nextId]
            lines.push(
              <line
                key={nd.id + "n"}
                x1={tx(nd.x + NODE_W / 2)}
                y1={ty(nd.y + NODE_H)}
                x2={tx(t.x + NODE_W / 2)}
                y2={ty(t.y)}
                stroke={C.accent}
                strokeWidth={0.8}
                strokeOpacity={0.5}
              />
            )
          }
          // biome-ignore lint/complexity/noForEach: <explanation>
          nd.choices.forEach((ch) => {
            if (ch.nextId && nodes[ch.nextId]) {
              const t = nodes[ch.nextId]
              lines.push(
                <line
                  key={ch.id}
                  x1={tx(nd.x + NODE_W / 2)}
                  y1={ty(nd.y + NODE_H)}
                  x2={tx(t.x + NODE_W / 2)}
                  y2={ty(t.y)}
                  stroke={C.warn}
                  strokeWidth={0.8}
                  strokeOpacity={0.5}
                />
              )
            }
          })
          return lines
        })}
        <rect
          x={tx(-pan.x)}
          y={ty(-pan.y)}
          width={viewW * scale}
          height={viewH * scale}
          fill="none"
          stroke="#fff"
          strokeWidth={0.8}
          strokeOpacity={0.15}
        />
      </svg>
    </div>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function Canvas({ tree, viewRef, onJumpToRoot }) {
  const { nodes, rootId, sel, setSel, movNode, linkNodes, unlinkNode, characters } = tree
  const svgRef = useRef(null)
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [dragN, setDragN] = useState(null)
  const [panning, setPanning] = useState(false)
  const [conn, setConn] = useState(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const lastM = useRef(null)

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    if (svgRef.current) obs.observe(svgRef.current)
    return () => obs.disconnect()
  }, [])

  const startConn = (e, fromId, choiceId = null) => {
    e.stopPropagation()
    const r = svgRef.current.getBoundingClientRect()
    setConn({ fromId, choiceId, mx: e.clientX - r.left, my: e.clientY - r.top })
  }
  const onSvgDown = (e) => {
    if (!conn) {
      setPanning(true)
      lastM.current = { x: e.clientX, y: e.clientY }
    }
  }
  const onNodeDown = (e, id) => {
    e.stopPropagation()
    setSel(id)
    setDragN(id)
    lastM.current = { x: e.clientX, y: e.clientY }
  }
  const onMove = (e) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (conn && r) setConn((c) => ({ ...c, mx: e.clientX - r.left, my: e.clientY - r.top }))
    if (!lastM.current) return
    const dx = e.clientX - lastM.current.x
    const dy = e.clientY - lastM.current.y
    lastM.current = { x: e.clientX, y: e.clientY }
    if (dragN) movNode(dragN, dx, dy)
    else if (panning) setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }
  const onUp = () => {
    setDragN(null)
    setPanning(false)
    lastM.current = null
    if (conn) setConn(null)
  }

  // Release pan/drag if mouse leaves window (prevents sticky pan)
  useEffect(() => {
    function onWindowUp() {
      setDragN(null)
      setPanning(false)
      lastM.current = null
    }
    window.addEventListener("mouseup", onWindowUp)
    return () => window.removeEventListener("mouseup", onWindowUp)
  }, [])
  const onInUp = (e, toId) => {
    e.stopPropagation()
    if (conn && conn.fromId !== toId) linkNodes(conn.fromId, toId, conn.choiceId || null)
    setConn(null)
  }

  const onTouchStart = (e) => {
    const touch = e.touches[0]
    const target = e.target
    const nd = target.dataset?.nodeid
    if (nd) {
      e.stopPropagation()
      setSel(nd)
      setDragN(nd)
      lastM.current = { x: touch.clientX, y: touch.clientY }
    } else {
      setPanning(true)
      lastM.current = { x: touch.clientX, y: touch.clientY }
    }
  }
  const onTouchMove = (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    if (!lastM.current) return
    const dx = touch.clientX - lastM.current.x
    const dy = touch.clientY - lastM.current.y
    lastM.current = { x: touch.clientX, y: touch.clientY }
    if (dragN) movNode(dragN, dx, dy)
    else if (panning) setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }
  const onTouchEnd = () => {
    setDragN(null)
    setPanning(false)
    lastM.current = null
  }

  const nlist = Object.values(nodes)
  const GRID = 80

  return (
    <div ref={viewRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Jump to root button */}
      <button
        type="button"
        onClick={() => {
          if (rootId && nodes[rootId]) {
            const nd = nodes[rootId]
            setPan({ x: -nd.x + 60, y: -nd.y + 60 })
            setSel(rootId)
          }
          if (onJumpToRoot) onJumpToRoot()
        }}
        title="Jump to root node (Home)"
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          zIndex: 20,
          background: "rgba(10,10,10,0.85)",
          border: `1px solid ${C.border}`,
          borderRadius: 5,
          color: C.textMuted,
          fontSize: 10,
          fontFamily: "monospace",
          padding: "4px 9px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 5,
          backdropFilter: "blur(4px)",
        }}
      >
        <svg width="10" height="10" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12L12 3l9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M9 21V12h6v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Root
      </button>
      <svg
        ref={svgRef}
        style={{
          width: "100%",
          height: "100%",
          background: C.bg,
          cursor: panning ? "grabbing" : "default",
          display: "block",
          touchAction: "none",
        }}
        onMouseDown={onSvgDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <title>Canvas</title>
        <defs>
          {[C.accent, C.warn].map((col) => (
            <marker
              key={col}
              id={`ah${col.replace(/[^a-z0-9]/gi, "")}`}
              markerWidth={8}
              markerHeight={6}
              refX={8}
              refY={3}
              orient="auto"
            >
              <polygon points="0 0,8 3,0 6" fill={col} opacity={0.7} />
            </marker>
          ))}
        </defs>

        {/* Grid */}
        {Array.from({ length: Math.ceil(4000 / GRID) + 2 }, (_, i) => {
          const x = (pan.x % GRID) + i * GRID - GRID
          return (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={4000} stroke="#131313" strokeWidth={1} />
          )
        })}
        {Array.from({ length: Math.ceil(4000 / GRID) + 2 }, (_, i) => {
          const y = (pan.y % GRID) + i * GRID - GRID
          return (
            <line key={`h${y}`} x1={0} y1={y} x2={4000} y2={y} stroke="#131313" strokeWidth={1} />
          )
        })}

        {/* Arrows */}
        {nlist.map((nd) => {
          const arrows = []
          if (nd.nextId && nodes[nd.nextId]) {
            arrows.push(
              <Arrow
                key={`${nd.id}n`}
                from={getOut(nd, pan)}
                to={getIn(nodes[nd.nextId], pan)}
                color={C.accent}
                onClick={() => unlinkNode(nd.id)}
              />
            )
          }
          nd.choices.forEach((ch, i) => {
            if (ch.nextId && nodes[ch.nextId]) {
              arrows.push(
                <Arrow
                  key={ch.id}
                  from={getChoiceOut(nd, i, nd.choices.length, pan)}
                  to={getIn(nodes[ch.nextId], pan)}
                  color={C.warn}
                  label={ch.label}
                  onClick={() => unlinkNode(nd.id, ch.id)}
                />
              )
            }
          })
          return arrows
        })}

        {/* Live wire */}
        {conn &&
          (() => {
            const nd = nodes[conn.fromId]
            const idx = conn.choiceId ? nd.choices.findIndex((c) => c.id === conn.choiceId) : -1
            const from = idx >= 0 ? getChoiceOut(nd, idx, nd.choices.length, pan) : getOut(nd, pan)
            return (
              <line
                x1={from.x}
                y1={from.y}
                x2={conn.mx}
                y2={conn.my}
                stroke={conn.choiceId ? C.warn : C.accent}
                strokeWidth={1.5}
                strokeDasharray="5,4"
                strokeOpacity={0.9}
              />
            )
          })()}

        {/* Nodes */}
        {nlist.map((nd) => {
          const nx = nd.x + pan.x,
            ny = nd.y + pan.y
          const isSel = nd.id === sel
          const isRoot = nd.id === rootId
          const isTarget = conn && conn.fromId !== nd.id
          const char = characters.find((c) => c.id === nd.characterId)
          const tag = TAG_DEFS[nd.tag || "none"]
          const hasCond = (nd.conditions || []).length > 0
          const hasEff = (nd.effects || []).length > 0
          return (
            <g key={nd.id}>
              <rect
                x={nx}
                y={ny}
                width={NODE_W}
                height={NODE_H}
                rx={5}
                fill={tag.bg}
                stroke={isSel ? C.accent : isRoot ? C.success : C.border}
                strokeWidth={isSel ? 1.5 : 1}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => onNodeDown(e, nd.id)}
              />
              <rect
                x={nx}
                y={ny}
                width={3}
                height={NODE_H}
                rx={2}
                fill={isSel ? C.accent : isRoot ? C.success : tag.stripe}
                style={{ pointerEvents: "none" }}
              />
              {isTarget && (
                <rect
                  x={nx - 2}
                  y={ny - 2}
                  width={NODE_W + 4}
                  height={NODE_H + 4}
                  rx={7}
                  fill="none"
                  stroke={conn.choiceId ? C.warn : C.accent}
                  strokeWidth={1.5}
                  strokeOpacity={0.45}
                  strokeDasharray="4,3"
                />
              )}
              {char && (
                <rect
                  x={nx + 8}
                  y={ny + 10}
                  width={8}
                  height={NODE_H - 20}
                  rx={2}
                  fill={char.color}
                  opacity={0.9}
                  style={{ pointerEvents: "none" }}
                />
              )}
              {isRoot && (
                <text
                  x={nx + (char ? 22 : 10)}
                  y={ny + 14}
                  fill={C.success}
                  fontSize={8}
                  fontFamily="monospace"
                  style={{ pointerEvents: "none" }}
                >
                  ROOT
                </text>
              )}
              <text
                x={nx + (char ? 22 : 10)}
                y={ny + 28}
                fill={char ? char.color : C.textDim}
                fontSize={11}
                fontFamily="monospace"
                fontWeight="600"
                style={{ pointerEvents: "none" }}
              >
                {char ? char.name : nd.speaker || "—"}
              </text>
              <text
                x={nx + (char ? 22 : 10)}
                y={ny + 45}
                fill="#888"
                fontSize={10}
                style={{ pointerEvents: "none" }}
              >
                {(nd.text || "…").substring(0, 24)}
                {(nd.text?.length ?? 0) > 24 ? "…" : ""}
              </text>
              <text
                x={nx + (char ? 22 : 10)}
                y={ny + 63}
                fill={nd.choices.length > 0 ? C.warn : nd.nextId ? "#444" : "#2a2a2a"}
                fontSize={9}
                fontFamily="monospace"
                style={{ pointerEvents: "none" }}
              >
                {nd.choices.length > 0
                  ? `${nd.choices.length} choice${nd.choices.length > 1 ? "s" : ""}`
                  : nd.nextId
                    ? "→ linked"
                    : "END"}
              </text>
              {hasCond && (
                <text
                  x={nx + NODE_W - 28}
                  y={ny + 63}
                  fill="#3a3a8a"
                  fontSize={9}
                  fontFamily="monospace"
                  style={{ pointerEvents: "none" }}
                >
                  IF
                </text>
              )}
              {hasEff && (
                <text
                  x={nx + NODE_W - 12}
                  y={ny + 63}
                  fill="#3a6a3a"
                  fontSize={9}
                  fontFamily="monospace"
                  style={{ pointerEvents: "none" }}
                >
                  FX
                </text>
              )}
              <text
                x={nx + NODE_W - 6}
                y={ny + 12}
                fill="#222"
                fontSize={8}
                textAnchor="end"
                fontFamily="monospace"
                style={{ pointerEvents: "none" }}
              >
                {nd.id}
              </text>

              <Port
                x={nx + NODE_W / 2}
                y={ny}
                color={isTarget ? (conn.choiceId ? C.warn : C.accent) : "#2a2a2a"}
                onMouseUp={(e) => onInUp(e, nd.id)}
              />
              {nd.choices.length === 0 && (
                <Port
                  x={nx + NODE_W / 2}
                  y={ny + NODE_H}
                  color={nd.nextId ? C.accent : "#2a2a2a"}
                  active={conn?.fromId === nd.id && !conn?.choiceId}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    nd.nextId ? unlinkNode(nd.id) : startConn(e, nd.id)
                  }}
                />
              )}
              {nd.choices.map((ch, i) => {
                const cx = nx + (NODE_W / (nd.choices.length + 1)) * (i + 1)
                const cy = ny + NODE_H
                return (
                  <Port
                    key={ch.id}
                    x={cx}
                    y={cy}
                    color={ch.nextId ? C.warn : "#444"}
                    active={conn?.fromId === nd.id && conn?.choiceId === ch.id}
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      ch.nextId ? unlinkNode(nd.id, ch.id) : startConn(e, nd.id, ch.id)
                    }}
                  />
                )
              })}
            </g>
          )
        })}
      </svg>
      <Minimap nodes={nodes} pan={pan} viewW={dims.w} viewH={dims.h} />
    </div>
  )
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function Tooltip({ label, children }) {
  const [show, setShow] = useState(false)
  return (
    <div
      style={{ position: "relative", display: "flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: "absolute",
            left: "calc(100% + 8px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "#1a1a1a",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            padding: "3px 8px",
            whiteSpace: "nowrap",
            fontSize: 11,
            color: C.text,
            fontFamily: "monospace",
            zIndex: 200,
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      )}
    </div>
  )
}

const IBtn = ({ style, ...p }) => (
  <button
    style={{
      background: "none",
      border: "none",
      cursor: "pointer",
      color: C.textMuted,
      padding: 0,
      ...style,
    }}
    {...p}
  />
)
const SmBtn = ({ onClick, children, color = C.accent }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: "transparent",
      border: `1px solid ${C.border}`,
      borderRadius: 3,
      color,
      fontSize: 10,
      padding: "2px 7px",
      cursor: "pointer",
      fontFamily: "monospace",
    }}
  >
    {children}
  </button>
)

// ─── Sidebar panels ───────────────────────────────────────────────────────────
function ScenesPanel({ tree }) {
  const { scenes, activeSceneId, switchScene, addScene, updateScene, deleteScene, nodesByScene } = tree
  const [editing, setEditing] = useState(null)
  const [newName, setNewName] = useState("")
  const [dragOver, setDragOver] = useState(null)
  const [dragSrc, setDragSrc] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  function reorderScenes(fromId, toId) {
    if (fromId === toId) return
    const from = scenes.findIndex((s) => s.id === fromId)
    const to = scenes.findIndex((s) => s.id === toId)
    const next = [...scenes]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    // updateScene doesn't reorder — we need a full scenes replace
    // Use a workaround: delete all and re-add isn't safe, so expose via a hack
    // Actually we update the tree's scenes array directly via setScenes if available
    // For now, use the available updateScene in a loop isn't possible
    // We'll do it via the exported reorderScenes if it exists, else skip
    if (tree.reorderScenes) tree.reorderScenes(next)
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {scenes.map((sc) => {
          const nodeCount = Object.keys(nodesByScene?.[sc.id]?.nodes ?? {}).length
          return (
          <div
            key={sc.id}
            style={{ borderBottom: "1px solid #141414", opacity: dragOver === sc.id ? 0.5 : 1 }}
            draggable
            onDragStart={() => setDragSrc(sc.id)}
            onDragOver={(e) => { e.preventDefault(); setDragOver(sc.id) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => { reorderScenes(dragSrc, sc.id); setDragOver(null); setDragSrc(null) }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                cursor: "pointer",
                background: sc.id === activeSceneId ? "#141422" : "transparent",
              }}
              onClick={() => switchScene(sc.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  switchScene(sc.id)
                }
              }}
              /** biome-ignore  lint/a11y/useSemanticElements: div required**/
              role="button"
              tabIndex={0}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: sc.id === activeSceneId ? C.accent : "#2a2a2a",
                  flexShrink: 0,
                  cursor: "grab",
                }}
              />
              {editing === sc.id ? (
                <input
                  ref={inputRef}
                  value={sc.name}
                  onChange={(e) => updateScene(sc.id, { name: e.target.value })}
                  onBlur={() => setEditing(null)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(null) } }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    fontSize: 12,
                    outline: "none",
                    flex: 1,
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 12,
                    color: sc.id === activeSceneId ? C.text : C.textDim,
                    flex: 1,
                  }}
                  onDoubleClick={() => setEditing(sc.id)}
                >
                  {sc.name}
                </span>
              )}
              <span style={{ fontSize: 9, color: "#333", fontFamily: "monospace", flexShrink: 0 }}>
                {nodeCount}
              </span>
              {scenes.length > 1 && (
                <IBtn
                  style={{ fontSize: 13, color: "#333" }}
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteScene(sc.id)
                  }}
                >
                  ×
                </IBtn>
              )}
            </div>
            {sc.id === activeSceneId && (
              <div style={{ padding: "0 12px 8px 26px" }}>
                <textarea
                  value={sc.description || ""}
                  onChange={(e) => updateScene(sc.id, { description: e.target.value })}
                  placeholder="Scene notes…"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#0d0d0d",
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.textDim,
                    fontSize: 11,
                    padding: "4px 6px",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    minHeight: 46,
                  }}
                />
              </div>
            )}
          </div>
        )})
        }
      </div>
      <div
        style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 6 }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New scene…"
          onKeyDown={(e) =>
            e.key === "Enter" && newName.trim() && (addScene(newName.trim()), setNewName(""))
          }
          style={{
            flex: 1,
            background: "#0d0d0d",
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            color: C.text,
            fontSize: 11,
            padding: "4px 6px",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
        type='button'
          onClick={() => newName.trim() && (addScene(newName.trim()), setNewName(""))}
          style={{
            background: C.accent,
            border: "none",
            borderRadius: 3,
            color: "#fff",
            fontSize: 14,
            padding: "2px 10px",
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>
    </>
  )
}

function CharactersPanel({ tree }) {
  const { characters, addChar, updateChar, deleteChar } = tree
  const [editing, setEditing] = useState(null)
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {characters.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
            No characters yet
          </div>
        )}
        {characters.map((ch) => (
          <div key={ch.id} style={{ borderBottom: "1px solid #141414" }}>
            <div
            
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
              onClick={() => setEditing(editing === ch.id ? null : ch.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setEditing(editing === ch.id ? null : ch.id)
                }
              }}
               /** biome-ignore  lint/a11y/useSemanticElements: div required**/
              role="button"
              tabIndex={0}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: ch.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 12, color: C.text }}>{ch.name || "Unnamed"}</span>
              <IBtn
                style={{ fontSize: 13, color: "#333" }}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteChar(ch.id)
                }}
              >
                ×
              </IBtn>
            </div>
            {editing === ch.id && (
              <div
                style={{
                  padding: "0 12px 10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <input
                  value={ch.name}
                  onChange={(e) => updateChar(ch.id, { name: e.target.value })}
                  placeholder="Name"
                  style={{
                    background: "#0d0d0d",
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.text,
                    fontSize: 11,
                    padding: "4px 6px",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <textarea
                  value={ch.description || ""}
                  onChange={(e) => updateChar(ch.id, { description: e.target.value })}
                  placeholder="Description…"
                  style={{
                    background: "#0d0d0d",
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.textDim,
                    fontSize: 11,
                    padding: "4px 6px",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    minHeight: 52,
                  }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {CHAR_COLORS.map((col) => (
                    <div
                      key={col}
                      onClick={() => updateChar(ch.id, { color: col })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          updateChar(ch.id, { color: col })
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        background: col,
                        cursor: "pointer",
                        outline: ch.color === col ? "2px solid #fff" : "2px solid transparent",
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => {
            const c = addChar()
            setEditing(c.id)
          }}
          type='button'
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            color: C.textDim,
            fontSize: 11,
            padding: "5px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          + New Character
        </button>
      </div>
    </>
  )
}

function VariablesPanel({ tree }) {
  const { variables, addVar, updateVar, deleteVar } = tree
  const [editing, setEditing] = useState(null)
  const typeColor = { boolean: C.accent, number: C.warn, string: C.success }
  return (
    <>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {variables.length === 0 && (
          <div style={{ padding: 16, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
            No variables yet
          </div>
        )}
        {variables.map((v) => (
          <div key={v.id} style={{ borderBottom: "1px solid #141414" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                cursor: "pointer",
              }}
              onClick={() => setEditing(editing === v.id ? null : v.id)}
            >
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: typeColor[v.type],
                  background: "#111",
                  border: `1px solid #1f1f1f`,
                  borderRadius: 2,
                  padding: "1px 4px",
                }}
              >
                {v.type[0].toUpperCase()}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: C.text, fontFamily: "monospace" }}>
                {v.name || "unnamed"}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>
                {String(v.defaultValue)}
              </span>
              <IBtn
                style={{ fontSize: 13, color: "#333", marginLeft: 4 }}
                onClick={(e) => {
                  e.stopPropagation()
                  deleteVar(v.id)
                }}
              >
                ×
              </IBtn>
            </div>
            {editing === v.id && (
              <div
                style={{
                  padding: "0 12px 10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <input
                  value={v.name}
                  onChange={(e) => updateVar(v.id, { name: e.target.value.replace(/\s/g, "_") })}
                  placeholder="variable_name"
                  style={{
                    background: "#0d0d0d",
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.text,
                    fontSize: 11,
                    padding: "4px 6px",
                    outline: "none",
                    fontFamily: "monospace",
                  }}
                />
                <div style={{ display: "flex", gap: 4 }}>
                  {VAR_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() =>
                        updateVar(v.id, {
                          type: t,
                          defaultValue: t === "boolean" ? "false" : t === "number" ? "0" : "",
                        })
                      }
                      style={{
                        flex: 1,
                        background: v.type === t ? "#1a1a2e" : "#0d0d0d",
                        border: `1px solid ${v.type === t ? C.accent : C.border}`,
                        borderRadius: 3,
                        color: v.type === t ? C.accent : C.textDim,
                        fontSize: 10,
                        padding: "3px",
                        cursor: "pointer",
                        fontFamily: "monospace",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {v.type === "boolean" ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    {["true", "false"].map((val) => (
                      <button
                        key={val}
                        onClick={() => updateVar(v.id, { defaultValue: val })}
                        style={{
                          flex: 1,
                          background: v.defaultValue === val ? "#0e1a0e" : "#0d0d0d",
                          border: `1px solid ${v.defaultValue === val ? C.success : C.border}`,
                          borderRadius: 3,
                          color: v.defaultValue === val ? C.success : C.textDim,
                          fontSize: 11,
                          padding: "3px",
                          cursor: "pointer",
                          fontFamily: "monospace",
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={v.defaultValue}
                    onChange={(e) => updateVar(v.id, { defaultValue: e.target.value })}
                    placeholder="default value"
                    style={{
                      background: "#0d0d0d",
                      border: `1px solid ${C.border}`,
                      borderRadius: 3,
                      color: C.text,
                      fontSize: 11,
                      padding: "4px 6px",
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                )}
                <textarea
                  value={v.description || ""}
                  onChange={(e) => updateVar(v.id, { description: e.target.value })}
                  placeholder="What this tracks…"
                  style={{
                    background: "#0d0d0d",
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                    color: C.textDim,
                    fontSize: 11,
                    padding: "4px 6px",
                    resize: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    minHeight: 40,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={() => {
            const v = addVar()
            setEditing(v.id)
          }}
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 3,
            color: C.textDim,
            fontSize: 11,
            padding: "5px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          + New Variable
        </button>
      </div>
    </>
  )
}

function ExportPanel({ tree }) {
  const { exportAll, importAll } = tree
  const fileRef = useRef(null)
  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={exportAll}
        style={{
          background: "#0a1f0a",
          border: `1px solid #0f2f0f`,
          color: C.success,
          borderRadius: 4,
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "monospace",
          textAlign: "left",
        }}
      >
        ↓ Export JSON
      </button>
      <button
        onClick={() => fileRef.current.click()}
        style={{
          background: "#0d0d1f",
          border: `1px solid #1a1a3f`,
          color: C.accent,
          borderRadius: 4,
          padding: "8px 12px",
          cursor: "pointer",
          fontSize: 12,
          fontFamily: "monospace",
          textAlign: "left",
        }}
      >
        ↑ Import JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files[0]) importAll(e.target.files[0])
          e.target.value = ""
        }}
      />
      <p style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.7, margin: 0 }}>
        Saves all scenes, nodes, characters and variables to a single JSON file.
      </p>
    </div>
  )
}

// ─── Condition / Effect rows ──────────────────────────────────────────────────
function CondRow({ cond, variables, onChange, onDelete }) {
  const v = variables.find((vv) => vv.id === cond.varId)
  const ops =
    v?.type === "boolean"
      ? ["==", "!="]
      : v?.type === "number"
        ? ["==", "!=", "<", "<=", ">", ">="]
        : ["==", "!="]
  const sel = {
    background: "#0d0d0d",
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    color: C.text,
    fontSize: 10,
    padding: "3px",
    fontFamily: "monospace",
    outline: "none",
  }
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
      <select
        value={cond.varId || ""}
        onChange={(e) => onChange({ ...cond, varId: e.target.value })}
        style={{ ...sel, flex: 1 }}
      >
        <option value="">— var —</option>
        {variables.map((vv) => (
          <option key={vv.id} value={vv.id}>
            {vv.name}
          </option>
        ))}
      </select>
      <select
        value={cond.op || "=="}
        onChange={(e) => onChange({ ...cond, op: e.target.value })}
        style={{ ...sel, width: 38 }}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <input
        value={cond.value || ""}
        onChange={(e) => onChange({ ...cond, value: e.target.value })}
        style={{ ...sel, width: 38, color: C.warn }}
      />
      <IBtn style={{ fontSize: 12, color: "#444" }} onClick={onDelete}>
        ×
      </IBtn>
    </div>
  )
}

function EffRow({ eff, variables, onChange, onDelete }) {
  const v = variables.find((vv) => vv.id === eff.varId)
  const ops = v?.type === "boolean" ? ["set"] : v?.type === "number" ? ["set", "+=", "-="] : ["set"]
  const sel = {
    background: "#0d0d0d",
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    color: C.text,
    fontSize: 10,
    padding: "3px",
    fontFamily: "monospace",
    outline: "none",
  }
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
      <select
        value={eff.varId || ""}
        onChange={(e) => onChange({ ...eff, varId: e.target.value })}
        style={{ ...sel, flex: 1 }}
      >
        <option value="">— var —</option>
        {variables.map((vv) => (
          <option key={vv.id} value={vv.id}>
            {vv.name}
          </option>
        ))}
      </select>
      <select
        value={eff.op || "set"}
        onChange={(e) => onChange({ ...eff, op: e.target.value })}
        style={{ ...sel, width: 42 }}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <input
        value={eff.value || ""}
        onChange={(e) => onChange({ ...eff, value: e.target.value })}
        style={{ ...sel, width: 38, color: C.success }}
      />
      <IBtn style={{ fontSize: 12, color: "#444" }} onClick={onDelete}>
        ×
      </IBtn>
    </div>
  )
}

// ─── Node Panel ───────────────────────────────────────────────────────────────
function NodePanel({ node, tree }) {
  if (!node)
    return (
      <div
        style={{
          color: C.textMuted,
          padding: 20,
          fontSize: 12,
          textAlign: "center",
          paddingTop: 40,
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8, color: "#222" }}>↗</div>
        Select a node
      </div>
    )
  const [choicesCollapsed, setChoicesCollapsed] = useState(false)
  const { upd, addNode, addChoice, remChoice, updChoice, delNode, rootId, characters, variables } =
    tree

  const addCond = () =>
    upd(node.id, {
      conditions: [...(node.conditions || []), { id: uid(), varId: "", op: "==", value: "" }],
    })
  const updCond = (id, p) =>
    upd(node.id, {
      conditions: (node.conditions || []).map((c) => (c.id === id ? { ...c, ...p } : c)),
    })
  const remCond = (id) =>
    upd(node.id, { conditions: (node.conditions || []).filter((c) => c.id !== id) })
  const addEff = () =>
    upd(node.id, {
      effects: [...(node.effects || []), { id: uid(), varId: "", op: "set", value: "" }],
    })
  const updEff = (id, p) =>
    upd(node.id, { effects: (node.effects || []).map((e) => (e.id === id ? { ...e, ...p } : e)) })
  const remEff = (id) => upd(node.id, { effects: (node.effects || []).filter((e) => e.id !== id) })

  const Sec = ({ label, right }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
      }}
    >
      <span
        style={{ color: C.textMuted, fontSize: 10, fontFamily: "monospace", letterSpacing: 0.5 }}
      >
        {label}
      </span>
      {right}
    </div>
  )

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: "#0d0d0d",
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    color: C.text,
    fontSize: 12,
    padding: "5px 7px",
    outline: "none",
    fontFamily: "inherit",
    marginBottom: 10,
  }

  return (
    <div
      style={{ padding: "12px 14px", overflowY: "auto", height: "100%", boxSizing: "border-box" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span style={{ color: C.textMuted, fontSize: 10, fontFamily: "monospace" }}>
          <span style={{ color: C.accent }}>{node.id}</span>
          {node.id === rootId && <span style={{ color: C.success, marginLeft: 6 }}>ROOT</span>}
        </span>
        {node.id !== rootId && (
          <SmBtn onClick={() => delNode(node.id)} color={C.danger}>
            ✕ Delete
          </SmBtn>
        )}
      </div>

      {/* Tag */}
      <Sec label="TAG" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 12 }}>
        {Object.entries(TAG_DEFS).map(([k, t]) => (
          <button
            key={k}
            onClick={() => upd(node.id, { tag: k })}
            style={{
              background: node.tag === k ? t.bg : "#0d0d0d",
              border: `1px solid ${node.tag === k ? t.stripe : C.border}`,
              color: node.tag === k ? C.text : C.textMuted,
              borderRadius: 3,
              padding: "2px 7px",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Character */}
      <Sec label="CHARACTER" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 12 }}>
        <button
          onClick={() => upd(node.id, { characterId: null })}
          style={{
            background: !node.characterId ? "#1a1a2e" : "#0d0d0d",
            border: `1px solid ${!node.characterId ? C.accent : C.border}`,
            color: !node.characterId ? C.text : C.textMuted,
            borderRadius: 3,
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: 10,
            fontFamily: "monospace",
          }}
        >
          None
        </button>
        {characters.map((ch) => (
          <button
            key={ch.id}
            onClick={() => upd(node.id, { characterId: ch.id, speaker: ch.name })}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: node.characterId === ch.id ? "#1a1a2e" : "#0d0d0d",
              border: `1px solid ${node.characterId === ch.id ? ch.color : C.border}`,
              color: node.characterId === ch.id ? ch.color : C.textMuted,
              borderRadius: 3,
              padding: "2px 8px",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: "monospace",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 2,
                background: ch.color,
                display: "inline-block",
              }}
            />
            {ch.name}
          </button>
        ))}
        {characters.length === 0 && (
          <span style={{ color: "#2a2a2a", fontSize: 10 }}>Create characters in sidebar</span>
        )}
      </div>

      {!node.characterId && (
        <>
          <Sec label="SPEAKER" />
          <input
            value={node.speaker || ""}
            onChange={(e) => upd(node.id, { speaker: e.target.value })}
            placeholder="Character name"
            style={inputStyle}
          />
        </>
      )}

      <Sec label="DIALOGUE" />
      <textarea
        value={node.text || ""}
        onChange={(e) => upd(node.id, { text: e.target.value })}
        placeholder="What they say…"
        rows={3}
        style={{ ...inputStyle, resize: "vertical" }}
      />

      {/* Conditions */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 10 }}>
        <Sec
          label="CONDITIONS"
          right={
            <SmBtn onClick={addCond} color="#6060cc">
              + IF
            </SmBtn>
          }
        />
        {(node.conditions || []).map((c) => (
          <CondRow
            key={c.id}
            cond={c}
            variables={variables}
            onChange={(p) => updCond(c.id, p)}
            onDelete={() => remCond(c.id)}
          />
        ))}
        {!(node.conditions || []).length && (
          <div style={{ fontSize: 10, color: "#2a2a2a", fontFamily: "monospace", marginBottom: 4 }}>
            node only reachable if all conditions pass
          </div>
        )}
      </div>

      {/* Effects */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 10 }}>
        <Sec
          label="ON VISIT EFFECTS"
          right={
            <SmBtn onClick={addEff} color="#2a7a2a">
              + SET
            </SmBtn>
          }
        />
        {(node.effects || []).map((e) => (
          <EffRow
            key={e.id}
            eff={e}
            variables={variables}
            onChange={(p) => updEff(e.id, p)}
            onDelete={() => remEff(e.id)}
          />
        ))}
        {!(node.effects || []).length && (
          <div style={{ fontSize: 10, color: "#2a2a2a", fontFamily: "monospace", marginBottom: 4 }}>
            set variables when this node is visited
          </div>
        )}
      </div>

      {/* Flow */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, marginBottom: 10 }}>
        <Sec label="FLOW" />
        {node.choices.length === 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <span style={{ color: C.textDim, fontSize: 11 }}>Next:</span>
            {node.nextId ? (
              <>
                <span style={{ color: C.accent, fontSize: 11, fontFamily: "monospace" }}>
                  → {node.nextId}
                </span>
                <SmBtn onClick={() => upd(node.id, { nextId: null })} color={C.danger}>
                  ✕
                </SmBtn>
              </>
            ) : (
              <>
                <SmBtn onClick={() => addNode(node.id)} color={C.accent}>
                  + New Node
                </SmBtn>
                <span style={{ color: "#2a2a2a", fontSize: 10 }}>or drag port</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Choices */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <Sec
          label={
            <button
              type="button"
              onClick={() => setChoicesCollapsed((c) => !c)}
              style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontFamily: "monospace", fontSize: 9, letterSpacing: 1, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
            >
              <span>{choicesCollapsed ? "▶" : "▼"}</span>
              {`CHOICES (${node.choices.length})`}
            </button>
          }
          right={
            <SmBtn
              onClick={() => {
                upd(node.id, { nextId: null })
                addChoice(node.id)
              }}
            >
              + Choice
            </SmBtn>
          }
        />
        {!choicesCollapsed && node.choices.map((ch, i) => (
          <div
            key={ch.id}
            style={{
              background: "#0d0d0d",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: "8px",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ color: C.warn, fontSize: 9, fontFamily: "monospace" }}>
                CHOICE {i + 1}
              </span>
              <IBtn
                style={{ fontSize: 12, color: C.danger }}
                onClick={() => remChoice(node.id, ch.id)}
              >
                ×
              </IBtn>
            </div>
            <input
              value={ch.label}
              onChange={(e) => updChoice(node.id, ch.id, { label: e.target.value })}
              placeholder="Choice text…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#111",
                border: `1px solid ${C.border}`,
                borderRadius: 3,
                color: C.text,
                fontSize: 11,
                padding: "4px 6px",
                outline: "none",
                fontFamily: "inherit",
                marginBottom: 5,
              }}
            />
            {(ch.conditions || []).map((cc) => (
              <CondRow
                key={cc.id}
                cond={cc}
                variables={variables}
                onChange={(p) =>
                  updChoice(node.id, ch.id, {
                    conditions: ch.conditions.map((c) => (c.id === cc.id ? { ...c, ...p } : c)),
                  })
                }
                onDelete={() =>
                  updChoice(node.id, ch.id, {
                    conditions: ch.conditions.filter((c) => c.id !== cc.id),
                  })
                }
              />
            ))}
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
              {ch.nextId ? (
                <>
                  <span style={{ color: C.warn, fontSize: 10, fontFamily: "monospace" }}>
                    → {ch.nextId}
                  </span>
                  <SmBtn
                    onClick={() => updChoice(node.id, ch.id, { nextId: null })}
                    color={C.danger}
                  >
                    ✕
                  </SmBtn>
                </>
              ) : (
                <>
                  <SmBtn onClick={() => addNode(node.id, ch.id, i * 60 - 60)} color={C.success}>
                    + Branch
                  </SmBtn>
                  <span style={{ color: "#2a2a2a", fontSize: 10 }}>or drag port</span>
                </>
              )}
              <SmBtn
                onClick={() =>
                  updChoice(node.id, ch.id, {
                    conditions: [
                      ...(ch.conditions || []),
                      { id: uid(), varId: "", op: "==", value: "" },
                    ],
                  })
                }
                color="#6060cc"
              >
                + IF
              </SmBtn>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Guide Modal ──────────────────────────────────────────────────────────────
const GUIDE_SECTIONS = [
  {
    title: "Overview",
    content: [
      {
        type: "p",
        text: "The editor is split into four zones: the icon rail (far left), the sidebar (scenes, characters, variables, export), the canvas (your dialogue tree), and the node editor (far right).",
      },
      {
        type: "p",
        text: "Everything saves automatically to your browser. Use Export to back up your work or move it to another machine.",
      },
    ],
  },
  {
    title: "Nodes",
    content: [
      {
        type: "p",
        text: "A node is a single moment in dialogue — one character says one thing. Click any node on the canvas to select it and edit it in the right panel.",
      },
      {
        type: "table",
        rows: [
          ["Field", "What it does"],
          ["Tag", "Colour-codes the node (Dialogue, Action, Cutscene, Branch, End)"],
          ["Character", "Assigns a created character; their colour appears as a stripe"],
          ["Speaker", "Plain text fallback if no character is assigned"],
          ["Dialogue", "What the character says"],
          ["Conditions", "IF checks — node only reachable if all pass"],
          ["Effects", "Variables to set when this node is visited"],
        ],
      },
    ],
  },
  {
    title: "Building the Tree",
    content: [
      {
        type: "p",
        text: "The ROOT node is the entry point of each scene. You build downward from it.",
      },
      {
        type: "steps",
        items: [
          "Select a node on the canvas.",
          "Press N or click + Node to create a connected node below it.",
          "Write the speaker and dialogue in the right panel.",
          "Repeat to extend the conversation.",
        ],
      },
      { type: "p", text: "To branch (give the player choices), press C or click + Choice." },
      {
        type: "callout",
        text: "A node can have either a Next link OR choices — not both. Adding the first choice removes the linear link.",
      },
    ],
  },
  {
    title: "Connecting Nodes",
    content: [
      { type: "p", text: "Nodes have ports — small circles on their edges." },
      {
        type: "table",
        rows: [
          ["Port", "Location", "Colour", "Action"],
          ["Input", "Top centre", "Dim", "Receives connections — drop here"],
          ["Output", "Bottom centre", "Accent (indigo)", "Drag to connect to next node"],
          ["Choice ports", "Bottom, spread", "Amber", "One per choice — drag to branch target"],
        ],
      },
      {
        type: "steps",
        items: [
          "Drag from any output or choice port.",
          "A dashed line follows your cursor.",
          "Release over any input port (top of a node) to connect.",
          "Click an existing arrow to remove that connection.",
          "Click a connected port to unlink it.",
        ],
      },
    ],
  },
  {
    title: "Keyboard Shortcuts",
    content: [
      {
        type: "table",
        rows: [
          ["Key", "Action"],
          ["N", "New node (links to first empty choice, or nextId)"],
          ["C", "Add choice to selected node"],
          ["Z", "Undo last change"],
          ["Delete", "Delete selected node"],
          ["← → ↑ ↓", "Nudge selected node on canvas"],
          ["Tab", "Cycle selection through all nodes"],
          ["?", "Toggle hotkey overlay"],
          ["Escape", "Close overlays"],
        ],
      },
      {
        type: "callout",
        text: "Shortcuts are disabled while focus is inside a text field or dropdown.",
      },
    ],
  },
  {
    title: "Dialogue Simulator",
    content: [
      {
        type: "para",
        text: "The simulator lets you play through any scene exactly as a player would experience it — before you export to your game engine.",
      },
      {
        type: "steps",
        items: [
          "Open the simulator from the Projects page (🎭 Simulate button) or from the editor topbar.",
          "Pick a project and a scene from the dropdowns, then click Start simulation.",
          "Text reveals line by line. Click the text at any time to skip the typewriter animation.",
          "When a node has choices, numbered option buttons appear. Click one to branch.",
          "Linear nodes show a Next → button. Terminal nodes (no next, no choices) end the scene.",
          "At the end you see: every choice you made, who was speaking, and the full dialogue log.",
          "Use Replay scene to run through again, or Choose different scene to try another branch.",
        ],
      },
      {
        type: "callout",
        text: "Tip: the simulator reads directly from your saved project data. Always save before simulating to see your latest changes.",
      },
    ],
  },
]

function GuideModal({ onClose }) {
  const [active, setActive] = useState(0)
  const contentRef = useRef(null)
  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [active])
  const sec = GUIDE_SECTIONS[active]
  const renderBlock = (block, i) => {
    if (block.type === "p")
      return (
        <p key={i} style={{ margin: "0 0 14px 0", fontSize: 13, color: "#aaa", lineHeight: 1.75 }}>
          {block.text}
        </p>
      )
    if (block.type === "callout")
      return (
        <div
          key={i}
          style={{
            background: "#0e0e1e",
            border: `1px solid #2a2a4a`,
            borderLeft: `3px solid ${C.accent}`,
            borderRadius: 4,
            padding: "10px 14px",
            margin: "0 0 14px 0",
            fontSize: 12,
            color: "#9090cc",
            lineHeight: 1.6,
          }}
        >
          {block.text}
        </div>
      )
    if (block.type === "steps")
      return (
        <ol
          key={i}
          style={{
            margin: "0 0 14px 0",
            paddingLeft: 20,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {block.items.map((item, j) => (
            <li key={j} style={{ fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
              {item}
            </li>
          ))}
        </ol>
      )
    if (block.type === "table") {
      const [header, ...rows] = block.rows
      return (
        <div key={i} style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {header.map((h, j) => (
                  <th
                    key={j}
                    style={{
                      textAlign: "left",
                      padding: "6px 10px",
                      borderBottom: `1px solid #2a2a2a`,
                      color: C.textMuted,
                      fontFamily: "monospace",
                      fontSize: 10,
                      letterSpacing: 0.5,
                      fontWeight: 600,
                    }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, j) => (
                <tr key={j} style={{ borderBottom: `1px solid #161616` }}>
                  {row.map((cell, k) => (
                    <td
                      key={k}
                      style={{
                        padding: "7px 10px",
                        color: k === 0 ? "#ccc" : "#888",
                        fontFamily: k === 0 ? "monospace" : "inherit",
                        fontSize: k === 0 ? 11 : 12,
                        verticalAlign: "top",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    return null
  }
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
      }}
    >
      <div
        style={{
          width: "min(880px,95vw)",
          height: "min(640px,90vh)",
          background: "#0d0d0d",
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }}
      >
        <div
          style={{
            width: 190,
            background: "#0a0a0a",
            borderRight: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "16px 14px 12px", borderBottom: `1px solid ${C.border}` }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: C.accent,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              USER GUIDE
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Inkgraph</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
            {GUIDE_SECTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  background: active === i ? "#141422" : "transparent",
                  border: "none",
                  borderLeft: `2px solid ${active === i ? C.accent : "transparent"}`,
                  color: active === i ? C.text : C.textMuted,
                  fontSize: 12,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
          <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, color: "#2a2a2a", fontFamily: "monospace" }}>
              {active + 1} / {GUIDE_SECTIONS.length}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 24px 12px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.text }}>{sec.title}</h2>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                color: C.textMuted,
                fontSize: 13,
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              ✕ Close
            </button>
          </div>
          <div ref={contentRef} style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            {sec.content.map((block, i) => renderBlock(block, i))}
          </div>
          <div
            style={{
              padding: "10px 24px",
              borderTop: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={() => setActive((a) => Math.max(0, a - 1))}
              disabled={active === 0}
              style={{
                background: "transparent",
                border: `1px solid ${active === 0 ? "#1a1a1a" : C.border}`,
                borderRadius: 4,
                color: active === 0 ? "#2a2a2a" : C.textMuted,
                fontSize: 11,
                padding: "4px 12px",
                cursor: active === 0 ? "default" : "pointer",
                fontFamily: "monospace",
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setActive((a) => Math.min(GUIDE_SECTIONS.length - 1, a + 1))}
              disabled={active === GUIDE_SECTIONS.length - 1}
              style={{
                background: active === GUIDE_SECTIONS.length - 1 ? "transparent" : C.accent,
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 11,
                padding: "4px 12px",
                cursor: active === GUIDE_SECTIONS.length - 1 ? "default" : "pointer",
                fontFamily: "monospace",
                opacity: active === GUIDE_SECTIONS.length - 1 ? 0.3 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── LocalStorage Notice ──────────────────────────────────────────────────────
function LocalStorageNotice({ onClose, onLogin, onRegister }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "min(420px,92vw)",
          background: "#0f0f0f",
          border: `1px solid #2a2a2a`,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.9)",
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg,${C.accent},#a855f7)` }} />
        <div style={{ padding: "24px 24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#141422",
                border: `1px solid #2a2a4a`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                <path
                  d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Z"
                  stroke={C.accent}
                  strokeWidth="1.5"
                />
                <path
                  d="M12 8v4M12 16v.5"
                  stroke={C.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                Data stored locally
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                Your work lives in this browser
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#999", lineHeight: 1.7, marginBottom: 12 }}>
            All scenes, nodes, characters and variables are saved automatically to your browser's{" "}
            <code
              style={{
                color: C.accent,
                background: "#141422",
                padding: "1px 5px",
                borderRadius: 3,
                fontSize: 11,
              }}
            >
              localStorage
            </code>
            .
          </p>
          <p style={{ fontSize: 13, color: "#999", lineHeight: 1.7, marginBottom: 16 }}>
            This data will persist across page refreshes, but{" "}
            <span style={{ color: C.warn }}>will be lost</span> if you clear your browser storage or
            switch devices. Sign in to keep your work safe across devices.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              onClick={onLogin}
              style={{
                flex: 1,
                background: C.accent,
                border: "none",
                borderRadius: 5,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Sign in
            </button>
            <button
              onClick={onRegister}
              style={{
                flex: 1,
                background: "transparent",
                border: `1px solid #3a3a6a`,
                borderRadius: 5,
                color: "#a0a0e0",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Register
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              background: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              color: C.textMuted,
              fontSize: 12,
              padding: "8px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Continue as guest
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function ProfileModal({ onClose }) {
  const [section, setSection] = useState("main") // "main" | "password" | "delete"

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    background: "#0d0d0d",
    border: `1px solid #2a2a2a`,
    borderRadius: 5,
    color: C.text,
    fontSize: 14,
    padding: "10px 12px",
    outline: "none",
    fontFamily: "inherit",
  }
  const labelStyle = {
    display: "block",
    fontSize: 10,
    fontFamily: "monospace",
    color: C.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 56,
          flexShrink: 0,
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          paddingInline: 20,
          gap: 12,
        }}
      >
        {section !== "main" ? (
          <button
            onClick={() => setSection("main")}
            style={{
              background: "none",
              border: "none",
              color: C.textMuted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              padding: 0,
              fontFamily: "inherit",
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
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
        ) : (
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>My Profile</span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: C.textMuted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 6,
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          justifyContent: "center",
          padding: "32px 20px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>
          {/* ── Main section ── */}
          {section === "main" && (
            <>
              {/* Avatar + username */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: `linear-gradient(135deg,${C.accent},#a855f7)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                    letterSpacing: 1,
                  }}
                >
                  U
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                    username
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>user@example.com</div>
                </div>
              </div>

              {/* Username field (read-only) */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>USERNAME</label>
                <input
                  readOnly
                  value="username"
                  style={{ ...inputStyle, color: C.textMuted, cursor: "default" }}
                />
              </div>

              {/* Email field (read-only) */}
              <div style={{ marginBottom: 32 }}>
                <label style={labelStyle}>EMAIL</label>
                <input
                  readOnly
                  value="user@example.com"
                  style={{ ...inputStyle, color: C.textMuted, cursor: "default" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => setSection("password")}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    fontSize: 13,
                    padding: "12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <rect
                      x="3"
                      y="11"
                      width="18"
                      height="11"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M7 11V7a5 5 0 0 1 10 0v4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  Change password
                  <svg
                    style={{ marginLeft: "auto" }}
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <title>Icon</title>
                    <path
                      d="M9 18l6-6-6-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setSection("delete")}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid #3a1010",
                    borderRadius: 6,
                    color: "#cc4444",
                    fontSize: 13,
                    padding: "12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Delete account
                  <svg
                    style={{ marginLeft: "auto" }}
                    width="14"
                    height="14"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 18l6-6-6-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* ── Change password section ── */}
          {section === "password" && (
            <>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600, color: C.text }}>
                Change password
              </h2>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textMuted }}>
                Choose a strong password you don't use elsewhere.
              </p>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>CURRENT PASSWORD</label>
                <input type="password" placeholder="••••••••" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>NEW PASSWORD</label>
                <input type="password" placeholder="••••••••" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 32 }}>
                <label style={labelStyle}>CONFIRM NEW PASSWORD</label>
                <input type="password" placeholder="••••••••" style={inputStyle} />
              </div>

              <button
                disabled
                style={{
                  width: "100%",
                  background: "#1a1a2e",
                  border: `1px solid #3a3a6a`,
                  borderRadius: 6,
                  color: "#6a6aaa",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "12px",
                  cursor: "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                Update password
              </button>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#333",
                  textAlign: "center",
                  fontFamily: "monospace",
                }}
              >
                not implemented yet
              </p>
            </>
          )}

          {/* ── Delete account section ── */}
          {section === "delete" && (
            <>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600, color: C.danger }}>
                Delete account
              </h2>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
                This will permanently remove your account. Your local dialogue data will remain in
                this browser but won't be recoverable from the server.
              </p>

              <div
                style={{
                  background: "#1a0a0a",
                  border: `1px solid #3a1010`,
                  borderRadius: 6,
                  padding: "14px 16px",
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#cc4444",
                    fontFamily: "monospace",
                    marginBottom: 4,
                  }}
                >
                  THIS CANNOT BE UNDONE
                </div>
                <div style={{ fontSize: 12, color: "#884444", lineHeight: 1.6 }}>
                  All your synced data, settings, and account information will be permanently
                  deleted.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>TYPE YOUR USERNAME TO CONFIRM</label>
                <input placeholder="username" style={{ ...inputStyle, borderColor: "#3a1010" }} />
              </div>

              <button
                disabled
                style={{
                  width: "100%",
                  background: "#1a0a0a",
                  border: `1px solid #3a1010`,
                  borderRadius: 6,
                  color: "#774444",
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "12px",
                  cursor: "not-allowed",
                  fontFamily: "inherit",
                }}
              >
                Delete my account
              </button>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: "#333",
                  textAlign: "center",
                  fontFamily: "monospace",
                }}
              >
                not implemented yet
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
const PANELS = [
  {
    id: "scenes",
    label: "Scenes",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="10" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="17" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "characters",
    label: "Characters",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M2 21c0-4 3-7 7-7s7 3 7 7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "variables",
    label: "Variables & Flags",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
        <path
          d="M4 6h16M4 12h10M4 18h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="19" cy="17" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    id: "export",
    label: "Export / Import",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 3v10m0 0-3-3m3 3 3-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
]

const HOTKEYS = [
  ["N", "New node (fills first empty choice, then nextId)"],
  ["C", "Add choice to node"],
  ["Z", "Undo last change"],
  ["Home", "Jump to root node"],
  ["Del", "Delete selected node"],
  ["← → ↑ ↓", "Nudge node"],
  ["Tab", "Cycle nodes"],
  ["?", "Help"],
]

// ─── Named exports for routes ─────────────────────────────────────────────────
export {
  C,
  TAG_DEFS,
  CHAR_COLORS,
  VAR_TYPES,
  uid,
  mkNode,
  mkChoice,
  persist,
  restore,
  useTree,
  Canvas,
  Tooltip,
  IBtn,
  SmBtn,
  ScenesPanel,
  CharactersPanel,
  VariablesPanel,
  ExportPanel,
  CondRow,
  EffRow,
  NodePanel,
  GuideModal,
  LocalStorageNotice,
  ProfileModal,
  PANELS,
  HOTKEYS,
}