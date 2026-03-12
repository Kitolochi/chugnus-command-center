import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getMemories } from './database'
import { embedBatch, cosineSimilarity } from './embeddings'
import { callLLM } from './llm'
import { getClaudeApiKey, getLLMSettings } from './database'
import { kMeansClustering, selectOptimalK, computeClusterLabels } from './clustering'

// --- Context File Reader ---

const READABLE_EXTENSIONS = new Set(['.md', '.txt', '.yaml', '.yml', '.toml'])

/** Detect stub/template files with no real content */
const STUB_PATTERNS = [
  /^What would you like me to read/m,
  /^Please provide a file path/m,
  /^List your current goals/m,
  /^Record key milestones/m,
  /^Describe your current/m,
]

function isStubContent(content: string): boolean {
  // Too short to be meaningful research
  if (content.length < 500) {
    // Check if it's mostly headers/placeholders
    const lines = content.split('\n').filter(l => l.trim())
    const headerLines = lines.filter(l => l.startsWith('#') || l.startsWith('- ') || l.startsWith('**') || l.trim() === '')
    if (headerLines.length / Math.max(lines.length, 1) > 0.7) return true
  }
  // Known stub patterns
  for (const pattern of STUB_PATTERNS) {
    if (pattern.test(content)) return true
  }
  // Files that are just a question header + metadata with no actual research
  if (content.length < 600) {
    const hasResearch = content.includes('## ') && content.split('## ').length > 2
    const hasProse = content.split(/[.!?]\s/).length > 3
    if (!hasResearch && !hasProse) return true
  }
  return false
}

// --- File Authority Scoring ---
// Files that synthesize/refine earlier work should override conflicting info from drafts.

/** High-authority filename patterns (case-insensitive) — these override earlier files */
const HIGH_AUTHORITY_PATTERNS = [
  /final/i, /meta.?analysis/i, /master/i, /synthesis/i,
  /summary/i, /overview/i, /conclusion/i, /revised/i,
  /correction/i, /perspective.?correction/i,
]

/** Low-authority filename patterns — raw data, logs, quotes */
const LOW_AUTHORITY_PATTERNS = [
  /daily.?log/i, /notable.?quotes/i, /raw/i, /draft/i, /notes/i,
]

/**
 * Score a file's authority from 0-100.
 * Higher = more authoritative (meta-analyses, corrections, newer files).
 * Lower = raw data, early drafts, logs.
 */
function scoreFileAuthority(fileName: string, modifiedAt: Date, size: number): number {
  let score = 50 // baseline

  const baseName = path.basename(fileName).toLowerCase()

  // Filename patterns
  for (const pattern of HIGH_AUTHORITY_PATTERNS) {
    if (pattern.test(baseName)) { score += 25; break }
  }
  for (const pattern of LOW_AUTHORITY_PATTERNS) {
    if (pattern.test(baseName)) { score -= 15; break }
  }

  // Chronological date extraction from filenames (e.g., "analysis_jan_feb_2026.md")
  const yearMatch = baseName.match(/(20\d{2})/)
  if (yearMatch) {
    const year = parseInt(yearMatch[1])
    // Newer analysis files are more authoritative
    score += Math.min(10, (year - 2024) * 5)
  }

  // Month ordering for chronological files
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  for (let i = 0; i < months.length; i++) {
    if (baseName.includes(months[i])) {
      score += Math.floor(i / 2) // later months = slightly higher
      break
    }
  }

  // File modification date — newer files get a small boost
  const ageMs = Date.now() - modifiedAt.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < 7) score += 10
  else if (ageDays < 30) score += 5

  // Larger files tend to be more comprehensive (but cap the bonus)
  if (size > 20000) score += 5
  if (size > 50000) score += 5

  // Root-level files (patterns.md, decisions.md) are curated
  if (!fileName.includes('/')) score += 10

  return Math.max(0, Math.min(100, score))
}

interface ContextFileWithAuthority {
  name: string
  content: string
  authority: number
  folder: string
}

function readAllContextFiles(): ContextFileWithAuthority[] {
  try {
    const homeDir = process.env.USERPROFILE || process.env.HOME || ''
    const memoryDir = path.join(homeDir, '.claude', 'memory')
    if (!fs.existsSync(memoryDir)) return []
    const results: ContextFileWithAuthority[] = []
    let skippedStubs = 0
    function scanDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (READABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8').trim()
            if (content.length <= 20) continue
            if (isStubContent(content)) {
              skippedStubs++
              continue
            }
            const stat = fs.statSync(fullPath)
            const relativePath = path.relative(memoryDir, fullPath).replace(/\\/g, '/')
            const folder = path.dirname(relativePath)
            const authority = scoreFileAuthority(relativePath, stat.mtime, content.length)
            results.push({ name: relativePath, content, authority, folder: folder === '.' ? '' : folder })
          } catch {}
        }
      }
    }
    scanDir(memoryDir)
    // Sort by authority descending so high-authority files are processed first
    results.sort((a, b) => b.authority - a.authority)
    console.log(`Context files: ${results.length} with content, ${skippedStubs} stubs skipped`)
    if (results.length > 0) {
      const top3 = results.slice(0, 3).map(f => `${f.name}(${f.authority})`).join(', ')
      const bot3 = results.slice(-3).map(f => `${f.name}(${f.authority})`).join(', ')
      console.log(`  Top authority: ${top3}`)
      console.log(`  Low authority: ${bot3}`)
    }
    return results
  } catch {}
  return []
}

/** Split a long markdown file into ~500-token chunks at paragraph boundaries.
 *  Preserves the most recent heading at the start of each chunk so context isn't lost. */
