import { describe, it, expect } from 'vitest'
import { CLAUDE_MODELS, DEFAULT_MODEL, FAST_MODEL, EFFORT_LEVELS, priceFor, resolveModelId, modelLabel } from './models'

describe('model registry', () => {
  it('defaults to Fable 5.1 and lists it first', () => {
    expect(DEFAULT_MODEL).toBe('claude-fable-5-1')
    expect(CLAUDE_MODELS[0].id).toBe(DEFAULT_MODEL)
  })

  it('has a fast model that is in the list', () => {
    expect(CLAUDE_MODELS.some((m) => m.id === FAST_MODEL)).toBe(true)
  })

  it('gives every model a unique alias and positive pricing', () => {
    const aliases = CLAUDE_MODELS.map((m) => m.alias)
    expect(new Set(aliases).size).toBe(aliases.length)
    for (const m of CLAUDE_MODELS) {
      expect(m.input).toBeGreaterThan(0)
      expect(m.output).toBeGreaterThan(0)
    }
  })

  it('includes xhigh between high and max', () => {
    expect([...EFFORT_LEVELS]).toEqual(['low', 'medium', 'high', 'xhigh', 'max'])
  })
})

describe('priceFor', () => {
  it('returns current pricing for an exact id', () => {
    expect(priceFor('claude-fable-5-1')).toEqual({ input: 10, output: 50 })
    expect(priceFor('claude-opus-5')).toEqual({ input: 5, output: 25 })
  })

  it('prices retired dated ids found in old session logs', () => {
    expect(priceFor('claude-sonnet-4-5-20250929')).toEqual({ input: 3, output: 15 })
    expect(priceFor('claude-haiku-4-5-20251001')).toEqual({ input: 1, output: 5 })
  })

  it('picks the longest matching prefix so Opus 4.6 is not billed at Opus 4 rates', () => {
    expect(priceFor('claude-opus-4-6')).toEqual({ input: 5, output: 25 })
    expect(priceFor('claude-opus-4-1-20250805')).toEqual({ input: 15, output: 75 })
  })

  it('falls back to Sonnet pricing for unknown models', () => {
    expect(priceFor('<synthetic>')).toEqual(priceFor('claude-sonnet-5'))
  })
})

describe('resolveModelId', () => {
  it('turns an alias into the current id, case-insensitive', () => {
    expect(resolveModelId('fable')).toBe('claude-fable-5-1')
    expect(resolveModelId('OPUS')).toBe('claude-opus-5')
    expect(resolveModelId('sonnet')).toBe('claude-sonnet-5')
    expect(resolveModelId('haiku')).toBe(FAST_MODEL)
  })

  it('keeps a current full id as is', () => {
    expect(resolveModelId('claude-opus-5')).toBe('claude-opus-5')
  })

  it('upgrades a retired id saved in settings to its current successor', () => {
    expect(resolveModelId('claude-sonnet-4-5-20250929')).toBe('claude-sonnet-5')
    expect(resolveModelId('claude-opus-4-6')).toBe('claude-opus-5')
    expect(resolveModelId('claude-opus-4-7')).toBe('claude-opus-5')
    expect(resolveModelId('claude-fable-5')).toBe('claude-fable-5-1')
  })

  it('passes unknown ids through untouched', () => {
    expect(resolveModelId('gpt-5.3-codex')).toBe('gpt-5.3-codex')
  })
})

describe('modelLabel', () => {
  it('returns the short label for a known model', () => {
    expect(modelLabel('claude-fable-5-1')).toBe('Fable 5.1')
  })

  it('returns undefined for an unknown model', () => {
    expect(modelLabel('gpt-5.3-codex')).toBeUndefined()
  })
})
