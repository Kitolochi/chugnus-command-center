import { app, clipboard, nativeImage } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export function decodeDropFiles(data: Buffer): string[] {
  if (data.length < 20) return []
  const offset = data.readUInt32LE(0)
  if (offset < 20 || offset >= data.length) return []
  return data
    .subarray(offset)
    .toString(data.readUInt32LE(16) ? 'utf16le' : 'latin1')
    .split('\0')
    .filter(Boolean)
}

export function savePastedImage(bytes: Uint8Array): string {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Paste an image smaller than 20 MB.')
  const image = nativeImage.createFromBuffer(Buffer.from(bytes))
  if (image.isEmpty()) throw new Error('The clipboard image could not be read.')
  const directory = path.join(app.getPath('userData'), 'codex-attachments')
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `pasted-image-${crypto.randomUUID()}.png`)
  fs.writeFileSync(file, image.toPNG())
  return file
}

export function pasteClipboardImages(): string[] {
  const paths = decodeDropFiles(clipboard.readBuffer('CF_HDROP'))
  if (!paths.length) paths.push(...clipboard.readBuffer('FileNameW').toString('utf16le').split('\0').filter(Boolean))
  const images = [...new Set(paths)].filter(
    (file) => /\.(png|jpe?g|gif|webp)$/i.test(file) && fs.existsSync(file) && fs.statSync(file).isFile()
  )
  if (images.length) return images
  const image = clipboard.readImage()
  return image.isEmpty() ? [] : [savePastedImage(image.toPNG())]
}
