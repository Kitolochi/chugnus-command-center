import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { chunkAllFiles, Chunk } from './chunker'
import { embedText, embedBatch, getEmbeddingStatus } from './embeddings'
import { discoverSessions, parseSession, sessionFileHash } from './session-parser'
import { buildBM25Index, saveBM25Index, loadBM25Index, searchBM25, deleteBM25Index } from './bm25-index'
import * as lancedb from '@lancedb/lancedb'
import {
  Schema, Field, Utf8, Float32, Int32, FixedSizeList,
} from 'apache-arrow'

// ── Schema ──────────────────────────────────────────────────────────
const VECTOR_DIM = 384
const TABLE_NAME = 'chunks'

const chunkSchema = new Schema([
  new Field('text', new Utf8(), false),
  new Field('sourceFile', new Utf8(), false),
  new Field('heading', new Utf8(), false),
  new Field('domain', new Utf8(), false),
  new Field('fileHash', new Utf8(), false),
  new Field('startLine', new Int32(), false),
  new Field(
    'vector',
    new FixedSizeList(VECTOR_DIM, new Field('item', new Float32())),
    false,
  ),
])

// ── State ───────────────────────────────────────────────────────────
let db: lancedb.Connection | null = null
let table: lancedb.Table | null = null
// File hashes kept in a small sidecar JSON for fast diff without querying LanceDB
let fileHashes: Record<string, string> = {}
let sessionHashes: Record<string, string> = {}
let rebuildLock = false

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'vector-db')
}

function getHashesPath(): string {
  return path.join(app.getPath('userData'), 'vector-db-hashes.json')
}

function getSessionHashesPath(): string {
  return path.join(app.getPath('userData'), 'vector-db-session-hashes.json')
}

function getMemoryDir(): string {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(homeDir, '.claude', 'memory')
}