function chunkMarkdown(text: string, maxChars = 2000): string[] {
  const paragraphs = text.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''
  let lastHeading = ''  // track the most recent markdown heading

  for (const para of paragraphs) {
    // Track headings for context preservation
    const headingMatch = para.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      lastHeading = para
    }

    if (current.length + para.length > maxChars && current.length > 0) {
      chunks.push(current.trim())
      // Start the new chunk with the last heading for context
      current = lastHeading && !para.startsWith('#') ? lastHeading + '\n\n' : ''
    }
    current += (current ? '\n\n' : '') + para
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// --- Types ---

export interface KnowledgeCluster {
  label: string
  summary: string
  facts: string[]
  memoryCount: number
}

export interface KnowledgePack {
  id: string
  createdAt: string
  overview: string
  clusters: KnowledgeCluster[]
  stats: {
    totalMemories: number
    totalContextFiles: number
    totalChunks: number
    totalFacts: number
    compressionRatio: number
    durationMs: number
  }
}

export interface CompressionProgress {
  phase: 'embedding' | 'dedup' | 'clustering' | 'summarizing' | 'extracting' | 'overview' | 'done'
  percent: number
  detail: string
}

// --- Storage ---

function getPackDir(): string {
  const dir = path.join(app.getPath('userData'), 'knowledge-packs')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getIndexPath(): string {
  return path.join(getPackDir(), 'index.json')
}

export function getKnowledgePacks(): KnowledgePack[] {
  const indexPath = getIndexPath()
  if (!fs.existsSync(indexPath)) return []
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  } catch {
    return []
  }
}

export function saveKnowledgePack(pack: KnowledgePack): void {
  const packs = getKnowledgePacks()
  const idx = packs.findIndex(p => p.id === pack.id)
  if (idx >= 0) {
    packs[idx] = pack
  } else {
    packs.unshift(pack)
  }
  fs.writeFileSync(getIndexPath(), JSON.stringify(packs, null, 2), 'utf-8')
}

// --- Local Extraction Helpers (no API needed) ---

/** Check if any LLM API key is configured */
async function checkLLMAvailable(): Promise<boolean> {
  try {
    const settings = getLLMSettings()
    if (settings?.provider && settings?.apiKey) return true
    const claudeKey = getClaudeApiKey()
    if (claudeKey) return true
  } catch {}
  return false
}

/** Extract the nearest markdown heading from text (for context) */
function extractNearestHeading(text: string): string | null {
  const lines = text.split('\n')
  for (const line of lines) {
    const match = line.match(/^#{1,4}\s+(.+)/)
    if (match) return match[1].trim()
  }
  return null
}

/** Extract sentences from text, with section heading context */
function extractSentences(text: string): { sentence: string; heading: string | null }[] {
  const lines = text.split('\n')
  const results: { sentence: string; heading: string | null }[] = []
  let currentHeading: string | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s+(.+)/)
    if (headingMatch) {
      currentHeading = headingMatch[1].trim()
      continue
    }
    // Skip lines that are just markdown formatting
    if (line.trim().startsWith('---') || line.trim().startsWith('```') || line.trim().startsWith('|')) continue

    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 15 && s.length < 300)

    for (const s of sentences) {
      // Skip questions, instructions, and template-like sentences
      if (s.endsWith('?')) continue
      if (/^(please|enter|describe|list|record|what|how|why|when|where)\b/i.test(s)) continue
      results.push({ sentence: s, heading: currentHeading })
    }
  }
  return results
}

/** Resolve the display name for a source */
function getSourceLabel(member: { source: string; index: number }, memories: any[], memoryCount: number, contextChunks: { fileName: string; text: string }[]): string {
  if (member.source === 'memory' && member.index < memoryCount) {
    return `Memory: ${memories[member.index]?.title || 'untitled'}`
  }
  const chunkIdx = member.index - memoryCount
  const chunk = contextChunks[chunkIdx]
  if (chunk) {
    // Shorten path: "goals/make-my-ai.../file.md" → "goals/.../file.md"
    const parts = chunk.fileName.split('/')
    if (parts.length > 2) return `${parts[0]}/.../${parts[parts.length - 1]}`
    return chunk.fileName
  }
  return 'unknown'
}

