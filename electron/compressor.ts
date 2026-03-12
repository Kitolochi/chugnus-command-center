import https from 'https'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { getClaudeApiKey } from './database'
import { chunkAllFiles, Chunk } from './chunker'
import { embedBatch, cosineSimilarity, embedText } from './embeddings'

// ── Types ──────────────────────────────────────────────────────────────────

interface CompressionStats {
  inputTokens: number
  outputTokens: number
  ratio: number
  chunksProcessed: number
  duplicatesRemoved: number
  clustersFound: number
}

interface DomainSummary {
  domain: string
  label: string
  summary: string
  facts: string[]
  embedding?: number[]  // cached centroid for fast similarity lookup
}

interface CompressedKnowledge {
  overview: string
  domains: DomainSummary[]
  lastCompressed: string
  fileHashSnapshot: Record<string, string>
  stats: CompressionStats
}

type ProgressCallback = (info: { phase: string; current: number; total: number }) => void

// ── Constants ──────────────────────────────────────────────────────────────

const MEMORY_DIR = path.join(process.env.HOME || '', '.claude', 'memory')
const DEDUP_THRESHOLD = 0.92
const KMEANS_MAX_ITER = 50
const MIN_K = 2
const MAX_K = 10

// ── Helpers ────────────────────────────────────────────────────────────────

function getCompressedPath(): string {
  return path.join(app.getPath('userData'), 'compressed-knowledge.json')
}

function callClaudeHaiku(apiKey: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            resolve(parsed.content?.[0]?.text || '')
          }
        } catch {
          reject(new Error('Failed to parse API response'))
        }
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(body)
    req.end()
  })
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ── Stage 1: Collect chunks + embeddings ───────────────────────────────────

async function collectAndEmbed(
  onProgress?: ProgressCallback
): Promise<{ chunks: Chunk[]; embeddings: Float32Array[]; fileHashes: Record<string, string> }> {
  onProgress?.({ phase: 'Collecting chunks', current: 0, total: 1 })
  const { chunks, fileHashes } = chunkAllFiles(MEMORY_DIR)
  if (chunks.length === 0) throw new Error('No chunks found in memory directory')

  onProgress?.({ phase: 'Embedding chunks', current: 0, total: chunks.length })
  const texts = chunks.map(c => c.text)
  const rawEmbeddings = await embedBatch(texts)

  // Filter out failed embeddings
  const validChunks: Chunk[] = []
  const validEmbeddings: Float32Array[] = []
  for (let i = 0; i < chunks.length; i++) {
    if (rawEmbeddings[i]) {
      validChunks.push(chunks[i])
      validEmbeddings.push(rawEmbeddings[i]!)
    }
    if (i % 10 === 0) onProgress?.({ phase: 'Embedding chunks', current: i, total: chunks.length })
  }
  onProgress?.({ phase: 'Embedding chunks', current: chunks.length, total: chunks.length })

  return { chunks: validChunks, embeddings: validEmbeddings, fileHashes }
}

// ── Stage 2: Deduplicate (union-find) ──────────────────────────────────────

function deduplicateChunks(
  chunks: Chunk[],
  embeddings: Float32Array[],
  onProgress?: ProgressCallback
): { chunks: Chunk[]; embeddings: Float32Array[]; removedCount: number } {
  const n = chunks.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] }
    return x
  }
  function union(a: number, b: number) {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  onProgress?.({ phase: 'Deduplicating', current: 0, total: n })
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue
      const sim = cosineSimilarity(embeddings[i], embeddings[j])
      if (sim >= DEDUP_THRESHOLD) union(i, j)
    }
    if (i % 10 === 0) onProgress?.({ phase: 'Deduplicating', current: i, total: n })
  }

  // Keep the longest chunk per group
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(i)
  }

  const keepIndices: number[] = []
  for (const members of groups.values()) {
    let best = members[0]
    for (const idx of members) {
      if (chunks[idx].text.length > chunks[best].text.length) best = idx
    }
    keepIndices.push(best)
  }
  keepIndices.sort((a, b) => a - b)

  const removedCount = n - keepIndices.length
  onProgress?.({ phase: 'Deduplicating', current: n, total: n })

  return {
    chunks: keepIndices.map(i => chunks[i]),
    embeddings: keepIndices.map(i => embeddings[i]),
    removedCount,
  }
}

