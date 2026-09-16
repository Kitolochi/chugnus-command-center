// Single source of truth for Claude model ids, labels, CLI aliases, pricing
// and effort levels. Shared by the renderer and the Electron main process.

export interface ClaudeModel {
  /** Full API id, passed to `claude --model` and to the Messages API. */
  id: string
  /** Short alias the Claude Code CLI also accepts (`--model fable`). */
  alias: string
  /** Short UI label. */
  label: string
  /** Full display name. */
  name: string
  /** USD per 1M input tokens. */
  input: number
  /** USD per 1M output tokens. */
  output: number
}

export const CLAUDE_MODELS: ClaudeModel[] = [
  { id: 'claude-fable-5-1', alias: 'fable', label: 'Fable 5.1', name: 'Claude Fable 5.1', input: 10, output: 50 },
  { id: 'claude-opus-5', alias: 'opus', label: 'Opus 5', name: 'Claude Opus 5', input: 5, output: 25 },
  { id: 'claude-sonnet-5', alias: 'sonnet', label: 'Sonnet 5', name: 'Claude Sonnet 5', input: 2, output: 10 },
  {
    id: 'claude-haiku-4-5-20251001',
    alias: 'haiku',
    label: 'Haiku 4.5',
    name: 'Claude Haiku 4.5',
    input: 1,
    output: 5,
  },
]

export const DEFAULT_MODEL = 'claude-fable-5-1'
export const FAST_MODEL = 'claude-haiku-4-5-20251001'
export const CHAT_MODEL = 'claude-sonnet-5'

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type EffortLevel = (typeof EFFORT_LEVELS)[number]
export const DEFAULT_EFFORT: EffortLevel = 'high'

// Retired ids still found in old session logs and saved settings.
// Matched by longest prefix so 'claude-opus-4-6' beats 'claude-opus-4'.
const LEGACY_PRICING: Record<string, { input: number; output: number }> = {
  'claude-fable-5': { input: 10, output: 50 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-opus-4-5': { input: 5, output: 25 },
  'claude-opus-4-1': { input: 15, output: 75 },
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

// Where a retired id lands when it shows up in saved settings.
const RETIRED_TO_CURRENT: Record<string, string> = {
  'claude-fable-5': 'claude-fable-5-1',
  'claude-opus-4': 'claude-opus-5',
  'claude-sonnet-4': 'claude-sonnet-5',
  'claude-haiku-4-5': FAST_MODEL,
}

function longestPrefixMatch<T>(id: string, table: Record<string, T>): T | undefined {
  let best: string | undefined
  for (const key of Object.keys(table)) {
    if (id.startsWith(key) && (!best || key.length > best.length)) best = key
  }
  return best === undefined ? undefined : table[best]
}

export function findModel(id: string): ClaudeModel | undefined {
  return CLAUDE_MODELS.find((m) => m.id === id)
}

export function modelLabel(id: string): string | undefined {
  return findModel(id)?.label
}

/** USD per 1M tokens. Unknown models fall back to Sonnet pricing. */
export function priceFor(id: string): { input: number; output: number } {
  const current = findModel(id)
  if (current) return { input: current.input, output: current.output }
  const legacy = longestPrefixMatch(id, LEGACY_PRICING)
  if (legacy) return legacy
  const sonnet = findModel(CHAT_MODEL)!
  return { input: sonnet.input, output: sonnet.output }
}

/** Maps a retired id to its current successor. Current and unknown ids pass through. */
export function normalizeModelId(id: string): string {
  if (findModel(id)) return id
  return longestPrefixMatch(id, RETIRED_TO_CURRENT) ?? id
}

/** Accepts an alias ('fable'), a current id, or a retired id. Unknown strings pass through. */
export function resolveModelId(aliasOrId: string): string {
  const lower = aliasOrId.trim().toLowerCase()
  const byAlias = CLAUDE_MODELS.find((m) => m.alias === lower)
  if (byAlias) return byAlias.id
  return normalizeModelId(aliasOrId.trim())
}
