import type { CSSProperties, ReactNode, RefObject } from "react"

// ─── Theme constants ──────────────────────────────────────────────────────────

/** Design token map shared across all editor components. */
export declare const C: {
  bg: string
  surface: string
  surface2: string
  border: string
  accent: string
  text: string
  textMuted: string
  textDim: string
  danger: string
  success: string
  warn: string
}

/** Tag type definitions — each key maps to display label, background, and stripe colour. */
export declare const TAG_DEFS: Record<string, { label: string; bg: string; stripe: string }>

/** Preset palette of character accent colours, cycled by character index. */
export declare const CHAR_COLORS: string[]

/** Allowed variable types: `"boolean"`, `"number"`, `"string"`. */
export declare const VAR_TYPES: string[]

// ─── Panel / hotkey config ────────────────────────────────────────────────────

export interface PanelConfig {
  id: string
  label: string
  icon: ReactNode
}

/** Sidebar rail panel descriptors used to render the icon rail and panel headers. */
export declare const PANELS: PanelConfig[]

/**
 * Keyboard shortcut definitions rendered in the hotkey overlay and Guide modal.
 * Each entry is a `[key, description]` tuple.
 *
 * @example
 * HOTKEYS.map(([key, desc]) => <div>{key} — {desc}</div>)
 */
export declare const HOTKEYS: [string, string][]

// ─── Data types ───────────────────────────────────────────────────────────────

/** A single player-selectable option on a dialogue node. */
export interface Choice {
  id: string
  /** Display label shown to the player. */
  label: string
  /** ID of the node this choice leads to, or `null` if unconnected. */
  nextId: string | null
  /** Optional conditions that must be true for this choice to appear. */
  conditions: Condition[]
}

/** A boolean/numeric/string guard that gates a node or choice. */
export interface Condition {
  id: string
  /** ID of the story variable being tested. */
  varId: string
  /** Comparison operator: `"=="`, `"!="`, `">"`, `">="`, `"<"`, `"<="`. */
  op: string
  /** Right-hand side value as a string. */
  value: string
}

/** A side-effect applied to a story variable when a node is visited. */
export interface Effect {
  id: string
  /** ID of the story variable to mutate. */
  varId: string
  /** Mutation operator: `"set"`, `"+="`, `"-="`, `"toggle"`. */
  op: string
  value: string
}

/** A single dialogue node on the canvas. */
export interface Node {
  id: string
  /** Canvas X position in logical (pre-pan) coordinates. */
  x: number
  /** Canvas Y position in logical (pre-pan) coordinates. */
  y: number
  /** Free-text speaker label (overrides characterId name if both set). */
  speaker: string
  /** Character assigned to this node, or `null` for narrator lines. */
  characterId: string | null
  /** Dialogue text shown to the player. */
  text: string
  /** Player choices. Mutually exclusive with `nextId` in practice. */
  choices: Choice[]
  /** ID of the next linear node, or `null` if this node has choices or ends the scene. */
  nextId: string | null
  /** Tag key — one of the keys in `TAG_DEFS`. */
  tag: string
  /** Entry conditions — if any fail the node is skipped during playback. */
  conditions: Condition[]
  /** Effects applied when this node is visited. */
  effects: Effect[]
}

export interface Scene {
  id: string
  name: string
  description: string
}

export interface Character {
  id: string
  name: string
  /** CSS colour string used for the node stripe and character avatar. */
  color: string
}

export interface Variable {
  id: string
  name: string
  /** One of `VAR_TYPES`. */
  type: string
  defaultValue: string
}

export interface SceneData {
  /** ID of the root (starting) node. */
  root: string | null
  nodes: Record<string, Node>
}

// ─── useTree ──────────────────────────────────────────────────────────────────

/**
 * Complete state and mutations returned by `useTree`.
 * Pass the whole object as the `tree` prop to all editor sub-components.
 */
