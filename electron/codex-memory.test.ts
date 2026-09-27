// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

const state = vi.hoisted(() => ({ memories: [] as any[], llm: vi.fn() }))
vi.mock('./database', () => ({
  getAllMemories: () => state.memories,
  getMemoryTopics: () => [],
  getMemorySettings: () => ({ autoGenerate: false, maxMemoriesInContext: 5, tokenBudget: 800 }),
  createMemory: (memory: any) => ({ ...memory, id: 'memory-1', createdAt: new Date().toISOString() }),
}))
vi.mock('./cli-logs', () => ({ getCliSessions: vi.fn(), getCliSessionMessages: vi.fn() }))
vi.mock('./llm', () => ({ isLLMConfigured: () => true, callLLM: state.llm }))
vi.mock('./codex-history', () => ({
  discoverCodexHistory: () => [],
  readCodexTranscript: async () => ({ messages: [{ role: 'user', content: 'The Chungus accent is gold.' }, { role: 'assistant', content: 'I will use gold.' }] }),
}))
import { extractMemoriesFromCli, getRelevantMemories } from './memory'

describe('shared Codex memories', () => {
  it('extracts Codex knowledge into the shared store and retrieves it for future prompts', async () => {
    state.memories.length = 0
    state.llm.mockResolvedValue(JSON.stringify([{ title: 'Chungus accent color', content: 'Use a gold accent for Chungus.', topics: ['chungus', 'design'], importance: 2 }]))
    const saved = await extractMemoriesFromCli('codex:thread-123', true)
    expect(saved).toHaveLength(1)
    expect(saved[0].sourceId).toBe('codex:thread-123')
    expect(saved[0].sourcePreview).toContain('Codex:')
    expect(getRelevantMemories('Update the Chungus design', [])[0].content).toContain('gold')
    expect(await extractMemoriesFromCli('codex:thread-123', true)).toHaveLength(0)
  })
  it('surfaces provider errors for explicit extraction', async () => {
    state.llm.mockRejectedValue(new Error('Provider unavailable'))
    await expect(extractMemoriesFromCli('codex:thread-123', true)).rejects.toThrow('Provider unavailable')
  })
})