// ── Stage 3: K-means clustering ────────────────────────────────────────────

function kmeansCluster(
  embeddings: Float32Array[],
  k: number
): { assignments: number[]; centroids: Float32Array[] } {
  const dim = embeddings[0].length
  const n = embeddings.length

  // K-means++ initialization
  const centroids: Float32Array[] = []
  const firstIdx = Math.floor(Math.random() * n)
  centroids.push(new Float32Array(embeddings[firstIdx]))

  for (let c = 1; c < k; c++) {
    const distances = embeddings.map(emb => {
      let minDist = Infinity
      for (const cent of centroids) {
        const sim = cosineSimilarity(emb, cent)
        const dist = 1 - sim
        if (dist < minDist) minDist = dist
      }
      return minDist * minDist
    })
    const totalDist = distances.reduce((a, b) => a + b, 0)
    let r = Math.random() * totalDist
    let chosen = 0
    for (let i = 0; i < n; i++) {
      r -= distances[i]
      if (r <= 0) { chosen = i; break }
    }
    centroids.push(new Float32Array(embeddings[chosen]))
  }

  // Iterate
  let assignments = new Array(n).fill(0)
  for (let iter = 0; iter < KMEANS_MAX_ITER; iter++) {
    // Assign
    const newAssignments = embeddings.map(emb => {
      let bestK = 0, bestSim = -Infinity
      for (let c = 0; c < k; c++) {
        const sim = cosineSimilarity(emb, centroids[c])
        if (sim > bestSim) { bestSim = sim; bestK = c }
      }
      return bestK
    })

    // Check convergence
    let changed = false
    for (let i = 0; i < n; i++) {
      if (newAssignments[i] !== assignments[i]) { changed = true; break }
    }
    assignments = newAssignments
    if (!changed) break

    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = assignments.map((a, i) => a === c ? i : -1).filter(i => i >= 0)
      if (members.length === 0) continue
      const newCentroid = new Float32Array(dim)
      for (const idx of members) {
        for (let d = 0; d < dim; d++) newCentroid[d] += embeddings[idx][d]
      }
      for (let d = 0; d < dim; d++) newCentroid[d] /= members.length
      // Normalize
      let norm = 0
      for (let d = 0; d < dim; d++) norm += newCentroid[d] * newCentroid[d]
      norm = Math.sqrt(norm)
      if (norm > 0) for (let d = 0; d < dim; d++) newCentroid[d] /= norm
      centroids[c] = newCentroid
    }
  }

  return { assignments, centroids }
}

function silhouetteScore(embeddings: Float32Array[], assignments: number[], k: number): number {
  const n = embeddings.length
  if (n <= k || k <= 1) return -1

  let totalScore = 0
  let counted = 0

  for (let i = 0; i < n; i++) {
    const myCluster = assignments[i]
    const clusterMembers = assignments.map((a, j) => a === myCluster ? j : -1).filter(j => j >= 0 && j !== i)
    if (clusterMembers.length === 0) continue

    // a(i) = avg distance to own cluster
    const a = clusterMembers.reduce((s, j) => s + (1 - cosineSimilarity(embeddings[i], embeddings[j])), 0) / clusterMembers.length

    // b(i) = min avg distance to other clusters
    let b = Infinity
    for (let c = 0; c < k; c++) {
      if (c === myCluster) continue
      const otherMembers = assignments.map((a, j) => a === c ? j : -1).filter(j => j >= 0)
      if (otherMembers.length === 0) continue
      const avgDist = otherMembers.reduce((s, j) => s + (1 - cosineSimilarity(embeddings[i], embeddings[j])), 0) / otherMembers.length
      if (avgDist < b) b = avgDist
    }

    if (b === Infinity) continue
    const s = (b - a) / Math.max(a, b)
    totalScore += s
    counted++
  }

  return counted > 0 ? totalScore / counted : -1
}