export interface TreeState {
  /** All nodes in the currently active scene, keyed by node ID. */
  nodes: Record<string, Node>
  /** ID of the root node in the active scene. */
  rootId: string | null
  /** Currently selected node ID, or `null` if nothing is selected. */
  sel: string | null
  /** Set of node IDs in the active multi-selection. */
  multiSel: Set<string>
  setSel: (id: string | null) => void
  /** Toggle a node into or out of the multi-selection. */
  toggleMultiSel: (id: string) => void
  /** Clear the entire multi-selection. */
  clearMultiSel: () => void
  /** Shallow-merge `patch` into the node with the given ID. */
  upd: (id: string, patch: Partial<Node>) => void
  /**
   * Create a new node after `afterId`, optionally wired to a specific `choiceId`.
   * @returns The new node's ID.
   * @example
   * const newId = addNode(sel) // linear link
   * const newId = addNode(sel, choice.id, 120) // offset under a choice
   */
  addNode: (afterId: string, choiceId?: string | null, ox?: number) => string
  /**
   * Smart version of `addNode` used by the N key.
   * Links the new node to the first empty choice if any exist;
   * adds a new choice if all are filled; falls back to `nextId` otherwise.
   *
   * @example
   * addNodeSmart(sel) // always does the right thing
   */
  addNodeSmart: (fromId: string) => void
  /** Add a new empty choice to the given node. */
  addChoice: (nodeId: string) => void
  remChoice: (nodeId: string, choiceId: string) => void
  updChoice: (nodeId: string, choiceId: string, patch: Partial<Choice>) => void
  /**
   * Delete a node and unlink any references to it.
   * No-op if `id` is the root node.
   */
  delNode: (id: string) => void
  /** Translate a single node by `(dx, dy)` pixels. */
  movNode: (id: string, dx: number, dy: number) => void
  /**
   * Translate multiple nodes simultaneously — used during multi-select drag.
   * @example
   * movNodes([...multiSel], dx, dy)
   */
  movNodes: (ids: string[], dx: number, dy: number) => void
  /** Connect two nodes with a linear link or via a choice port. */
  linkNodes: (fromId: string, toId: string, choiceId?: string | null) => void
  /** Remove the link from `fromId` (or from a specific choice). */
  unlinkNode: (fromId: string, choiceId?: string | null) => void
  scenes: Scene[]
  activeSceneId: string | null
  switchScene: (id: string) => void
  addScene: (name: string) => void
  updateScene: (id: string, patch: Partial<Scene>) => void
  deleteScene: (id: string) => void
  /** Replace the scene order with a new array — used for drag-to-reorder. */
  reorderScenes: (scenes: Scene[]) => void
  characters: Character[]
  addChar: () => Character
  updateChar: (id: string, patch: Partial<Character>) => void
  deleteChar: (id: string) => void
  variables: Variable[]
  addVar: () => Variable
  updateVar: (id: string, patch: Partial<Variable>) => void
  deleteVar: (id: string) => void
  /** All scenes' node maps — needed for cross-scene stats (e.g. node count badge). */
  nodesByScene: Record<string, SceneData>
  /**
   * Serialise the full project (all scenes, characters, variables) to a JSON string
   * and trigger a browser download.
   */
  exportAll: () => void
  /**
   * Parse a JSON file exported by `exportAll` and replace the current project state.
   * @param file - A `File` object from an `<input type="file">` element.
   */
  importAll: (file: File) => void
  /**
   * Undo the last node mutation. Restores the previous `nodesByScene` snapshot.
   * Up to 50 steps are kept in the history stack.
   *
   * @example
   * // Z key handler
   * undo()
   */
  undo: () => void
}

interface InitialData {
  scenes?: Array<{ id: string; name: string; description: string }>
  nodesByScene?: Record<string, SceneData>
  characters?: Character[]
  variables?: Variable[]
}

/**
 * Core state hook for the dialogue editor.
 * Persists to `localStorage` under `vn2-*` keys on every change.
 *
 * @param initialData - Optional seed data (e.g. parsed from a DB project row).
 *   When provided, takes precedence over localStorage — prevents SSR/hydration mismatch.
 * @returns Full `TreeState` — pass the whole object as `tree` to editor components.
 *
 * @example
 * const data = JSON.parse(project.data)
 * const tree = useTree(data)
 * return <Canvas tree={tree} viewRef={ref} />
 */
