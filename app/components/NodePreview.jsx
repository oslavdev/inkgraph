const NW = 180
const NH = 72
const W = 760
const H = 430

const PREVIEW_NODES = [
  {
    id: "n1",
    x: 280,
    y: 30,
    tag: { bg: "#0e1a2e", stripe: "#1e3a5f" },
    char: "Lyra",
    charColor: "#a855f7",
    text: "What do you want here?",
    choices: true,
    end: false,
  },
  {
    id: "n2",
    x: 80,
    y: 180,
    tag: { bg: "#0e1a0e", stripe: "#1f3a1a" },
    char: "Lyra",
    charColor: "#a855f7",
    text: "Then you'll answer to me.",
    choices: false,
    end: false,
  },
  {
    id: "n3",
    x: 490,
    y: 180,
    tag: { bg: "#0e1a2e", stripe: "#1e3a5f" },
    char: "Guard",
    charColor: "#f59e0b",
    text: "Just passing through, ma'am.",
    choices: false,
    end: false,
  },
  {
    id: "n4",
    x: 80,
    y: 320,
    tag: { bg: "#1a0a0a", stripe: "#3a1010" },
    char: "",
    charColor: "",
    text: "[Combat starts]",
    choices: false,
    end: true,
  },
  {
    id: "n5",
    x: 490,
    y: 320,
    tag: { bg: "#161616", stripe: "#252525" },
    char: "Lyra",
    charColor: "#a855f7",
    text: "Move along, then.",
    choices: false,
    end: false,
  },
]

const PREVIEW_ARROWS = [
  {
    id: "a1",
    x1: 280 + NW * 0.3,
    y1: 30 + NH,
    x2: 80 + NW / 2,
    y2: 180,
    color: "#f59e0b",
    label: '"I\'m looking for trouble."',
  },
  {
    id: "a2",
    x1: 280 + NW * 0.7,
    y1: 30 + NH,
    x2: 490 + NW / 2,
    y2: 180,
    color: "#f59e0b",
    label: '"Just passing through."',
  },
  {
    id: "a3",
    x1: 80 + NW / 2,
    y1: 180 + NH,
    x2: 80 + NW / 2,
    y2: 320,
    color: "#6366f1",
    label: "",
  },
  {
    id: "a4",
    x1: 490 + NW / 2,
    y1: 180 + NH,
    x2: 490 + NW / 2,
    y2: 320,
    color: "#6366f1",
    label: "",
  },
]

const GRID_DOTS = Array.from({ length: 96 }, (_, i) => ({
  id: `dot-${i}`,
  cx: Math.floor(i / 8) * 70 + 10,
  cy: (i % 8) * 60 + 10,
}))

function PreviewArrow({ arrow }) {
  const dy = arrow.y2 - arrow.y1
  const path = `M ${arrow.x1} ${arrow.y1} C ${arrow.x1} ${arrow.y1 + Math.max(30, dy * 0.5)}, ${arrow.x2} ${arrow.y2 - Math.max(30, dy * 0.5)}, ${arrow.x2} ${arrow.y2}`
  const mid = { x: (arrow.x1 + arrow.x2) / 2, y: (arrow.y1 + arrow.y2) / 2 }
  const isWarn = arrow.color === "#f59e0b"
  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={arrow.color}
        strokeWidth="1.5"
        strokeOpacity=".7"
        markerEnd={`url(#arr-${isWarn ? "warn" : "acc"})`}
      />
      {arrow.label && (
        <text
          x={mid.x + (isWarn && arrow.id === "a1" ? -30 : 30)}
          y={mid.y}
          fill="#555"
          fontSize="10"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {arrow.label}
        </text>
      )}
    </g>
  )
}

