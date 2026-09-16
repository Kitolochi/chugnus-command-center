import { describe, it, expect, vi } from 'vitest'

// database.ts imports electron + ./secrets at module load; stub them so the
// module can be imported in the test environment.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
vi.mock('./secrets', () => ({ getSecret: () => undefined, setSecret: () => {} }))

import { isValidDbJson } from './database'

const NUL = String.fromCharCode(0)

describe('isValidDbJson', () => {
  it('accepts a real JSON object', () => {
    expect(isValidDbJson(JSON.stringify({ tasks: [], categories: [] }))).toBe(true)
  })

  it('rejects an empty or whitespace-only file', () => {
    expect(isValidDbJson('')).toBe(false)
    expect(isValidDbJson(' '.repeat(40))).toBe(false)
  })

  it('rejects a NUL-filled file (the interrupted-write corruption)', () => {
    // 190 KB of NUL bytes, matching the real corrupted DB files. .trim() does
    // not strip NUL, so the old length-based guard let this through to a
    // crashing JSON.parse. isValidDbJson must reject it.
    expect(isValidDbJson(NUL.repeat(190000))).toBe(false)
  })

  it('rejects truncated / leading-whitespace garbage', () => {
    expect(isValidDbJson('          {"tasks":')).toBe(false)
  })

  it('rejects a non-object JSON value', () => {
    expect(isValidDbJson('42')).toBe(false)
  })
})
