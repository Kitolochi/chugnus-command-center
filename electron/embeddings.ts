import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// Types for the transformers pipeline
interface EmbeddingResult {
  data: Float32Array
}

type Pipeline = (texts: string | string[], options?: { pooling: string; normalize: boolean }) => Promise<EmbeddingResult>

// Module state
let pipeline: Pipeline | null = null
let loadingPromise: Promise<void> | null = null
let status: EmbeddingStatus = { ready: false, loading: false, error: null, progress: 0 }

export interface EmbeddingStatus {
  ready: boolean
  loading: boolean
  error: string | null
  progress: number // 0-100
}

export function getEmbeddingStatus(): EmbeddingStatus {
  return { ...status }
}

export async function initEmbeddingModel(onProgress?: (progress: number) => void): Promise<void> {
  if (status.ready || loadingPromise) return loadingPromise || Promise.resolve()

  loadingPromise = (async () => {
    status = { ready: false, loading: true, error: null, progress: 0 }

    try {
      // Set cache directory for model downloads
      const cacheDir = path.join(app.getPath('userData'), 'models')
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })
      process.env.TRANSFORMERS_CACHE = cacheDir

      // Dynamic import to allow graceful failure
      const { pipeline: createPipeline } = await import('@xenova/transformers') as any

      status.progress = 10
      onProgress?.(10)

      // Load the model — this downloads on first run (~22MB)
      pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        cache_dir: cacheDir,
        progress_callback: (info: any) => {
          if (info.status === 'progress' && info.progress) {
            // Scale download progress to 10-90 range
            const p = Math.round(10 + (info.progress * 0.8))
            status.progress = p
            onProgress?.(p)
          }
        }
      })

      status = { ready: true, loading: false, error: null, progress: 100 }
      onProgress?.(100)
      console.log('Embedding model ready (all-MiniLM-L6-v2)')
    } catch (err: any) {
      const msg = err?.message || 'Failed to load embedding model'
      console.error('Embedding model failed to load:', msg)
      status = { ready: false, loading: false, error: msg, progress: 0 }
      pipeline = null
    }
  })()

  return loadingPromise
}

export async function embedText(text: string): Promise<Float32Array | null> {
  if (!pipeline) return null
  try {
    const result = await pipeline(text, { pooling: 'mean', normalize: true })
    return new Float32Array(result.data)
  } catch (err) {
    console.error('Embedding failed:', err)
    return null
  }
}

export async function embedBatch(texts: string[]): Promise<(Float32Array | null)[]> {
  if (!pipeline) return texts.map(() => null)
  const results: (Float32Array | null)[] = []
  // Process in small batches to avoid memory pressure
  const BATCH_SIZE = 16
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    for (const text of batch) {
      results.push(await embedText(text))
    }
  }
  return results
}

export function cosineSimilarity(a: Float32Array | number[], b: Float32Array | number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