/** Local summary + fact extraction without LLM — with source, section, and authority attribution */
function extractLocalSummaryAndFacts(
  members: { text: string; source: string; index: number; authority?: number }[],
  label: string,
  memories: any[],
  memoryCount: number,
  contextChunks: { fileName: string; text: string; authority?: number }[]
): { summary: string; facts: string[] } {
  // Sort members by AUTHORITY first (highest authority = most refined knowledge), then text length
  const sorted = [...members].sort((a, b) => {
    const authDiff = (b.authority ?? 50) - (a.authority ?? 50)
    if (authDiff !== 0) return authDiff
    return b.text.length - a.text.length
  })

  // Summary: first meaningful sentence from the longest member
  let summaryText = ''
  for (const m of sorted.slice(0, 5)) {
    const sentences = extractSentences(m.text)
    if (sentences.length > 0 && !summaryText) {
      summaryText = sentences[0].sentence
    }
  }
  const summary = summaryText || `Knowledge cluster covering ${label}`

  // Facts: extract per-source with section heading context
  const seen = new Set<string>()
  const facts: string[] = []

  for (const m of sorted) {
    const sourceLabel = getSourceLabel(m, memories, memoryCount, contextChunks)
    const sentences = extractSentences(m.text)

    for (const { sentence, heading } of sentences) {
      const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '')
      if (!seen.has(normalized) && sentence.length > 20) {
        seen.add(normalized)
        // Include section heading for context: [source > Section] sentence
        const sectionCtx = heading ? ` > ${heading}` : ''
        facts.push(`[${sourceLabel}${sectionCtx}] ${sentence}`)
        if (facts.length >= 15) break
      }
    }
    if (facts.length >= 15) break
  }

  // If we didn't get enough sentences, use truncated text blocks with attribution
  if (facts.length < 3) {
    for (const m of sorted) {
      const sourceLabel = getSourceLabel(m, memories, memoryCount, contextChunks)
      const heading = extractNearestHeading(m.text)
      const sectionCtx = heading ? ` > ${heading}` : ''
      const snippet = m.text.replace(/[#]+\s+[^\n]+\n?/g, '').replace(/\n+/g, ' ').trim().slice(0, 200)
      if (snippet.length > 20 && facts.length < 15) {
        facts.push(`[${sourceLabel}${sectionCtx}] ${snippet}${m.text.length > 200 ? '...' : ''}`)
      }
    }
  }

  return { summary, facts: facts.slice(0, 15) }
}

/** Generate an overview from cluster data without LLM */
function generateLocalOverview(clusters: KnowledgeCluster[], memoryCount: number, contextFileCount: number): string {
  const topClusters = clusters
    .sort((a, b) => b.memoryCount - a.memoryCount)
    .slice(0, 5)
    .map(c => c.label)

  const topicList = topClusters.length > 2
    ? topClusters.slice(0, -1).join(', ') + ', and ' + topClusters[topClusters.length - 1]
    : topClusters.join(' and ')

  return `Knowledge base with ${clusters.length} topic clusters covering ${memoryCount} memories and ${contextFileCount} context files. Key themes include ${topicList}.`
}

// --- Compression Pipeline ---

const DEDUP_THRESHOLD = 0.92
const SAME_FOLDER_DEDUP_THRESHOLD = 0.78 // More aggressive dedup for iterative files in same folder

/** Get the folder portion of a context chunk's filename */
function getFolder(pair: { source: string; index: number }, memoryCount: number, contextChunks: { fileName: string }[]): string {
  if (pair.source === 'memory') return '__memories__'
  const chunkIdx = pair.index - memoryCount
  const fileName = contextChunks[chunkIdx]?.fileName || ''
  const slashIdx = fileName.lastIndexOf('/')
  return slashIdx >= 0 ? fileName.substring(0, slashIdx) : '__root__'
}

export async function compressKnowledgeNative(
  onProgress?: (progress: CompressionProgress) => void
): Promise<KnowledgePack> {
  const startTime = Date.now()

  // Phase 0: Gather all knowledge sources
  onProgress?.({ phase: 'embedding', percent: 2, detail: 'Gathering knowledge sources...' })

  // Source 1: Database memories
  const memories = getMemories()
  const memoryTexts = memories.map(m => `${m.title}. ${m.content}`)

  // Source 2: Context files from ~/.claude/memory/ (sorted by authority)
  const contextFiles = readAllContextFiles()
  const contextChunks: { fileName: string; text: string; authority: number }[] = []
  for (const file of contextFiles) {
    const chunks = chunkMarkdown(file.content)
    for (const chunk of chunks) {
      contextChunks.push({ fileName: file.name, text: chunk, authority: file.authority })
    }
  }

  // Unified text list: memories first, then context file chunks
  const allTexts = [
    ...memoryTexts,
    ...contextChunks.map(c => c.text),
  ]
  const memoryCount = memoryTexts.length
  const contextCount = contextChunks.length
  const totalSources = allTexts.length

  if (totalSources === 0) {
    throw new Error('No memories or context files to compress')
  }

  // Phase 1: Embed everything
  onProgress?.({ phase: 'embedding', percent: 5, detail: `Embedding ${memoryCount} memories + ${contextCount} context chunks (${contextFiles.length} files)...` })
  const embeddings = await embedBatch(allTexts)

  const validPairs: { index: number; embedding: Float32Array; text: string; source: 'memory' | 'context'; authority: number }[] = []
  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i]) {
      // Memories get authority 60 (above average), context chunks carry their file's authority
      const authority = i < memoryCount ? 60 : (contextChunks[i - memoryCount]?.authority ?? 50)
      validPairs.push({
        index: i,
        embedding: embeddings[i]!,
        text: allTexts[i],
        source: i < memoryCount ? 'memory' : 'context',
        authority,
      })
    }
  }

  if (validPairs.length === 0) {
    throw new Error('Embedding model not ready. Please wait for model initialization.')
  }

  onProgress?.({ phase: 'embedding', percent: 20, detail: `Embedded ${validPairs.length}/${totalSources} items` })

  // Phase 2: Deduplicate near-duplicates (prefer higher-authority version)
  // Uses a lower threshold for chunks from the same folder since iterative files
  // (draft → analysis → meta-analysis) often rephrase the same ideas.
  onProgress?.({ phase: 'dedup', percent: 25, detail: 'Removing near-duplicates (keeping highest-authority versions)...' })
  const dedupSet = new Set<number>()
  for (let i = 0; i < validPairs.length; i++) {
    if (dedupSet.has(i)) continue
    for (let j = i + 1; j < validPairs.length; j++) {
      if (dedupSet.has(j)) continue
      const sim = cosineSimilarity(validPairs[i].embedding, validPairs[j].embedding)

      // Use a lower dedup threshold for chunks from the same folder
      // (iterative files like draft → analysis → meta-analysis rephrase similar content)
      const folderI = getFolder(validPairs[i], memoryCount, contextChunks)
      const folderJ = getFolder(validPairs[j], memoryCount, contextChunks)
      const sameFolder = folderI === folderJ && folderI !== '__root__' && folderI !== '__memories__'
      const threshold = sameFolder ? SAME_FOLDER_DEDUP_THRESHOLD : DEDUP_THRESHOLD

      if (sim >= threshold) {
        // When two items are near-duplicates, keep the higher-authority one.
        // This means a meta-analysis's version of a fact overrides an early draft's.
        const authI = validPairs[i].authority
        const authJ = validPairs[j].authority
        if (authI !== authJ) {
          // Drop the lower-authority duplicate
          dedupSet.add(authI > authJ ? j : i)
        } else if (validPairs[i].source === 'memory' && validPairs[j].source === 'memory') {
          // Same authority, both memories: prefer higher importance
          const memI = memories[validPairs[i].index]
          const memJ = memories[validPairs[j].index]
          dedupSet.add(memJ.importance > memI.importance || memJ.content.length > memI.content.length ? i : j)
        } else {
          // Same authority: keep the longer one
          dedupSet.add(validPairs[j].text.length > validPairs[i].text.length ? i : j)
        }
      }
    }
  }

  const unique = validPairs.filter((_, i) => !dedupSet.has(i))
  onProgress?.({ phase: 'dedup', percent: 35, detail: `${unique.length} unique items (removed ${dedupSet.size} duplicates)` })

  // Phase 3: Cluster
  onProgress?.({ phase: 'clustering', percent: 40, detail: 'Finding optimal clusters...' })
  const uniqueEmbeddings = unique.map(p => p.embedding)
  // Scale min clusters with data size: at least 5 for 50+ items, at least 8 for 200+
  const minK = unique.length <= 3 ? 1 : unique.length <= 10 ? 2 : unique.length <= 50 ? 4 : unique.length <= 200 ? 6 : 8
  const maxK = Math.min(20, Math.max(minK + 1, Math.floor(unique.length / 3)))
  const optimalK = unique.length <= 3 ? 1 : selectOptimalK(uniqueEmbeddings, minK, maxK)
  const assignments = kMeansClustering(uniqueEmbeddings, optimalK)
  const clusterLabels = computeClusterLabels(unique.map(p => p.text), assignments)

  onProgress?.({ phase: 'clustering', percent: 50, detail: `Formed ${optimalK} knowledge clusters` })

  // Phase 4: Summarize each cluster (LLM if available, local extraction otherwise)
  const hasApiKey = await checkLLMAvailable()
  onProgress?.({ phase: 'summarizing', percent: 55, detail: hasApiKey ? 'Summarizing clusters via AI...' : 'Extracting knowledge locally (no API key)...' })
  const clusterGroups = new Map<number, typeof unique>()
  for (let i = 0; i < unique.length; i++) {
    const c = assignments[i]
    if (!clusterGroups.has(c)) clusterGroups.set(c, [])
    clusterGroups.get(c)!.push(unique[i])
  }

  const clusters: KnowledgeCluster[] = []
  let clusterIdx = 0
  const totalClusters = clusterGroups.size

  for (const [cIdx, members] of clusterGroups) {
    const pct = 55 + Math.round((clusterIdx / totalClusters) * 25)
    onProgress?.({ phase: 'summarizing', percent: pct, detail: `${hasApiKey ? 'Summarizing' : 'Extracting'} cluster ${clusterIdx + 1}/${totalClusters}: ${clusterLabels[cIdx]}` })

    let summary: string
    let facts: string[]

    if (hasApiKey) {
      // Build the text block for this cluster, citing sources with authority scores
      // Sort members by authority so LLM sees most authoritative content first
      const sortedMembers = [...members].sort((a, b) => b.authority - a.authority)
      const clusterTextParts = sortedMembers.map(m => {
        const authLabel = m.authority >= 70 ? '⭐HIGH-AUTHORITY' : m.authority <= 35 ? 'low-authority' : ''
        if (m.source === 'memory' && m.index < memoryCount) {
          const mem = memories[m.index]
          return `- [Memory: ${mem.title}]${authLabel ? ` (${authLabel})` : ''} ${mem.content}`
        } else {
          const chunkIdx = m.index - memoryCount
          const chunk = contextChunks[chunkIdx]
          return `- [File: ${chunk?.fileName || 'unknown'}]${authLabel ? ` (${authLabel})` : ''} ${m.text.slice(0, 1500)}`
        }
      })
      // Truncate to ~8000 chars to stay within LLM context
      let clusterText = ''
      for (const part of clusterTextParts) {
        if (clusterText.length + part.length > 8000) break
        clusterText += part + '\n'
      }

      try {
        const response = await callLLM({
          system: 'You compress knowledge. Output ONLY valid JSON with no markdown fencing.',
          prompt: `Given these related knowledge items under the topic "${clusterLabels[cIdx]}":\n\n${clusterText}\n\nIMPORTANT: Items marked ⭐HIGH-AUTHORITY are from meta-analyses, final summaries, or corrections that SUPERSEDE earlier drafts. When sources conflict, always prefer the high-authority version. Low-authority items are raw data/early drafts.\n\nProduce a JSON object with:\n- "summary": A concise 1-2 sentence summary of the key theme, based primarily on high-authority sources\n- "facts": An array of 5-15 atomic, standalone facts. Each fact MUST start with its source in brackets like "[Memory: title]" or "[File: path]". Prefer facts from high-authority sources. When two sources disagree, only include the high-authority version. Never fabricate information.\n\nOutput ONLY valid JSON.`,
          tier: 'fast',
          maxTokens: 1024,
        })

        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(cleaned)
        summary = parsed.summary || clusterLabels[cIdx]
        facts = Array.isArray(parsed.facts) ? parsed.facts : []
      } catch {
        // LLM failed — fall through to local extraction
        const extracted = extractLocalSummaryAndFacts(members, clusterLabels[cIdx], memories, memoryCount, contextChunks)
        summary = extracted.summary
        facts = extracted.facts
      }
    } else {
      // Pure local extraction — no API needed
      const extracted = extractLocalSummaryAndFacts(members, clusterLabels[cIdx], memories, memoryCount, contextChunks)
      summary = extracted.summary
      facts = extracted.facts
    }

    clusters.push({
      label: clusterLabels[cIdx],
      summary,
      facts,
      memoryCount: members.length,
    })
    clusterIdx++
  }

  // Phase 4b: Folder-aware conflict resolution
  // When a folder has files at different authority levels (e.g., early draft + meta-analysis),
  // scan extracted facts for contradictions and prefer the high-authority version.
  if (hasApiKey) {
    // Build a map of folders → authority range
    const folderAuthRange = new Map<string, { min: number; max: number }>()
    for (const file of contextFiles) {
      if (!file.folder) continue
      const range = folderAuthRange.get(file.folder) || { min: 100, max: 0 }
      range.min = Math.min(range.min, file.authority)
      range.max = Math.max(range.max, file.authority)
      folderAuthRange.set(file.folder, range)
    }

    // Find folders with significant authority spread (iterative file sets)
    const iterativeFolders = [...folderAuthRange.entries()]
      .filter(([, range]) => range.max - range.min >= 20)
      .map(([folder]) => folder)

    if (iterativeFolders.length > 0) {
      onProgress?.({ phase: 'summarizing', percent: 82, detail: `Resolving conflicts in ${iterativeFolders.length} folder(s) with iterative files...` })

      // For each cluster, if it has facts from an iterative folder, do a conflict-resolution pass
      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci]
        // Check if this cluster has facts from iterative folders
        const hasIterativeFacts = cluster.facts.some(f => {
          return iterativeFolders.some(folder => f.includes(`[File: ${folder}/`))
        })
        if (!hasIterativeFacts || cluster.facts.length < 3) continue

        try {
          const reconciled = await callLLM({
            system: 'You reconcile conflicting information. Output ONLY a JSON array of strings.',
            prompt: `These facts were extracted from files in a folder where later files correct/refine earlier files. Facts from ⭐HIGH-AUTHORITY sources (meta-analyses, final summaries) should override facts from low-authority sources (early drafts, raw notes) when they conflict.\n\nFacts:\n${cluster.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nReview for contradictions. If a high-authority fact contradicts a low-authority one, REMOVE the low-authority version. If facts are redundant (saying the same thing differently), keep only the best version. Do NOT add new facts.\n\nReturn a JSON array of the surviving facts (strings only).`,
            tier: 'fast',
            maxTokens: 1024,
          })
          const cleaned = reconciled.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed) && parsed.length > 0) {
            clusters[ci] = { ...cluster, facts: parsed }
          }
        } catch {
          // Conflict resolution failed — keep original facts
        }
      }
    }
  }

  // Phase 5: Generate overview
  onProgress?.({ phase: 'overview', percent: 85, detail: 'Generating knowledge overview...' })

  let overview: string
  if (hasApiKey) {
    try {
      const clusterSummaries = clusters.map(c => `- ${c.label}: ${c.summary}`).join('\n')
      overview = await callLLM({
        system: 'You write concise knowledge overviews. Be direct and informative.',
        prompt: `Given these knowledge clusters:\n\n${clusterSummaries}\n\nWrite a brief 2-4 sentence overview that captures the breadth and key themes of this knowledge base. This knowledge was extracted from the user's personal memory system and context files, with later analyses and meta-analyses given priority over earlier drafts when information conflicted.`,
        tier: 'fast',
        maxTokens: 512,
      })
    } catch {
      overview = generateLocalOverview(clusters, memoryCount, contextFiles.length)
    }
  } else {
    overview = generateLocalOverview(clusters, memoryCount, contextFiles.length)
  }

  const totalFacts = clusters.reduce((sum, c) => sum + c.facts.length, 0)
  const durationMs = Date.now() - startTime

  const pack: KnowledgePack = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    overview,
    clusters,
    stats: {
      totalMemories: memoryCount,
      totalContextFiles: contextFiles.length,
      totalChunks: totalSources,
      totalFacts,
      compressionRatio: totalSources > 0 ? parseFloat((totalFacts / totalSources).toFixed(2)) : 0,
      durationMs,
    },
  }

  saveKnowledgePack(pack)

  onProgress?.({ phase: 'done', percent: 100, detail: 'Compression complete' })

  return pack
}

