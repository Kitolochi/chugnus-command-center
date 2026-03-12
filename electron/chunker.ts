import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface Chunk {
  text: string
  sourceFile: string   // relative path from memory dir, e.g. "domains/health/profile.md"
  heading: string      // closest markdown heading, e.g. "## Current State"
  domain: string       // extracted from path: "health", "career", "goals/my-goal", etc.
  fileHash: string     // MD5 of full file content for change detection
  startLine: number
}

const TARGET_CHUNK_SIZE = 384   // ~256-512 token target (chars / ~1.5 = tokens)
const MAX_CHUNK_SIZE = 768
const MIN_CHUNK_SIZE = 64

export function fileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex')
}

function extractDomain(relativePath: string): string {
  const parts = relativePath.replace(/\\/g, '/').split('/')
  if (parts.length >= 2 && parts[0] === 'domains') return parts[1]
  if (parts.length >= 2 && parts[0] === 'goals') return parts.slice(0, 2).join('/')
  if (parts.length >= 2) return parts[0]
  return 'root'
}

export function chunkMarkdown(content: string, sourceFile: string, hash: string): Chunk[] {
  const domain = extractDomain(sourceFile)
  const lines = content.split('\n')
  const chunks: Chunk[] = []
  let currentHeading = sourceFile
  let currentChunk = ''
  let chunkStartLine = 1

  function flushChunk() {
    const trimmed = currentChunk.trim()
    if (trimmed.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        text: trimmed,
        sourceFile,
        heading: currentHeading,
        domain,
        fileHash: hash,
        startLine: chunkStartLine,
      })
    }
    currentChunk = ''
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isHeading = /^#{1,4}\s/.test(line)

    if (isHeading) {
      // Flush previous chunk before new heading
      flushChunk()
      currentHeading = line.replace(/^#+\s*/, '').trim()
      chunkStartLine = i + 1
      currentChunk = line + '\n'
    } else {
      currentChunk += line + '\n'

      // Split if chunk exceeds max size
      if (currentChunk.length >= MAX_CHUNK_SIZE) {
        // Try to split at a paragraph break
        const paragraphBreak = currentChunk.lastIndexOf('\n\n', MAX_CHUNK_SIZE)
        if (paragraphBreak > TARGET_CHUNK_SIZE / 2) {
          const first = currentChunk.slice(0, paragraphBreak)
          const rest = currentChunk.slice(paragraphBreak + 2)
          currentChunk = first
          flushChunk()
          currentChunk = rest
          chunkStartLine = i + 1
        } else {
          flushChunk()
          chunkStartLine = i + 2
        }
      }
    }
  }

  // Final chunk
  flushChunk()

  return chunks
}

const READABLE_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.csv'])

export function chunkAllFiles(memoryDir: string): { chunks: Chunk[]; fileHashes: Record<string, string> } {
  const chunks: Chunk[] = []
  const fileHashes: Record<string, string> = {}

  if (!fs.existsSync(memoryDir)) return { chunks, fileHashes }

  function scanDir(dir: string) {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (!READABLE_EXTENSIONS.has(ext)) continue
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          if (content.trim().length < MIN_CHUNK_SIZE) continue
          const relativePath = path.relative(memoryDir, fullPath).replace(/\\/g, '/')
          const hash = fileHash(content)
          fileHashes[relativePath] = hash
          const fileChunks = chunkMarkdown(content, relativePath, hash)
          chunks.push(...fileChunks)
        } catch {}
      }
    }
  }

  scanDir(memoryDir)
  return { chunks, fileHashes }
}
