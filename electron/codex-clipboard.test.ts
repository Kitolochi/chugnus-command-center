// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
const mocks = vi.hoisted(() => ({ directory: '', buffers: new Map<string, Buffer>(), imageEmpty: true }))
vi.mock('electron', () => ({
  app: { getPath: () => mocks.directory },
  clipboard: { readBuffer: (format: string) => mocks.buffers.get(format) || Buffer.alloc(0), readImage: () => ({ isEmpty: () => mocks.imageEmpty, toPNG: () => Buffer.from('png-fixture') }) },
  nativeImage: { createFromBuffer: (buffer: Buffer) => ({ isEmpty: () => buffer.toString() === 'invalid', toPNG: () => Buffer.from('png-fixture') }) },
}))
import { decodeDropFiles, pasteClipboardImages, savePastedImage } from './codex-clipboard'
function dropFiles(paths: string[]) {
  const header = Buffer.alloc(20); header.writeUInt32LE(20, 0); header.writeUInt32LE(1, 16)
  return Buffer.concat([header, Buffer.from(paths.join('\0') + '\0\0', 'utf16le')])
}
beforeEach(() => { mocks.directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-paste-test-')); mocks.buffers.clear(); mocks.imageEmpty = true })
afterEach(() => fs.rmSync(mocks.directory, { recursive: true, force: true }))
describe('clipboard image attachments', () => {
  it('decodes multiple Unicode Explorer file paths and rejects malformed DROPFILES data', () => {
    expect(decodeDropFiles(dropFiles(['C:\\images\\first.png', 'C:\\images\\second image.jpg']))).toEqual(['C:\\images\\first.png', 'C:\\images\\second image.jpg'])
    expect(decodeDropFiles(Buffer.alloc(3))).toEqual([])
    const malformed = Buffer.alloc(20); malformed.writeUInt32LE(9999, 0)
    expect(decodeDropFiles(malformed)).toEqual([])
  })
  it('attaches copied Explorer image files without replacing them with a bitmap', () => {
    const file = path.join(mocks.directory, 'photo.png'); fs.writeFileSync(file, 'fixture')
    mocks.buffers.set('FileNameW', Buffer.from(file + '\0', 'utf16le'))
    expect(pasteClipboardImages()).toEqual([file])
  })
  it('stores pasted bitmap images as unique persistent PNG attachments', () => {
    mocks.imageEmpty = false
    const first = pasteClipboardImages()[0], second = savePastedImage(Buffer.from('png-fixture'))
    expect(first).not.toBe(second)
    expect(first).toContain(path.join(mocks.directory, 'codex-attachments'))
    expect(fs.readFileSync(first, 'utf8')).toBe('png-fixture')
    expect(fs.existsSync(second)).toBe(true)
  })
  it('leaves ordinary text paste alone and rejects invalid or oversized image data', () => {
    expect(pasteClipboardImages()).toEqual([])
    expect(() => savePastedImage(Buffer.from('invalid'))).toThrow('could not be read')
    expect(() => savePastedImage(Buffer.alloc(0))).toThrow('20 MB')
    expect(() => savePastedImage(Buffer.alloc(20 * 1024 * 1024 + 1))).toThrow('20 MB')
  })
})