// --- Compression Quality Audit ---

export interface CompressionAudit {
  coverageScore: number           // 0-100, % of original items with a matching fact
  totalOriginalItems: number
  coveredItems: number
  uncoveredItems: { text: string; source: string; bestMatchScore: number }[]
  clusterCoverage: { label: string; itemCount: number; factCount: number; avgCoverage: number }[]
  duplicatesRemoved: number
}

/**
 * Audit a knowledge pack to measure information loss.
 * Embeds all original items and all extracted facts, then checks
 * how well each original item is represented in the compressed output.
 */
export async function auditCompression(
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionAudit> {
  onProgress?.({ phase: 'embedding', percent: 5, detail: 'Gathering original sources for audit...' })

  // Gather originals (same as compression pipeline)
  const memories = getMemories()
  const memoryTexts = memories.map(m => `${m.title}. ${m.content}`)
  const contextFiles = readAllContextFiles()
  const contextChunks: { fileName: string; text: string }[] = []
  for (const file of contextFiles) {
    for (const chunk of chunkMarkdown(file.content)) {
      contextChunks.push({ fileName: file.name, text: chunk })
    }
  }
  const allOriginals = [
    ...memoryTexts.map(t => ({ text: t, source: 'memory' as const })),
    ...contextChunks.map(c => ({ text: c.text, source: `file:${c.fileName}` })),
  ]

  // Get latest pack
  const packs = getKnowledgePacks()
  const pack = packs[0]
  if (!pack) {
    return {
      coverageScore: 0, totalOriginalItems: allOriginals.length,
      coveredItems: 0, uncoveredItems: [], clusterCoverage: [], duplicatesRemoved: 0,
    }
  }

  // Build fact texts from the pack
  const factTexts: string[] = []
  for (const cluster of pack.clusters) {
    factTexts.push(cluster.summary)
    factTexts.push(...cluster.facts)
  }
  if (pack.overview) factTexts.push(pack.overview)

  onProgress?.({ phase: 'embedding', percent: 20, detail: `Embedding ${allOriginals.length} originals + ${factTexts.length} compressed items...` })

  // Embed both sets
  const originalEmbeddings = await embedBatch(allOriginals.map(o => o.text))
  const factEmbeddings = await embedBatch(factTexts)

  const validFacts = factEmbeddings.filter(e => e !== null) as Float32Array[]

  onProgress?.({ phase: 'summarizing', percent: 60, detail: 'Computing coverage scores...' })

  // For each original, find the best-matching fact
  const COVERAGE_THRESHOLD = 0.45 // cosine sim above this = "covered"
  const uncoveredItems: CompressionAudit['uncoveredItems'] = []
  let coveredCount = 0

  for (let i = 0; i < allOriginals.length; i++) {
    const emb = originalEmbeddings[i]
    if (!emb) continue

    let bestScore = 0
    for (const factEmb of validFacts) {
      const sim = cosineSimilarity(emb, factEmb)
      if (sim > bestScore) bestScore = sim
    }

    if (bestScore >= COVERAGE_THRESHOLD) {
      coveredCount++
    } else {
      uncoveredItems.push({
        text: allOriginals[i].text.slice(0, 200),
        source: allOriginals[i].source,
        bestMatchScore: parseFloat(bestScore.toFixed(3)),
      })
    }
  }

  // Sort uncovered by worst coverage first
  uncoveredItems.sort((a, b) => a.bestMatchScore - b.bestMatchScore)

  // Per-cluster coverage
  const clusterCoverage = pack.clusters.map(cluster => {
    const clusterFactTexts = [cluster.summary, ...cluster.facts]
    return {
      label: cluster.label,
      itemCount: cluster.memoryCount,
      factCount: cluster.facts.length,
      avgCoverage: cluster.facts.length > 0 ? parseFloat((cluster.facts.length / Math.max(cluster.memoryCount, 1) * 100).toFixed(1)) : 0,
    }
  })

  const totalValid = originalEmbeddings.filter(e => e !== null).length
  const coverageScore = totalValid > 0 ? parseFloat((coveredCount / totalValid * 100).toFixed(1)) : 0
  const duplicatesRemoved = allOriginals.length - (pack.stats.totalChunks || allOriginals.length)

  onProgress?.({ phase: 'done', percent: 100, detail: 'Audit complete' })

  return {
    coverageScore,
    totalOriginalItems: totalValid,
    coveredItems: coveredCount,
    uncoveredItems: uncoveredItems.slice(0, 50), // top 50 worst gaps
    clusterCoverage,
    duplicatesRemoved: Math.max(0, duplicatesRemoved),
  }
}

// --- Single-File Compression Test ---

export interface SingleFileTestResult {
  fileName: string
  originalSize: number
  originalText: string
  chunks: number
  clusters: KnowledgeCluster[]
  totalFacts: number
  overview: string
  durationMs: number
}

/**
 * Compress a single context file for testing/auditing purposes.
 * Takes a file path relative to ~/.claude/memory/ and runs the full pipeline on just that file.
 */
export async function compressSingleFile(
  relativePath: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<SingleFileTestResult> {
  const startTime = Date.now()
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const memoryDir = path.join(homeDir, '.claude', 'memory')
  const fullPath = path.join(memoryDir, relativePath)

  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${relativePath}`)
  }

  const content = fs.readFileSync(fullPath, 'utf-8').trim()
  if (content.length < 20) {
    throw new Error('File is too short to compress')
  }

  onProgress?.({ phase: 'embedding', percent: 5, detail: `Reading ${relativePath}...` })

  // Chunk the file
  const chunks = chunkMarkdown(content)
  const contextChunks = chunks.map(text => ({ fileName: relativePath, text }))

  onProgress?.({ phase: 'embedding', percent: 15, detail: `Embedding ${chunks.length} chunks...` })

  // Embed all chunks
  const embeddings = await embedBatch(chunks)
  const validPairs: { index: number; embedding: Float32Array; text: string; source: 'context'; }[] = []
  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i]) {
      validPairs.push({ index: i, embedding: embeddings[i]!, text: chunks[i], source: 'context' })
    }
  }

  if (validPairs.length === 0) {
    throw new Error('Embedding model not ready')
  }

  // Dedup
  onProgress?.({ phase: 'dedup', percent: 30, detail: 'Deduplicating...' })
  const dedupSet = new Set<number>()
  for (let i = 0; i < validPairs.length; i++) {
    if (dedupSet.has(i)) continue
    for (let j = i + 1; j < validPairs.length; j++) {
      if (dedupSet.has(j)) continue
      if (cosineSimilarity(validPairs[i].embedding, validPairs[j].embedding) >= DEDUP_THRESHOLD) {
        dedupSet.add(validPairs[j].text.length > validPairs[i].text.length ? i : j)
      }
    }
  }
  const unique = validPairs.filter((_, i) => !dedupSet.has(i))

  // Cluster
  onProgress?.({ phase: 'clustering', percent: 40, detail: `Clustering ${unique.length} unique chunks...` })
  const uniqueEmbeddings = unique.map(p => p.embedding)
  const minK = unique.length <= 3 ? 1 : unique.length <= 6 ? 2 : Math.min(4, Math.floor(unique.length / 2))
  const maxK = Math.min(8, Math.max(minK + 1, Math.floor(unique.length / 2)))
  const optimalK = unique.length <= 3 ? 1 : selectOptimalK(uniqueEmbeddings, minK, maxK)
  const assignments = kMeansClustering(uniqueEmbeddings, optimalK)
  const clusterLabels = computeClusterLabels(unique.map(p => p.text), assignments)

  // Summarize
  const hasApiKey = await checkLLMAvailable()
  onProgress?.({ phase: 'summarizing', percent: 55, detail: hasApiKey ? 'Summarizing via AI...' : 'Extracting locally...' })

  const clusterGroups = new Map<number, typeof unique>()
  for (let i = 0; i < unique.length; i++) {
    const c = assignments[i]
    if (!clusterGroups.has(c)) clusterGroups.set(c, [])
    clusterGroups.get(c)!.push(unique[i])
  }

  const clusters: KnowledgeCluster[] = []
  let clusterIdx = 0

  for (const [cIdx, members] of clusterGroups) {
    const pct = 55 + Math.round((clusterIdx / clusterGroups.size) * 25)
    onProgress?.({ phase: 'summarizing', percent: pct, detail: `Cluster ${clusterIdx + 1}/${clusterGroups.size}: ${clusterLabels[cIdx]}` })

    let summary: string
    let facts: string[]

    if (hasApiKey) {
      const clusterText = members.map(m => `- [File: ${relativePath}] ${m.text.slice(0, 1500)}`).join('\n')
      try {
        const response = await callLLM({
          system: 'You compress knowledge. Output ONLY valid JSON with no markdown fencing.',
          prompt: `Given these related chunks from "${relativePath}" under topic "${clusterLabels[cIdx]}":\n\n${clusterText.slice(0, 8000)}\n\nProduce a JSON object with:\n- "summary": A concise 1-2 sentence summary\n- "facts": An array of 5-15 atomic, standalone facts. Each fact MUST start with "[${relativePath}]". Never fabricate information not present in the source.\n\nOutput ONLY valid JSON.`,
          tier: 'fast',
          maxTokens: 1024,
        })
        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(cleaned)
        summary = parsed.summary || clusterLabels[cIdx]
        facts = Array.isArray(parsed.facts) ? parsed.facts : []
      } catch {
        const extracted = extractLocalSummaryAndFacts(members, clusterLabels[cIdx], [], 0, contextChunks)
        summary = extracted.summary
        facts = extracted.facts
      }
    } else {
      const extracted = extractLocalSummaryAndFacts(members, clusterLabels[cIdx], [], 0, contextChunks)
      summary = extracted.summary
      facts = extracted.facts
    }

    clusters.push({ label: clusterLabels[cIdx], summary, facts, memoryCount: members.length })
    clusterIdx++
  }

  // Overview
  onProgress?.({ phase: 'overview', percent: 85, detail: 'Generating overview...' })
  let overview: string
  if (hasApiKey) {
    try {
      const clusterSummaries = clusters.map(c => `- ${c.label}: ${c.summary}`).join('\n')
      overview = await callLLM({
        system: 'You write concise knowledge overviews. Be direct.',
        prompt: `Summarize the key themes from this single file "${relativePath}":\n\n${clusterSummaries}\n\nWrite a 1-3 sentence overview.`,
        tier: 'fast',
        maxTokens: 256,
      })
    } catch {
      overview = `File "${relativePath}" contains ${clusters.length} topic clusters with ${clusters.reduce((s, c) => s + c.facts.length, 0)} extracted facts.`
    }
  } else {
    overview = `File "${relativePath}" contains ${clusters.length} topic clusters with ${clusters.reduce((s, c) => s + c.facts.length, 0)} extracted facts.`
  }

  const totalFacts = clusters.reduce((s, c) => s + c.facts.length, 0)
  onProgress?.({ phase: 'done', percent: 100, detail: 'Done' })

  return {
    fileName: relativePath,
    originalSize: content.length,
    originalText: content,
    chunks: chunks.length,
    clusters,
    totalFacts,
    overview,
    durationMs: Date.now() - startTime,
  }
}

// --- Folder Compression ---

export interface FolderCompressionResult {
  folder: string
  fileCount: number
  filesUsed: { name: string; authority: number; chunksContributed: number }[]
  clusters: KnowledgeCluster[]
  overview: string
  totalFacts: number
  dedupRemoved: number
  conflictsResolved: boolean
  durationMs: number
}

/**
 * Compress all files in a specific folder, using authority-aware dedup and conflict resolution.
 * This is the "mega meta-analysis" — later/refined files override earlier drafts.
 */
export async function compressFolder(
  folder: string,
  onProgress?: (progress: CompressionProgress) => void
): Promise<FolderCompressionResult> {
  const startTime = Date.now()

  onProgress?.({ phase: 'embedding', percent: 2, detail: `Gathering files from ${folder}/...` })

  // Read all context files, filter to target folder
  const allFiles = readAllContextFiles()
  const folderFiles = allFiles.filter(f => f.folder === folder)

  if (folderFiles.length === 0) {
    throw new Error(`No files found in folder: ${folder}`)
  }

  // Log authority distribution
  const authSpread = folderFiles[0].authority - folderFiles[folderFiles.length - 1].authority
  console.log(`Folder compression: ${folder}/ — ${folderFiles.length} files, authority ${folderFiles[folderFiles.length - 1].authority}-${folderFiles[0].authority} (${authSpread}pt spread)`)

  // Chunk all files, preserving authority
  const contextChunks: { fileName: string; text: string; authority: number }[] = []
  const fileChunkCounts: Map<string, number> = new Map()

  for (const file of folderFiles) {
    const chunks = chunkMarkdown(file.content)
    fileChunkCounts.set(file.name, chunks.length)
    for (const chunk of chunks) {
      contextChunks.push({ fileName: file.name, text: chunk, authority: file.authority })
    }
  }

  onProgress?.({ phase: 'embedding', percent: 10, detail: `Embedding ${contextChunks.length} chunks from ${folderFiles.length} files...` })

  // Embed all chunks
  const allTexts = contextChunks.map(c => c.text)
  const embeddings = await embedBatch(allTexts)

  const validPairs: { index: number; embedding: Float32Array; text: string; source: 'context'; authority: number; fileName: string }[] = []
  for (let i = 0; i < embeddings.length; i++) {
    if (embeddings[i]) {
      validPairs.push({
        index: i,
        embedding: embeddings[i]!,
        text: allTexts[i],
        source: 'context',
        authority: contextChunks[i].authority,
        fileName: contextChunks[i].fileName,
      })
    }
  }

  if (validPairs.length === 0) {
    throw new Error('Embedding model not ready. Please wait for model initialization.')
  }

  onProgress?.({ phase: 'embedding', percent: 25, detail: `Embedded ${validPairs.length}/${contextChunks.length} chunks` })

  // Dedup with same-folder threshold (all files are in the same folder)
  onProgress?.({ phase: 'dedup', percent: 30, detail: 'Deduplicating (authority-aware, same-folder threshold)...' })
  const dedupSet = new Set<number>()
  for (let i = 0; i < validPairs.length; i++) {
    if (dedupSet.has(i)) continue
    for (let j = i + 1; j < validPairs.length; j++) {
      if (dedupSet.has(j)) continue
      const sim = cosineSimilarity(validPairs[i].embedding, validPairs[j].embedding)
      // Use the aggressive same-folder threshold since all files are iterative
      if (sim >= SAME_FOLDER_DEDUP_THRESHOLD) {
        const authI = validPairs[i].authority
        const authJ = validPairs[j].authority
        if (authI !== authJ) {
          dedupSet.add(authI > authJ ? j : i)
        } else {
          dedupSet.add(validPairs[j].text.length > validPairs[i].text.length ? i : j)
        }
      }
    }
  }

  const unique = validPairs.filter((_, i) => !dedupSet.has(i))
  onProgress?.({ phase: 'dedup', percent: 40, detail: `${unique.length} unique chunks (removed ${dedupSet.size} duplicates)` })

  // Track which files contributed after dedup
  const fileContributions = new Map<string, number>()
  for (const p of unique) {
    fileContributions.set(p.fileName, (fileContributions.get(p.fileName) || 0) + 1)
  }

  // Cluster
  onProgress?.({ phase: 'clustering', percent: 45, detail: 'Clustering knowledge themes...' })
  const uniqueEmbeddings = unique.map(p => p.embedding)
  const minK = unique.length <= 3 ? 1 : unique.length <= 10 ? 2 : unique.length <= 50 ? 4 : 6
  const maxK = Math.min(15, Math.max(minK + 1, Math.floor(unique.length / 3)))
  const optimalK = unique.length <= 3 ? 1 : selectOptimalK(uniqueEmbeddings, minK, maxK)
  const assignments = kMeansClustering(uniqueEmbeddings, optimalK)
  const clusterLabels = computeClusterLabels(unique.map(p => p.text), assignments)

  onProgress?.({ phase: 'clustering', percent: 55, detail: `Formed ${optimalK} knowledge clusters` })

  // Summarize each cluster
  const hasApiKey = await checkLLMAvailable()
  const clusterGroups = new Map<number, typeof unique>()
  for (let i = 0; i < unique.length; i++) {
    const c = assignments[i]
    if (!clusterGroups.has(c)) clusterGroups.set(c, [])
    clusterGroups.get(c)!.push(unique[i])
  }

  const clusters: KnowledgeCluster[] = []
  let clusterIdx = 0

  for (const [cIdx, members] of clusterGroups) {
    const pct = 55 + Math.round((clusterIdx / clusterGroups.size) * 20)
    onProgress?.({ phase: 'summarizing', percent: pct, detail: `${hasApiKey ? 'Summarizing' : 'Extracting'} cluster ${clusterIdx + 1}/${clusterGroups.size}: ${clusterLabels[cIdx]}` })

    let summary: string
    let facts: string[]

    if (hasApiKey) {
      // Sort by authority, build text with authority labels
      const sortedMembers = [...members].sort((a, b) => b.authority - a.authority)
      const clusterTextParts = sortedMembers.map(m => {
        const authLabel = m.authority >= 70 ? '⭐HIGH-AUTHORITY' : m.authority <= 45 ? 'low-authority' : ''
        return `- [File: ${m.fileName}]${authLabel ? ` (${authLabel})` : ''} ${m.text.slice(0, 1500)}`
      })
      let clusterText = ''
      for (const part of clusterTextParts) {
        if (clusterText.length + part.length > 8000) break
        clusterText += part + '\n'
      }

      try {
        const response = await callLLM({
          system: 'You compress knowledge from iterative analysis files. Output ONLY valid JSON with no markdown fencing.',
          prompt: `These are related excerpts from the "${folder}/" folder under the topic "${clusterLabels[cIdx]}". These files were written iteratively — later analyses refine and sometimes correct earlier ones.\n\n${clusterText}\n\nIMPORTANT:\n- Items marked ⭐HIGH-AUTHORITY are from meta-analyses, final summaries, or corrections that SUPERSEDE earlier drafts.\n- Items marked "low-authority" are raw data (quotes, daily logs) — use only for supporting evidence, not primary claims.\n- When sources conflict, ALWAYS prefer the high-authority version.\n- Never fabricate information not present in the sources.\n\nProduce a JSON object with:\n- "summary": A concise 1-2 sentence summary based primarily on high-authority sources\n- "facts": An array of 5-15 atomic, standalone facts. Each fact MUST start with its source in brackets like "[File: path]". Prefer facts from high-authority sources.\n\nOutput ONLY valid JSON.`,
          tier: 'fast',
          maxTokens: 1024,
        })
        const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(cleaned)
        summary = parsed.summary || clusterLabels[cIdx]
        facts = Array.isArray(parsed.facts) ? parsed.facts : []
      } catch {
        const extracted = extractLocalSummaryAndFacts(
          members.map(m => ({ ...m, index: 0 })),
          clusterLabels[cIdx], [], 0,
          contextChunks
        )
        summary = extracted.summary
        facts = extracted.facts
      }
    } else {
      const extracted = extractLocalSummaryAndFacts(
        members.map(m => ({ ...m, index: 0 })),
        clusterLabels[cIdx], [], 0,
        contextChunks
      )
      summary = extracted.summary
      facts = extracted.facts
    }

    clusters.push({ label: clusterLabels[cIdx], summary, facts, memoryCount: members.length })
    clusterIdx++
  }

  // Conflict resolution pass
  let conflictsResolved = false
  if (hasApiKey && authSpread >= 20) {
    onProgress?.({ phase: 'summarizing', percent: 78, detail: 'Resolving cross-file conflicts...' })

    for (let ci = 0; ci < clusters.length; ci++) {
      const cluster = clusters[ci]
      if (cluster.facts.length < 3) continue

      try {
        const reconciled = await callLLM({
          system: 'You reconcile conflicting information from iterative analysis files. Output ONLY a JSON array of strings.',
          prompt: `These facts were extracted from "${folder}/" — a folder where later files correct/refine earlier ones. Facts from ⭐HIGH-AUTHORITY sources (meta-analyses, final summaries, perspective corrections) should override facts from low-authority sources (daily logs, raw quotes, early analyses).\n\nFacts:\n${cluster.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nReview for:\n1. Contradictions — if a high-authority fact contradicts a low-authority one, REMOVE the low-authority version\n2. Redundancy — if facts say the same thing differently, keep only the best version\n3. Speculation from low-authority sources that's corrected by high-authority sources — REMOVE the speculation\n\nDo NOT add new facts. Return a JSON array of the surviving facts (strings only).`,
          tier: 'fast',
          maxTokens: 1024,
        })
        const cleaned = reconciled.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        const parsed = JSON.parse(cleaned)
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length < cluster.facts.length) {
          clusters[ci] = { ...cluster, facts: parsed }
          conflictsResolved = true
        }
      } catch {
        // Keep original facts
      }
    }
  }

  // Generate overview
  onProgress?.({ phase: 'overview', percent: 85, detail: 'Generating folder overview...' })
  let overview: string
  if (hasApiKey) {
    try {
      const clusterSummaries = clusters.map(c => `- ${c.label}: ${c.summary}`).join('\n')
      const fileList = folderFiles.slice(0, 5).map(f => `${f.name} (authority: ${f.authority})`).join(', ')
      overview = await callLLM({
        system: 'You write concise knowledge overviews. Be direct.',
        prompt: `Summarize the key themes from the "${folder}/" folder (${folderFiles.length} files, authority range ${folderFiles[folderFiles.length - 1].authority}-${folderFiles[0].authority}).\n\nTop files: ${fileList}\n\nClusters:\n${clusterSummaries}\n\nWrite a 2-4 sentence overview that synthesizes the highest-authority conclusions. Later analyses and corrections have been given priority over earlier drafts.`,
        tier: 'fast',
        maxTokens: 512,
      })
    } catch {
      overview = `Folder "${folder}/" contains ${folderFiles.length} files compressed into ${clusters.length} clusters with ${clusters.reduce((s, c) => s + c.facts.length, 0)} facts. Authority range: ${folderFiles[folderFiles.length - 1].authority}-${folderFiles[0].authority}.`
    }
  } else {
    overview = `Folder "${folder}/" contains ${folderFiles.length} files compressed into ${clusters.length} clusters with ${clusters.reduce((s, c) => s + c.facts.length, 0)} facts. Authority range: ${folderFiles[folderFiles.length - 1].authority}-${folderFiles[0].authority}.`
  }

  const totalFacts = clusters.reduce((s, c) => s + c.facts.length, 0)
  onProgress?.({ phase: 'done', percent: 100, detail: 'Folder compression complete' })

  return {
    folder,
    fileCount: folderFiles.length,
    filesUsed: folderFiles.map(f => ({
      name: f.name,
      authority: f.authority,
      chunksContributed: fileContributions.get(f.name) || 0,
    })),
    clusters,
    overview,
    totalFacts,
    dedupRemoved: dedupSet.size,
    conflictsResolved,
    durationMs: Date.now() - startTime,
  }
}