function PreviewNode({ node }) {
  const flowLabel = node.end ? "END" : node.choices ? "2 choices" : "→ linked"
  const flowColor = node.end ? "#3a1010" : node.choices ? "#f59e0b" : "#2a5a2a"
  const textX = node.x + (node.char ? 22 : 10)

  return (
    <g>
      <rect
        x={node.x}
        y={node.y}
        width={NW}
        height={NH}
        rx="5"
        fill={node.tag.bg}
        stroke={node.end ? "#3a1010" : "#2a2a2a"}
        strokeWidth="1"
      />
      <rect x={node.x} y={node.y} width="3" height={NH} rx="2" fill={node.tag.stripe} />
      {node.char && (
        <rect
          x={node.x + 8}
          y={node.y + 10}
          width="7"
          height={NH - 20}
          rx="2"
          fill={node.charColor}
          opacity=".85"
        />
      )}
      <text
        x={textX}
        y={node.y + 26}
        fill={node.charColor || "#555"}
        fontSize="11"
        fontFamily="monospace"
        fontWeight="600"
      >
        {node.char || "—"}
      </text>
      <text x={textX} y={node.y + 44} fill="#777" fontSize="10" fontFamily="sans-serif">
        {node.text.substring(0, 22)}
        {node.text.length > 22 ? "…" : ""}
      </text>
      <text x={textX} y={node.y + 60} fill={flowColor} fontSize="9" fontFamily="monospace">
        {flowLabel}
      </text>
      <circle
        cx={node.x + NW / 2}
        cy={node.y}
        r="4.5"
        fill="#0a0a0a"
        stroke="#2a2a2a"
        strokeWidth="1.5"
      />
      {!node.choices && (
        <circle
          cx={node.x + NW / 2}
          cy={node.y + NH}
          r="4.5"
          fill="#0a0a0a"
          stroke={node.end ? "#3a1010" : "#6366f1"}
          strokeWidth="1.5"
        />
      )}
      {node.choices && (
        <>
          <circle
            cx={node.x + NW * 0.3}
            cy={node.y + NH}
            r="4.5"
            fill="#0a0a0a"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
          <circle
            cx={node.x + NW * 0.7}
            cy={node.y + NH}
            r="4.5"
            fill="#0a0a0a"
            stroke="#f59e0b"
            strokeWidth="1.5"
          />
        </>
      )}
    </g>
  )
}

export function NodePreview() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", maxWidth: 760, height: "auto", display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Example dialogue tree showing a branching conversation between Lyra and a Guard"
    >
      <title>Example dialogue tree — Inkgraph node preview</title>
      <defs>
        <marker id="arr-acc" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#6366f1" opacity=".8" />
        </marker>
        <marker id="arr-warn" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#f59e0b" opacity=".8" />
        </marker>
      </defs>

      {GRID_DOTS.map((dot) => (
        <circle key={dot.id} cx={dot.cx} cy={dot.cy} r={1} fill="#1a1a1a" />
      ))}

      {PREVIEW_ARROWS.map((arrow) => (
        <PreviewArrow key={arrow.id} arrow={arrow} />
      ))}

      {PREVIEW_NODES.map((node) => (
        <PreviewNode key={node.id} node={node} />
      ))}

      <g transform="translate(10,395)">
        <circle cx="6" cy="6" r="4.5" fill="#0a0a0a" stroke="#6366f1" strokeWidth="1.5" />
        <text x="15" y="10" fill="#444" fontSize="10" fontFamily="monospace">
          output / input port
        </text>
        <circle cx="150" cy="6" r="4.5" fill="#0a0a0a" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="159" y="10" fill="#444" fontSize="10" fontFamily="monospace">
          choice port
        </text>
        <rect x="280" y="1" width="10" height="10" rx="2" fill="#0e1a2e" />
        <text x="294" y="10" fill="#444" fontSize="10" fontFamily="monospace">
          dialogue node
        </text>
        <rect x="420" y="1" width="10" height="10" rx="2" fill="#0e1a0e" />
        <text x="434" y="10" fill="#444" fontSize="10" fontFamily="monospace">
          action node
        </text>
      </g>
    </svg>
  )
}