function loadHashes(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(getHashesPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveHashes() {
  try {
    fs.writeFileSync(getHashesPath(), JSON.stringify(fileHashes), 'utf-8')
  } catch (err) {
    console.error('Failed to save vector-db hashes:', err)
  }
}

function loadSessionHashes(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(getSessionHashesPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveSessionHashes() {
  try {
    fs.writeFileSync(getSessionHashesPath(), JSON.stringify(sessionHashes), 'utf-8')
  } catch (err) {
    console.error('Failed to save session hashes:', err)
  }
}

// ── Public API (same signatures as before) ──────────────────────────

export async function loadVectorIndex(): Promise<{ chunkCount: number } | null> {
  try {
    const dbPath = getDbPath()
    db = await lancedb.connect(dbPath)
    const names = await db.tableNames()
    if (names.includes(TABLE_NAME)) {
      table = await db.openTable(TABLE_NAME)
      fileHashes = loadHashes()
      sessionHashes = loadSessionHashes()
      const count = await table.countRows()
      console.log(`Vector index loaded: ${count} chunks (LanceDB) from ${Object.keys(fileHashes).length} files`)

      // Load BM25 index from disk
      const bm25Ok = loadBM25Index()
      if (!bm25Ok) {
        console.log('BM25 index not found on disk — will rebuild on next index rebuild')
      }

      return { chunkCount: count }
    }
    // Table doesn't exist yet — will be created on rebuildIndex
    console.log('Vector DB exists but no chunks table — will rebuild')
    return null
  } catch {
    // DB dir doesn't exist yet — first run
    return null
  }
}

export async function rebuildIndex(
  onProgress?: (info: { phase: string; current: number; total: number }) => void,
): Promise<{ added: number; removed: number; total: number }> {
  if (rebuildLock) throw new Error('Index rebuild already in progress')
  rebuildLock = true

  try {
    return await _rebuildIndexInner(onProgress)
  } finally {
    rebuildLock = false
  }
}

async function _rebuildIndexInner(
  onProgress?: (info: { phase: string; current: number; total: number }) => void,
): Promise<{ added: number; removed: number; total: number }> {
  const status = getEmbeddingStatus()
  if (!status.ready) {
    throw new Error('Embedding model not ready')
  }

  // Ensure DB connection
  if (!db) {
    const dbPath = getDbPath()
    db = await lancedb.connect(dbPath)
  }

  // ── Phase 1: Memory files (existing) ──────────────────────────────
  const memoryDir = getMemoryDir()
  const { chunks: memoryChunks, fileHashes: currentHashes } = chunkAllFiles(memoryDir)
  const existingHashes = fileHashes

  // Determine which memory files changed
  const changedFiles = new Set<string>()
  const deletedFiles = new Set<string>()

  for (const [file, hash] of Object.entries(currentHashes)) {
    if (existingHashes[file] !== hash) {
      changedFiles.add(file)
    }
  }
  for (const file of Object.keys(existingHashes)) {
    if (!(file in currentHashes)) {
      deletedFiles.add(file)
      changedFiles.add(file)
    }
  }

  // ── Phase 2: Session files ────────────────────────────────────────
  const existingSessionHashes = sessionHashes
  const currentSessionHashes: Record<string, string> = {}
  const changedSessionFiles = new Set<string>()
  const deletedSessionFiles = new Set<string>()
  let sessionChunks: Chunk[] = []

  try {
    const sessions = discoverSessions()
    onProgress?.({ phase: 'sessions-discover', current: 0, total: sessions.length })

    // Compute hashes and detect changes
    for (const meta of sessions) {
      const key = `sessions/${meta.project}/${meta.sessionId}.jsonl`
      const hash = sessionFileHash(meta)
      currentSessionHashes[key] = hash
      if (existingSessionHashes[key] !== hash) {
        changedSessionFiles.add(key)
      }
    }

    // Detect deleted sessions
    for (const key of Object.keys(existingSessionHashes)) {
      if (!(key in currentSessionHashes)) {
        deletedSessionFiles.add(key)
        changedSessionFiles.add(key)
      }
    }

    // Parse only changed sessions
    if (changedSessionFiles.size > 0) {
      const changedMetas = sessions.filter(m =>
        changedSessionFiles.has(`sessions/${m.project}/${m.sessionId}.jsonl`)
      )
      let parsed = 0
      for (const meta of changedMetas) {
        try {
          const chunks = await parseSession(meta)
          sessionChunks.push(...chunks)
          parsed++
          if (parsed % 50 === 0 || parsed === changedMetas.length) {
            onProgress?.({ phase: 'sessions-parse', current: parsed, total: changedMetas.length })
          }
        } catch (err) {
          // Session file may have been deleted between discover and parse
          console.warn(`Failed to parse session ${meta.sessionId}:`, err)
        }
      }
      console.log(`Parsed ${parsed} changed sessions → ${sessionChunks.length} chunks`)
    }
  } catch (err) {
    console.warn('Session indexing failed (non-fatal):', err)
  }

  // ── Check if anything changed ─────────────────────────────────────
  const memoryChanged = changedFiles.size > 0
  const sessionsChanged = changedSessionFiles.size > 0

  if (!memoryChanged && !sessionsChanged && table) {
    const total = await table.countRows()
    console.log(`Vector index up to date: ${total} chunks`)
    return { added: 0, removed: 0, total }
  }

  // ── Delete stale rows ─────────────────────────────────────────────
  const filesToRemove = new Set([...changedFiles, ...deletedFiles, ...changedSessionFiles, ...deletedSessionFiles])
  let removedCount = 0
  if (table && filesToRemove.size > 0) {
    const quoted = [...filesToRemove].map(f => `'${escapeSql(f)}'`).join(', ')
    const predicate = `sourceFile IN (${quoted})`
    removedCount = await table.countRows(predicate)
    await table.delete(predicate)
  }

  // ── Embed new/changed chunks ──────────────────────────────────────
  const newMemoryChunks = memoryChunks.filter(c => changedFiles.has(c.sourceFile))
  const allNewChunks = [...newMemoryChunks, ...sessionChunks]
  const rows: Record<string, unknown>[] = []

  if (allNewChunks.length > 0) {
    onProgress?.({ phase: 'embedding', current: 0, total: allNewChunks.length })
    const texts = allNewChunks.map(c => c.text)
    const embeddings = await embedBatch(texts)

    for (let i = 0; i < allNewChunks.length; i++) {
      const emb = embeddings[i]
      if (!emb) continue
      rows.push({
        text: allNewChunks[i].text,
        sourceFile: allNewChunks[i].sourceFile,
        heading: allNewChunks[i].heading,
        domain: allNewChunks[i].domain,
        fileHash: allNewChunks[i].fileHash,
        startLine: allNewChunks[i].startLine,
        vector: Array.from(emb),
      })
      if ((i + 1) % 50 === 0 || i === allNewChunks.length - 1) {
        onProgress?.({ phase: 'embedding', current: i + 1, total: allNewChunks.length })
      }
    }
  }

  // Create table or add rows
  if (!table) {
    if (rows.length > 0) {
      table = await db.createTable(TABLE_NAME, rows, { schema: chunkSchema, mode: 'overwrite' })
    } else {
      table = await db.createEmptyTable(TABLE_NAME, chunkSchema)
    }
  } else if (rows.length > 0) {
    await table.add(rows)
  }

  // Persist file hashes
  fileHashes = currentHashes
  saveHashes()
  sessionHashes = currentSessionHashes
  saveSessionHashes()

  // ── Rebuild BM25 index from all chunks ────────────────────────────
  // BM25 is rebuilt from scratch (fast — pure in-memory) using all chunks
  // We need all chunks including unchanged ones for the full-text index
  const unchangedSessionKeys = Object.keys(currentSessionHashes).filter(k => !changedSessionFiles.has(k))
  // For BM25 we combine memory chunks + session chunks (changed ones are already parsed above)
  // For unchanged sessions, we'd need to re-parse them for BM25 — but since BM25 rebuild is
  // only triggered when something changed, and we want a complete index, let's re-parse all sessions
  // This is fast since it's just text extraction, no embeddings needed
  try {
    let allSessionChunks = sessionChunks // already have the changed ones
    if (unchangedSessionKeys.length > 0) {
      // Re-parse unchanged sessions for BM25 completeness
      const sessions = discoverSessions()
      const unchangedMetas = sessions.filter(m =>
        !changedSessionFiles.has(`sessions/${m.project}/${m.sessionId}.jsonl`)
      )
      for (const meta of unchangedMetas) {
        try {
          const chunks = await parseSession(meta)
          allSessionChunks.push(...chunks)
        } catch {}
      }
    }
    const allChunksForBM25 = [...memoryChunks, ...allSessionChunks]
    buildBM25Index(allChunksForBM25)
    saveBM25Index()
  } catch (err) {
    console.warn('BM25 index build failed (non-fatal):', err)
  }

  const total = await table.countRows()
  const result = { added: rows.length, removed: removedCount, total }
  console.log(`Vector index refreshed: ${result.added} added, ${result.removed} removed, ${result.total} total chunks`)
  return result
}

// ── Search ──────────────────────────────────────────────────────────

export interface SearchResult {
  text: string
  sourceFile: string
  heading: string
  domain: string
  score: number
  startLine: number
}

export interface SearchOptions {
  topK?: number
  minScore?: number
  domainFilter?: string
}

/** Vector-only search (LanceDB cosine similarity) */
async function searchVector(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { topK = 20, minScore = 0.2, domainFilter } = options

  if (!table) return []

  const queryEmbedding = await embedText(query)
  if (!queryEmbedding) return []

  let q = table
    .search(Array.from(queryEmbedding))
    .distanceType('cosine')
    .select(['text', 'sourceFile', 'heading', 'domain', 'startLine', '_distance'])
    .limit(topK * 2) // over-fetch to allow post-filtering by minScore

  if (domainFilter) {
    q = q.where(`domain = '${escapeSql(domainFilter)}' OR domain LIKE '${escapeSql(domainFilter)}/%'`)
  }

  const raw = await q.toArray()

  const results: SearchResult[] = []
  for (const row of raw) {
    // LanceDB cosine distance = 1 - cosine_similarity (0 = identical, 1 = orthogonal)
    const score = 1 - (row._distance ?? 1)
    if (score < minScore) continue
    results.push({
      text: row.text,
      sourceFile: row.sourceFile,
      heading: row.heading,
      domain: row.domain,
      score,
      startLine: row.startLine,
    })
  }

  return results.slice(0, topK)
}

/** Reciprocal Rank Fusion: merge vector + BM25 results */
function reciprocalRankFusion(
  vectorResults: SearchResult[],
  bm25Results: SearchResult[],
  topK: number,
): SearchResult[] {
  const RRF_K = 60
  const scoreMap = new Map<string, { score: number; result: SearchResult }>()

  // Score vector results by rank
  for (let i = 0; i < vectorResults.length; i++) {
    const key = `${vectorResults[i].sourceFile}:${vectorResults[i].startLine}`
    const rrfScore = 1 / (RRF_K + i + 1)
    const existing = scoreMap.get(key)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(key, { score: rrfScore, result: vectorResults[i] })
    }
  }

  // Score BM25 results by rank
  for (let i = 0; i < bm25Results.length; i++) {
    const key = `${bm25Results[i].sourceFile}:${bm25Results[i].startLine}`
    const rrfScore = 1 / (RRF_K + i + 1)
    const existing = scoreMap.get(key)
    if (existing) {
      existing.score += rrfScore
    } else {
      scoreMap.set(key, { score: rrfScore, result: bm25Results[i] })
    }
  }

  // Sort by RRF score descending
  const merged = Array.from(scoreMap.values())
  merged.sort((a, b) => b.score - a.score)

  // Normalize scores to [0, 1] with top result at 1.0
  const maxScore = merged[0]?.score || 1
  return merged.slice(0, topK).map(({ score, result }) => ({
    ...result,
    score: score / maxScore,
  }))
}

/** Hybrid search: vector + BM25 merged via Reciprocal Rank Fusion */
export async function search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const { topK = 20 } = options

  // Run both searches in parallel
  const [vectorResults, bm25Results] = await Promise.all([
    searchVector(query, { ...options, topK: topK * 2 }),
    searchBM25(query, { topK: topK * 2, domainFilter: options.domainFilter }),
  ])

  // If only one source has results, return that directly
  if (vectorResults.length === 0 && bm25Results.length === 0) return []
  if (bm25Results.length === 0) return vectorResults.slice(0, topK)
  if (vectorResults.length === 0) {
    // Normalize BM25 scores to [0,1]
    const maxBm25 = bm25Results[0]?.score || 1
    return bm25Results.slice(0, topK).map(r => ({ ...r, score: r.score / maxBm25 }))
  }

  // Merge via RRF
  return reciprocalRankFusion(vectorResults, bm25Results, topK)
}

export async function multiSearch(queries: string[], options: SearchOptions = {}): Promise<SearchResult[]> {
  const { topK = 50, minScore = 0.25 } = options
  const allResults = new Map<string, SearchResult>()

  for (const query of queries) {
    const results = await search(query, { topK: Math.ceil(topK / queries.length) + 10, minScore })
    for (const r of results) {
      const key = `${r.sourceFile}:${r.startLine}`
      const existing = allResults.get(key)
      if (!existing || r.score > existing.score) {
        allResults.set(key, r)
      }
    }
  }

  const merged = Array.from(allResults.values())
  merged.sort((a, b) => b.score - a.score)
  return merged.slice(0, topK)
}

// ── Stats & Cleanup ─────────────────────────────────────────────────

export async function getIndexStats(): Promise<{ chunkCount: number; fileCount: number; sizeBytes: number } | null> {
  if (!table) return null
  try {
    const chunkCount = await table.countRows()
    const fileCount = Object.keys(fileHashes).length + Object.keys(sessionHashes).length
    // Approximate size from the LanceDB directory
    let sizeBytes = 0
    const dbPath = getDbPath()
    if (fs.existsSync(dbPath)) {
      sizeBytes = dirSize(dbPath)
    }
    return { chunkCount, fileCount, sizeBytes }
  } catch {
    return null
  }
}

export async function deleteIndex(): Promise<void> {
  try {
    // Drop the table if connection exists
    if (db) {
      const names = await db.tableNames()
      if (names.includes(TABLE_NAME)) {
        await db.dropTable(TABLE_NAME)
      }
    }
  } catch {}
  try {
    // Remove the entire DB directory
    const dbPath = getDbPath()
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true })
    }
    // Remove hashes sidecars
    const hashPath = getHashesPath()
    if (fs.existsSync(hashPath)) {
      fs.unlinkSync(hashPath)
    }
    const sessionHashPath = getSessionHashesPath()
    if (fs.existsSync(sessionHashPath)) {
      fs.unlinkSync(sessionHashPath)
    }
  } catch {}

  // Delete BM25 index
  deleteBM25Index()

  db = null
  table = null
  fileHashes = {}
  sessionHashes = {}
}

// ── Helpers ─────────────────────────────────────────────────────────

function escapeSql(s: string): string {
  return s.replace(/'/g, "''")
}

function dirSize(dir: string): number {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      total += dirSize(p)
    } else {
      total += fs.statSync(p).size
    }
  }
  return total
}