// --- Embedding Similarity Test ---

export async function testEmbeddingSimilarity(textA: string, textB: string): Promise<{ similarity: number; embeddingDim: number }> {
  const embeddings = await embedBatch([textA, textB])
  if (!embeddings[0] || !embeddings[1]) {
    throw new Error('Embedding model not ready')
  }
  const similarity = cosineSimilarity(embeddings[0], embeddings[1])
  return { similarity: parseFloat(similarity.toFixed(4)), embeddingDim: embeddings[0].length }
}

// --- List Context Files for Lab ---

export function listContextFiles(): { name: string; size: number; isStub: boolean; authority: number }[] {
  const homeDir = process.env.USERPROFILE || process.env.HOME || ''
  const memoryDir = path.join(homeDir, '.claude', 'memory')
  if (!fs.existsSync(memoryDir)) return []
  const results: { name: string; size: number; isStub: boolean; authority: number }[] = []
  function scanDir(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath)
      } else if (READABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8').trim()
          const stat = fs.statSync(fullPath)
          const relativePath = path.relative(memoryDir, fullPath).replace(/\\/g, '/')
          const isStub = content.length <= 20 || isStubContent(content)
          const authority = isStub ? 0 : scoreFileAuthority(relativePath, stat.mtime, content.length)
          results.push({ name: relativePath, size: content.length, isStub, authority })
        } catch {}
      }
    }
  }
  scanDir(memoryDir)
  return results.sort((a, b) => b.authority - a.authority || b.size - a.size)
}

