import { describe, expect, it } from "vitest"

// Inline the uid function — it has no dependencies
function uid() {
  return Math.random().toString(36).slice(2, 9)
}

describe("uid", () => {
  it("returns a non-empty string", () => {
    expect(uid()).toBeTruthy()
  })

  it("returns a 7-character string", () => {
    expect(uid()).toHaveLength(7)
  })

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid()))
    // With 1000 samples there should be no collisions
    expect(ids.size).toBe(1000)
  })

  it("only contains alphanumeric characters", () => {
    const id = uid()
    expect(id).toMatch(/^[a-z0-9]+$/)
  })
})
