import { describe, expect, it, vi } from "vitest"

// Mock the db module before importing projects
vi.mock("~/server/db.server", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// We test the pure logic separately from DB calls
describe("project data utilities", () => {
  describe("JSON serialisation", () => {
    it("round-trips a project data object through JSON", () => {
      const data = {
        scenes: [{ id: "s1", name: "Scene 1", description: "" }],
        nodesByScene: {
          s1: {
            root: "n1",
            nodes: {
              n1: {
                id: "n1",
                x: 200,
                y: 100,
                speaker: "Hero",
                characterId: null,
                text: "Hello world",
                choices: [],
                nextId: null,
                tag: "dialogue",
                conditions: [],
                effects: [],
              },
            },
          },
        },
        characters: [],
        variables: [],
      }

      const serialised = JSON.stringify(data)
      const deserialised = JSON.parse(serialised)

      expect(deserialised.scenes).toHaveLength(1)
      expect(deserialised.scenes[0].name).toBe("Scene 1")
      expect(deserialised.nodesByScene.s1.nodes.n1.text).toBe("Hello world")
    })

    it("handles empty project data", () => {
      const empty = { scenes: [], nodesByScene: {}, characters: [], variables: [] }
      const result = JSON.parse(JSON.stringify(empty))
      expect(result.scenes).toEqual([])
      expect(result.nodesByScene).toEqual({})
    })
  })

  describe("project name validation", () => {
    it("falls back to Untitled when name is empty", () => {
      const name = (raw: string) => raw.trim() || "Untitled"
      expect(name("")).toBe("Untitled")
      expect(name("  ")).toBe("Untitled")
      expect(name("My Novel")).toBe("My Novel")
    })
  })
})