function autoCluster(
  embeddings: Float32Array[],
  onProgress?: ProgressCallback
): { assignments: number[]; centroids: Float32Array[]; k: number } {
  const n = embeddings.length
  const maxK = Math.min(MAX_K, n - 1)
  const minK = Math.min(MIN_K, maxK)

  if (maxK <= minK) {
    const result = kmeansCluster(embeddings, minK)
    return { ...result, k: minK }
  }

  let bestK = minK
  let bestScore = -Infinity
  let bestResult = kmeansCluster(embeddings, minK)

  for (let k = minK; k <= maxK; k++) {
    onProgress?.({ phase: 'Clustering', current: k - minK, total: maxK - minK + 1 })
    const result = kmeansCluster(embeddings, k)
    const score = silhouetteScore(embeddings, result.assignments, k)
    if (score > bestScore) {
      bestScore = score
      bestK = k
      bestResult = result
    }
  }

  onProgress?.({ phase: 'Clustering', current: maxK - minK + 1, total: maxK - minK + 1 })
  return { ...bestResult, k: bestK }
}

// ── Stage 4: Summarize clusters ────────────────────────────────────────────

async function summarizeClusters(
  apiKey: string,
  clusters: { chunks: Chunk[]; label: string }[],
  onProgress?: ProgressCallback
): Promise<{ summaries: string[]; overview: string; inputTokens: number; outputTokens: number }> {
  const summaries: string[] = []
  let inputTokens = 0
  let outputTokens = 0

  for (let i = 0; i < clusters.length; i++) {
    onProgress?.({ phase: 'Summarizing clusters', current: i, total: clusters.length + 1 })
    const cluster = clusters[i]
    const entriesText = cluster.chunks.map(c => `[${c.domain}/${c.heading}] ${c.text}`).join('\n---\n')
    const prompt = `Summarize these related knowledge base entries into a concise ~100 token paragraph. Preserve specific facts, names, numbers, and actionable details. Do not add commentary or introduction — output only the summary paragraph.\n\nEntries:\n${entriesText.slice(0, 6000)}`

    inputTokens += estimateTokens(prompt)
    const summary = await callClaudeHaiku(apiKey, prompt)
    outputTokens += estimateTokens(summary)
    summaries.push(summary.trim())
  }

  // Generate overview
  onProgress?.({ phase: 'Generating overview', current: clusters.length, total: clusters.length + 1 })
  const domainList = clusters.map((c, i) => `- ${c.label}: ${summaries[i].slice(0, 200)}`).join('\n')
  const overviewPrompt = `You are summarizing a personal knowledge base. Given these domain summaries, write a ~200 token overview paragraph that captures the key themes, priorities, and state of the user's knowledge. Output only the overview paragraph.\n\nDomains:\n${domainList}`

  inputTokens += estimateTokens(overviewPrompt)
  const overview = await callClaudeHaiku(apiKey, overviewPrompt)
  outputTokens += estimateTokens(overview)

  onProgress?.({ phase: 'Generating overview', current: clusters.length + 1, total: clusters.length + 1 })
  return { summaries, overview: overview.trim(), inputTokens, outputTokens }
}

// ── Stage 5: Extract facts ─────────────────────────────────────────────────

function extractFacts(chunks: Chunk[]): string[] {
  const facts: string[] = []
  const seen = new Set<string>()

  for (const chunk of chunks) {
    // Clean markdown formatting
    const cleaned = chunk.text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // Split into sentences
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10)

    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (trimmed.length < 15 || trimmed.length > 300) continue

      // Filter: must contain proper nouns, numbers, or specific terms
      const hasProperNoun = /[A-Z][a-z]{2,}/.test(trimmed.slice(1)) // skip first char
      const hasNumber = /\d/.test(trimmed)
      const hasSpecificTerm = /\b(use[sd]?|prefer|always|never|important|key|critical|must|should|requires?)\b/i.test(trimmed)

      if (!hasProperNoun && !hasNumber && !hasSpecificTerm) continue

      // Filter out vague/transitional sentences
      if (/^(this|that|it|these|those|however|moreover|furthermore|additionally|also|note|see|the following)\b/i.test(trimmed)) continue
      if (/^[-*•]\s*$/.test(trimmed)) continue

      // Deduplicate within cluster
      const normalized = trimmed.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(normalized)) continue
      seen.add(normalized)

      facts.push(trimmed)
    }
  }

  return facts.slice(0, 10) // max 10 facts per cluster
}

