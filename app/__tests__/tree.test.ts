import { describe, expect, it } from "vitest"

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

interface Choice {
  id: string
  label: string
  nextId: string | null
  conditions: unknown[]
}

interface Node {
  id: string
  x: number
  y: number
  speaker: string
  characterId: null
  text: string
  choices: Choice[]
  nextId: string | null
  tag: string
  conditions: unknown[]
  effects: unknown[]
}

function mkNode(id: string, x = 200, y = 100): Node {
  return {
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
  }
}

function mkChoice(label = ""): Choice {
  return { id: uid(), label, nextId: null, conditions: [] }
}

describe("mkNode", () => {
  it("creates a node with default position", () => {
    const node = mkNode("n1")
    expect(node.x).toBe(200)
    expect(node.y).toBe(100)
    expect(node.choices).toEqual([])
    expect(node.nextId).toBeNull()
  })

  it("accepts custom position", () => {
    const node = mkNode("n1", 400, 300)
    expect(node.x).toBe(400)
    expect(node.y).toBe(300)
  })

  it("creates independent choice arrays", () => {
    const a = mkNode("a")
    const b = mkNode("b")
    a.choices.push(mkChoice("opt"))
    expect(b.choices).toHaveLength(0)
  })
})

describe("mkChoice", () => {
  it("creates a choice with empty label by default", () => {
    const c = mkChoice()
    expect(c.label).toBe("")
    expect(c.nextId).toBeNull()
    expect(c.conditions).toEqual([])
  })

  it("creates a choice with provided label", () => {
    const c = mkChoice("Attack")
    expect(c.label).toBe("Attack")
  })
})

describe("node linking", () => {
  it("can link two nodes via nextId", () => {
    const nodes: Record<string, Node> = {}
    const n1 = mkNode("n1")
    const n2 = mkNode("n2")
    nodes.n1 = n1
    nodes.n2 = n2

    nodes.n1 = { ...nodes.n1, nextId: "n2" }

    expect(nodes.n1.nextId).toBe("n2")
    expect(nodes.n2.nextId).toBeNull()
  })

  it("can unlink nodes", () => {
    const node = { ...mkNode("n1"), nextId: "n2" }
    const unlinked = { ...node, nextId: null }
    expect(unlinked.nextId).toBeNull()
  })

  it("cleans up references when deleting a node", () => {
    let nodes: Record<string, Node> = {
      n1: { ...mkNode("n1"), nextId: "n2" },
      n2: mkNode("n2"),
    }

    const idToDelete = "n2"
    const updated: Record<string, Node> = {}
    for (const [k, n] of Object.entries(nodes)) {
      if (k === idToDelete) continue
      updated[k] = {
        ...n,
        nextId: n.nextId === idToDelete ? null : n.nextId,
        choices: n.choices.map((c) => ({
          ...c,
          nextId: c.nextId === idToDelete ? null : c.nextId,
        })),
      }
    }
    nodes = updated

    expect(nodes.n2).toBeUndefined()
    expect(nodes.n1.nextId).toBeNull()
  })
})
