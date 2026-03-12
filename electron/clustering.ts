import { cosineSimilarity } from './embeddings'

/**
 * Compute cosine distance (1 - similarity) between two embeddings.
 */
function cosineDistance(a: Float32Array, b: Float32Array): number {
  return 1 - cosineSimilarity(a, b)
}

/**
 * K-Means clustering on Float32Array embeddings using cosine distance.
 * Returns an array of cluster indices (one per embedding).
 */
export function kMeansClustering(
  embeddings: Float32Array[],
  k: number,
  maxIter = 100
): number[] {
  const n = embeddings.length
  if (n === 0) return []
  if (k <= 0 || k > n) k = Math.min(Math.max(k, 1), n)

  const dim = embeddings[0].length

  // Initialize centroids using k-means++ style: pick random distinct indices
  const centroidIndices = new Set<number>()
  while (centroidIndices.size < k) {
    centroidIndices.add(Math.floor(Math.random() * n))
  }
  const centroids: Float32Array[] = Array.from(centroidIndices).map(i =>
    new Float32Array(embeddings[i])
  )

  const assignments = new Array<number>(n).fill(0)

  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false

    // Assignment step: assign each embedding to nearest centroid
    for (let i = 0; i < n; i++) {
      let minDist = Infinity
      let minIdx = 0
      for (let c = 0; c < k; c++) {
        const dist = cosineDistance(embeddings[i], centroids[c])
        if (dist < minDist) {
          minDist = dist
          minIdx = c
        }
      }
      if (assignments[i] !== minIdx) {
        assignments[i] = minIdx
        changed = true
      }
    }

    if (!changed) break

    // Update step: recompute centroids as mean of assigned embeddings
    const sums: Float32Array[] = Array.from({ length: k }, () => new Float32Array(dim))
    const counts = new Array<number>(k).fill(0)

    for (let i = 0; i < n; i++) {
      const c = assignments[i]
      counts[c]++
      for (let d = 0; d < dim; d++) {
        sums[c][d] += embeddings[i][d]
      }
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue
      for (let d = 0; d < dim; d++) {
        centroids[c][d] = sums[c][d] / counts[c]
      }
      // Normalize centroid for cosine distance
      let norm = 0
      for (let d = 0; d < dim; d++) norm += centroids[c][d] * centroids[c][d]
      norm = Math.sqrt(norm)
      if (norm > 0) {
        for (let d = 0; d < dim; d++) centroids[c][d] /= norm
      }
    }
  }

  return assignments
}

/**
 * Compute the silhouette score for a given set of assignments.
 * Returns a value between -1 and 1; higher is better.
 */
function silhouetteScore(embeddings: Float32Array[], assignments: number[], k: number): number {
  const n = embeddings.length
  if (n <= 1 || k <= 1) return 0

  let totalScore = 0
  let validCount = 0

  for (let i = 0; i < n; i++) {
    const ci = assignments[i]
    // Compute average distance to same-cluster points (a)
    let aSum = 0
    let aCount = 0
    for (let j = 0; j < n; j++) {
      if (j === i || assignments[j] !== ci) continue
      aSum += cosineDistance(embeddings[i], embeddings[j])
      aCount++
    }
    if (aCount === 0) continue // singleton cluster
    const a = aSum / aCount

    // Compute minimum average distance to other clusters (b)
    let b = Infinity
    for (let c = 0; c < k; c++) {
      if (c === ci) continue
      let bSum = 0
      let bCount = 0
      for (let j = 0; j < n; j++) {
        if (assignments[j] !== c) continue
        bSum += cosineDistance(embeddings[i], embeddings[j])
        bCount++
      }
      if (bCount > 0) {
        b = Math.min(b, bSum / bCount)
      }
    }
    if (b === Infinity) continue

    const s = (b - a) / Math.max(a, b)
    totalScore += s
    validCount++
  }

  return validCount > 0 ? totalScore / validCount : 0
}

/**
 * Select the optimal K for clustering using silhouette scoring.
 */
export function selectOptimalK(
  embeddings: Float32Array[],
  minK = 2,
  maxK = 15
): number {
  const n = embeddings.length
  if (n <= 2) return 1
  maxK = Math.min(maxK, n - 1)
  if (minK > maxK) return minK

  let bestK = minK
  let bestScore = -Infinity

  for (let k = minK; k <= maxK; k++) {
    const assignments = kMeansClustering(embeddings, k)
    const score = silhouetteScore(embeddings, assignments, k)
    if (score > bestScore) {
      bestScore = score
      bestK = k
    }
  }

  return bestK
}

/**
 * Generate short labels for each cluster by finding the most common words
 * in the texts assigned to that cluster.
 */
export function computeClusterLabels(texts: string[], clusterIndices: number[]): string[] {
  const clusterTexts = new Map<number, string[]>()
  for (let i = 0; i < texts.length; i++) {
    const c = clusterIndices[i]
    if (!clusterTexts.has(c)) clusterTexts.set(c, [])
    clusterTexts.get(c)!.push(texts[i])
  }

  const maxCluster = Math.max(...clusterIndices, 0)
  const labels: string[] = new Array(maxCluster + 1).fill('Uncategorized')

  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'it',
    'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
    'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
    'what', 'which', 'who', 'whom', 'also', 'like', 'get', 'make', 'know',
  ])

  for (const [cluster, clTexts] of clusterTexts) {
    const wordFreq = new Map<string, number>()
    for (const text of clTexts) {
      const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      for (const w of words) {
        if (w.length < 3 || stopWords.has(w)) continue
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1)
      }
    }
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1))

    labels[cluster] = topWords.length > 0 ? topWords.join(' & ') : 'Uncategorized'
  }

  return labels
}