// --- Import from memorypack Markdown ---

export function parseKnowledgeBaseMd(filePath: string): KnowledgePack | null {
  if (!fs.existsSync(filePath)) return null

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  let overview = ''
  const clusters: KnowledgeCluster[] = []
  let currentCluster: KnowledgeCluster | null = null
  let inOverview = false
  let inFacts = false

  for (const line of lines) {
    if (line.startsWith('## Overview')) {
      inOverview = true
      inFacts = false
      continue
    }
    if (line.startsWith('## ') && !line.startsWith('## Overview')) {
      inOverview = false
      inFacts = false
      if (currentCluster) clusters.push(currentCluster)
      const label = line.replace('## ', '').trim()
      currentCluster = { label, summary: '', facts: [], memoryCount: 0 }
      continue
    }
    if (line.startsWith('### Facts') || line.startsWith('### Key Facts')) {
      inFacts = true
      continue
    }
    if (line.startsWith('### ')) {
      inFacts = false
      continue
    }

    if (inOverview && line.trim()) {
      overview += (overview ? ' ' : '') + line.trim()
    }

    if (currentCluster && !inFacts && !line.startsWith('#') && line.trim() && !line.startsWith('- ')) {
      currentCluster.summary += (currentCluster.summary ? ' ' : '') + line.trim()
    }

    if (inFacts && currentCluster && line.startsWith('- ')) {
      currentCluster.facts.push(line.slice(2).trim())
    }
  }

  if (currentCluster) clusters.push(currentCluster)

  if (clusters.length === 0 && !overview) return null

  const totalFacts = clusters.reduce((sum, c) => sum + c.facts.length, 0)

  return {
    id: 'import-' + Date.now().toString(36),
    createdAt: new Date().toISOString(),
    overview,
    clusters,
    stats: {
      totalMemories: 0,
      totalFacts,
      compressionRatio: 0,
      durationMs: 0,
    },
  }
}