export declare function useTree(initialData?: InitialData | null): TreeState

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Generate a random 7-character alphanumeric ID.
 * @example
 * const id = uid() // "a3x9kqm"
 */
export declare function uid(): string

/**
 * Create a blank node at the given canvas position.
 * @param id - Pre-generated ID (use `uid()`).
 * @param x - Canvas X in logical coordinates. Defaults to `200`.
 * @param y - Canvas Y in logical coordinates. Defaults to `100`.
 */
export declare function mkNode(id: string, x?: number, y?: number): Node

/**
 * Create a blank choice with an optional label.
 * @example
 * const c = mkChoice("Yes, I agree")
 */
export declare function mkChoice(label?: string): Choice

/**
 * Write a value to `localStorage` under the given key.
 * Silently ignores write errors (e.g. private-browsing quota).
 */
export declare function persist(key: string, value: unknown): void

/**
 * Read and JSON-parse a value from `localStorage`.
 * Returns `fallback` if the key is missing or the value is invalid JSON.
 *
 * @example
 * const scenes = restore("vn2-scenes", [])
 */
export declare function restore<T>(key: string, fallback: T): T

// ─── Components ───────────────────────────────────────────────────────────────

/**
 * Infinite SVG canvas with pan, drag, port-connections, and a minimap.
 * Renders all nodes and arrows for the active scene.
 */
export declare function Canvas(props: {
  tree: TreeState
  viewRef: RefObject<HTMLDivElement | null>
  onJumpToRoot?: () => void
}): JSX.Element

/** Hover tooltip wrapper — renders `children` with a floating label on hover. */
export declare function Tooltip(props: {
  label: string
  children: ReactNode
}): JSX.Element

/** Minimal icon button — transparent background, monospace text. */
export declare function IBtn(props: {
  onClick: () => void
  style?: CSSProperties
  children: ReactNode
}): JSX.Element

/** Small labelled action button used inside panels and node rows. */
export declare function SmBtn(props: {
  onClick: () => void
  children: ReactNode
  color?: string
}): JSX.Element

/** Sidebar panel — lists scenes, lets users add, rename, reorder, and delete them. */
export declare function ScenesPanel(props: { tree: TreeState }): JSX.Element

/** Sidebar panel — manage characters and their accent colours. */
export declare function CharactersPanel(props: { tree: TreeState }): JSX.Element

/** Sidebar panel — manage story variables (boolean/number/string). */
export declare function VariablesPanel(props: { tree: TreeState }): JSX.Element

/** Sidebar panel — export to JSON or import from a file. */
export declare function ExportPanel(props: { tree: TreeState }): JSX.Element

/** Inline condition row used inside the NodePanel conditions list. */
export declare function CondRow(props: {
  cond: Condition
  variables: Variable[]
  onChange: (patch: Partial<Condition>) => void
  onDelete: () => void
}): JSX.Element

/** Inline effect row used inside the NodePanel effects list. */
export declare function EffRow(props: {
  eff: Effect
  variables: Variable[]
  onChange: (patch: Partial<Effect>) => void
  onDelete: () => void
}): JSX.Element

/**
 * Right-hand panel — edit the selected node's text, speaker, tag, choices,
 * conditions, and effects.
 * Renders an empty state when `node` is `undefined`.
 */
export declare function NodePanel(props: {
  node: Node | undefined
  tree: TreeState
}): JSX.Element

/**
 * Multi-page guide modal — explains the editor layout, node types,
 * keyboard shortcuts, and the simulator.
 */
export declare function GuideModal(props: { onClose: () => void }): JSX.Element

/**
 * Notice shown to unauthenticated users about localStorage-only persistence.
 * Offers sign-in and register actions.
 */
export declare function LocalStorageNotice(props: {
  onClose: () => void
  onLogin: () => void
  onRegister: () => void
}): JSX.Element

export declare function ProfileModal(props: { onClose: () => void }): JSX.Element