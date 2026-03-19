import type { CSSProperties, ReactNode, RefObject } from "react"

// ─── Theme constants ──────────────────────────────────────────────────────────

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

export declare const TAG_DEFS: Record<string, { label: string; bg: string; stripe: string }>
export declare const CHAR_COLORS: string[]
export declare const VAR_TYPES: string[]

// ─── Panel / hotkey config ────────────────────────────────────────────────────

export interface PanelConfig {
  id: string
  label: string
  icon: ReactNode
}

export declare const PANELS: PanelConfig[]
export declare const HOTKEYS: [string, string][]

// ─── Data types ───────────────────────────────────────────────────────────────

export interface Choice {
  id: string
  label: string
  nextId: string | null
  conditions: Condition[]
}

export interface Condition {
  id: string
  varId: string
  op: string
  value: string
}

export interface Effect {
  id: string
  varId: string
  op: string
  value: string
}

export interface Node {
  id: string
  x: number
  y: number
  speaker: string
  characterId: string | null
  text: string
  choices: Choice[]
  nextId: string | null
  tag: string
  conditions: Condition[]
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
  color: string
}

export interface Variable {
  id: string
  name: string
  type: string
  defaultValue: string
}

export interface SceneData {
  root: string | null
  nodes: Record<string, Node>
}

// ─── useTree ──────────────────────────────────────────────────────────────────

export interface TreeState {
  nodes: Record<string, Node>
  rootId: string | null
  sel: string | null
  setSel: (id: string | null) => void
  upd: (id: string, patch: Partial<Node>) => void
  addNode: (afterId: string) => void
  addChoice: (nodeId: string) => void
  remChoice: (nodeId: string, choiceId: string) => void
  updChoice: (nodeId: string, choiceId: string, patch: Partial<Choice>) => void
  delNode: (id: string) => void
  movNode: (id: string, dx: number, dy: number) => void
  linkNodes: (fromId: string, toId: string) => void
  unlinkNode: (fromId: string) => void
  scenes: Scene[]
  activeSceneId: string | null
  switchScene: (id: string) => void
  addScene: () => void
  updateScene: (id: string, patch: Partial<Scene>) => void
  deleteScene: (id: string) => void
  characters: Character[]
  addChar: () => void
  updateChar: (id: string, patch: Partial<Character>) => void
  deleteChar: (id: string) => void
  variables: Variable[]
  addVar: () => void
  updateVar: (id: string, patch: Partial<Variable>) => void
  deleteVar: (id: string) => void
  nodesByScene: Record<string, SceneData>
  exportAll: () => string
  importAll: (json: string) => void
}

interface InitialData {
  scenes?: Array<{ id: string; name: string; description: string }>
  nodesByScene?: Record<string, SceneData>
  characters?: Character[]
  variables?: Variable[]
}

export declare function useTree(initialData?: InitialData | null): TreeState

// ─── Utilities ────────────────────────────────────────────────────────────────

export declare function uid(): string
export declare function mkNode(id: string, x?: number, y?: number): Node
export declare function mkChoice(label?: string): Choice
export declare function persist(key: string, value: unknown): void
export declare function restore<T>(key: string, fallback: T): T

// ─── Components ───────────────────────────────────────────────────────────────

export declare function Canvas(props: {
  tree: TreeState
  viewRef: RefObject<HTMLDivElement | null>
}): JSX.Element

export declare function Tooltip(props: {
  label: string
  children: ReactNode
}): JSX.Element

export declare function IBtn(props: {
  onClick: () => void
  style?: CSSProperties
  children: ReactNode
}): JSX.Element

export declare function SmBtn(props: {
  onClick: () => void
  children: ReactNode
  color?: string
}): JSX.Element

export declare function ScenesPanel(props: { tree: TreeState }): JSX.Element
export declare function CharactersPanel(props: { tree: TreeState }): JSX.Element
export declare function VariablesPanel(props: { tree: TreeState }): JSX.Element
export declare function ExportPanel(props: { tree: TreeState }): JSX.Element

export declare function CondRow(props: {
  cond: Condition
  variables: Variable[]
  onChange: (patch: Partial<Condition>) => void
  onDelete: () => void
}): JSX.Element

export declare function EffRow(props: {
  eff: Effect
  variables: Variable[]
  onChange: (patch: Partial<Effect>) => void
  onDelete: () => void
}): JSX.Element

export declare function NodePanel(props: {
  node: Node | undefined
  tree: TreeState
}): JSX.Element

export declare function GuideModal(props: { onClose: () => void }): JSX.Element

export declare function LocalStorageNotice(props: {
  onClose: () => void
  onLogin: () => void
  onRegister: () => void
}): JSX.Element

export declare function ProfileModal(props: { onClose: () => void }): JSX.Element