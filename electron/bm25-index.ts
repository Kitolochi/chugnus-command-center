import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import MiniSearch from 'minisearch'
import { Chunk } from './chunker'

export interface BM25Result {
  text: string
  sourceFile: string
  heading: string
  domain: string
  score: number
  startLine: number
}

// ── State ───────────────────────────────────────────────────────────
let miniSearch: MiniSearch | null = null

function getIndexPath(): string {
  return path.join(app.getPath('userData'), 'bm25-index.json')
}

function createMiniSearch(): MiniSearch {
  return new MiniSearch({
    fields: ['text', 'heading'],
    storeFields: ['text', 'sourceFile', 'heading', 'domain', 'startLine'],
    searchOptions: {
      boost: { text: 2, heading: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  })
}

// ── Public API ──────────────────────────────────────────────────────

/** Build BM25 index from all chunks */
export function buildBM25Index(chunks: Chunk[]): number {
  miniSearch = createMiniSearch()

  // MiniSearch needs unique numeric IDs
  const docs = chunks.map((c, i) => ({
    id: i,
    text: c.text,
    sourceFile: c.sourceFile,
    heading: c.heading,
    domain: c.domain,
    startLine: c.startLine,
  }))

  miniSearch.addAll(docs)
  console.log(`BM25 index built: ${docs.length} documents`)
  return docs.length
}

/** Save BM25 index to disk */
export function saveBM25Index(): void {
  if (!miniSearch) return
  try {
    const json = JSON.stringify(miniSearch.toJSON())
    fs.writeFileSync(getIndexPath(), json, 'utf-8')
  } catch (err) {
    console.error('Failed to save BM25 index:', err)
  }
}

/** Load BM25 index from disk. Returns true if successful */
export function loadBM25Index(): boolean {
  try {
    const indexPath = getIndexPath()
    if (!fs.existsSync(indexPath)) return false
    const json = fs.readFileSync(indexPath, 'utf-8')
    miniSearch = MiniSearch.loadJSON(json, {
      fields: ['text', 'heading'],
      storeFields: ['text', 'sourceFile', 'heading', 'domain', 'startLine'],
      searchOptions: {
        boost: { text: 2, heading: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
    console.log(`BM25 index loaded from disk`)
    return true
  } catch (err) {
    console.error('Failed to load BM25 index:', err)
    miniSearch = null
    return false
  }
}

/** Search the BM25 index */
export function searchBM25(
  query: string,
  options: { topK?: number; domainFilter?: string } = {}
): BM25Result[] {
  if (!miniSearch || !query.trim()) return []

  const { topK = 20, domainFilter } = options

  const filterFn = domainFilter
    ? (result: any) => {
        const d = result.domain as string
        return d === domainFilter || d.startsWith(domainFilter + '/')
      }
    : undefined

  const raw = miniSearch.search(query, {
    boost: { text: 2, heading: 1 },
    fuzzy: 0.2,
    prefix: true,
    filter: filterFn,
  })

  return raw.slice(0, topK).map(r => ({
    text: r.text as string,
    sourceFile: r.sourceFile as string,
    heading: r.heading as string,
    domain: r.domain as string,
    score: r.score,
    startLine: r.startLine as number,
  }))
}

/** Delete BM25 index from memory and disk */
export function deleteBM25Index(): void {
  miniSearch = null
  try {
    const indexPath = getIndexPath()
    if (fs.existsSync(indexPath)) {
      fs.unlinkSync(indexPath)
    }
  } catch {}
}