// ── Stage 6: Generate labels ───────────────────────────────────────────────

function generateLabel(chunks: Chunk[]): string {
  // Try to extract from markdown headings
  for (const chunk of chunks) {
    const headingMatch = chunk.text.match(/^#{1,3}\s+(.+)/m)
    if (headingMatch) {
      const heading = headingMatch[1].trim()
      if (heading.length >= 3 && heading.length <= 60) return heading
    }
  }

  // Fall back to domain name
  const domains = new Map<string, number>()
  for (const chunk of chunks) {
    domains.set(chunk.domain, (domains.get(chunk.domain) || 0) + 1)
  }
  let bestDomain = chunks[0]?.domain || 'general'
  let bestCount = 0
  for (const [d, c] of domains) {
    if (c > bestCount) { bestDomain = d; bestCount = c }
  }

  // Capitalize nicely
  return bestDomain.split(/[-_/]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Main pipeline ──────────────────────────────────────────────────────────

export async function compressKnowledgeBase(
  onProgress?: ProgressCallback
): Promise<CompressedKnowledge> {
  const apiKey = getClaudeApiKey()
  if (!apiKey) throw new Error('No Claude API key configured')

  // Stage 1: Collect and embed
  const { chunks, embeddings, fileHashes } = await collectAndEmbed(onProgress)
  const originalCount = chunks.length

  // Stage 2: Deduplicate
  const deduped = deduplicateChunks(chunks, embeddings, onProgress)

  // Stage 3: Cluster
  const { assignments, k } = autoCluster(deduped.embeddings, onProgress)

  // Group chunks by cluster
  const clusterGroups: { chunks: Chunk[]; embeddings: Float32Array[]; label: string }[] = []
  for (let c = 0; c < k; c++) {
    const memberIndices = assignments.map((a, i) => a === c ? i : -1).filter(i => i >= 0)
    if (memberIndices.length === 0) continue
    const clusterChunks = memberIndices.map(i => deduped.chunks[i])
    const clusterEmbeddings = memberIndices.map(i => deduped.embeddings[i])
    const label = generateLabel(clusterChunks)
    clusterGroups.push({ chunks: clusterChunks, embeddings: clusterEmbeddings, label })
  }

  // Stage 4: Summarize
  const { summaries, overview, inputTokens, outputTokens } = await summarizeClusters(
    apiKey,
    clusterGroups,
    onProgress
  )

  // Stage 5: Extract facts per cluster + cache domain embeddings (mean of cluster chunk embeddings)
  const domains: DomainSummary[] = clusterGroups.map((group, i) => {
    // Compute mean embedding for this cluster (centroid)
    const dim = group.embeddings[0]?.length || 0
    let centroid: number[] | undefined
    if (dim > 0 && group.embeddings.length > 0) {
      const mean = new Float32Array(dim)
      for (const emb of group.embeddings) {
        for (let d = 0; d < dim; d++) mean[d] += emb[d]
      }
      for (let d = 0; d < dim; d++) mean[d] /= group.embeddings.length
      // Normalize
      let norm = 0
      for (let d = 0; d < dim; d++) norm += mean[d] * mean[d]
      norm = Math.sqrt(norm)
      if (norm > 0) for (let d = 0; d < dim; d++) mean[d] /= norm
      centroid = Array.from(mean)
    }

    return {
      domain: group.chunks[0]?.domain || 'general',
      label: group.label,
      summary: summaries[i],
      facts: extractFacts(group.chunks),
      embedding: centroid,
    }
  })

  // Calculate stats
  const totalInputChars = deduped.chunks.reduce((s, c) => s + c.text.length, 0)
  const totalOutputChars = overview.length + domains.reduce((s, d) => s + d.summary.length + d.facts.join('').length, 0)

  const result: CompressedKnowledge = {
    overview,
    domains,
    lastCompressed: new Date().toISOString(),
    fileHashSnapshot: fileHashes,
    stats: {
      inputTokens,
      outputTokens,
      ratio: totalInputChars > 0 ? parseFloat((totalInputChars / totalOutputChars).toFixed(1)) : 1,
      chunksProcessed: originalCount,
      duplicatesRemoved: deduped.removedCount,
      clustersFound: clusterGroups.length,
    },
  }

  // Stage 7: Persist
  onProgress?.({ phase: 'Saving', current: 1, total: 1 })
  fs.writeFileSync(getCompressedPath(), JSON.stringify(result, null, 2), 'utf-8')

  return result
}

// ── Accessors ──────────────────────────────────────────────────────────────

export function loadCompressedKnowledge(): CompressedKnowledge | null {
  const filePath = getCompressedPath()
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export function isCompressionStale(): boolean {
  const knowledge = loadCompressedKnowledge()
  if (!knowledge) return true

  const { chunks, fileHashes } = chunkAllFiles(MEMORY_DIR)
  if (chunks.length === 0) return false

  // Compare file hashes
  const oldHashes = knowledge.fileHashSnapshot
  const newKeys = Object.keys(fileHashes)
  const oldKeys = Object.keys(oldHashes)

  if (newKeys.length !== oldKeys.length) return true
  for (const key of newKeys) {
    if (oldHashes[key] !== fileHashes[key]) return true
  }
  return false
}

export function getCompressedOverview(): string {
  const knowledge = loadCompressedKnowledge()
  return knowledge?.overview || ''
}

export interface ScoredDomain {
  domain: DomainSummary
  sim: number
}

export async function getRelevantDomainSummaries(
  query: string,
  topK: number = 3
): Promise<ScoredDomain[]> {
  const knowledge = loadCompressedKnowledge()
  if (!knowledge || knowledge.domains.length === 0) return []

  const queryEmbedding = await embedText(query)
  if (!queryEmbedding) {
    return knowledge.domains.slice(0, topK).map(d => ({ domain: d, sim: 0 }))
  }

  // Use cached centroid embeddings — no re-embedding needed
  const scored: ScoredDomain[] = knowledge.domains.map(domain => {
    if (domain.embedding && domain.embedding.length > 0) {
      return { domain, sim: cosineSimilarity(queryEmbedding, domain.embedding) }
    }
    return { domain, sim: 0 }
  })

  scored.sort((a, b) => b.sim - a.sim)
  return scored.slice(0, topK)
}

/**
 * Given matched domain summaries, compute the recommended RAG chunk count.
 * High domain match quality → fewer RAG chunks needed (and vice versa).
 */
export function adaptiveRagBudget(domainScores: ScoredDomain[]): number {
  if (domainScores.length === 0) return 15  // no compressed data, use original budget
  const avgSim = domainScores.reduce((s, d) => s + d.sim, 0) / domainScores.length
  // avgSim ~0.3 → weak match → 12 chunks; avgSim ~0.7+ → strong match → 5 chunks
  if (avgSim >= 0.6) return 5
  if (avgSim >= 0.45) return 8
  return 12
}

/**
 * Filter RAG results that substantially overlap with matched domain summaries.
 * Uses embedding similarity between each RAG chunk and domain centroids.
 */
export async function deduplicateRagAgainstDomains(
  ragTexts: string[],
  matchedDomains: ScoredDomain[],
  threshold: number = 0.78
): Promise<boolean[]> {
  // If no domain embeddings, keep all RAG results
  const domainEmbeddings = matchedDomains
    .map(sd => sd.domain.embedding)
    .filter((e): e is number[] => !!e && e.length > 0)

  if (domainEmbeddings.length === 0) return ragTexts.map(() => true)

  const ragEmbeddings = await embedBatch(ragTexts)

  return ragEmbeddings.map(ragEmb => {
    if (!ragEmb) return true // keep if embedding failed
    for (const domEmb of domainEmbeddings) {
      if (cosineSimilarity(ragEmb, domEmb) >= threshold) return false // redundant
    }
    return true // keep
  })
}
