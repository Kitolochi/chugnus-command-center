import { useState, useEffect, useCallback } from 'react'
import type { SingleFileTestResult, ContextFileInfo, CompressionProgress, CompressionAudit, FolderCompressionResult } from '../types'

type LabSection = 'compression' | 'folder' | 'embeddings' | 'audit'

export default function LabTab() {
  const [activeSection, setActiveSection] = useState<LabSection>('compression')

  const sections: { id: LabSection; label: string; icon: string }[] = [
    { id: 'compression', label: 'Single-File', icon: '🧪' },
    { id: 'folder', label: 'Folder Compression', icon: '📁' },
    { id: 'embeddings', label: 'Embedding Similarity', icon: '🔗' },
    { id: 'audit', label: 'Compression Audit', icon: '📊' },
  ]

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center text-accent-purple">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Experimental Lab</h1>
          <p className="text-xs text-muted">Test memory compression, embeddings, and system tools</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeSection === s.id
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/20'
                : 'bg-surface-2/50 text-muted hover:text-white/70 hover:bg-surface-2 border border-white/[0.06]'
            }`}
          >
            <span className="mr-1.5">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      {activeSection === 'compression' && <SingleFileCompression />}
      {activeSection === 'folder' && <FolderCompression />}
      {activeSection === 'embeddings' && <EmbeddingSimilarity />}
      {activeSection === 'audit' && <CompressionAuditPanel />}
    </div>
  )
}

// ============================================================
// Single-File Compression Test
// ============================================================

function SingleFileCompression() {
  const [files, setFiles] = useState<ContextFileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<CompressionProgress | null>(null)
  const [result, setResult] = useState<SingleFileTestResult | null>(null)
  const [filter, setFilter] = useState('')
  const [showStubs, setShowStubs] = useState(false)
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)

  useEffect(() => {
    window.electronAPI.listContextFiles().then(setFiles).catch(() => {})
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onCompressionProgress((p: CompressionProgress) => {
      setProgress(p)
    })
    return unsub
  }, [])

  const handleCompress = useCallback(async () => {
    if (!selectedFile) return
    setLoading(true)
    setResult(null)
    setProgress(null)
    try {
      const res = await window.electronAPI.compressSingleFile(selectedFile)
      setResult(res)
    } catch (err: any) {
      console.error('Compression failed:', err)
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [selectedFile])

  const filteredFiles = files.filter(f => {
    if (!showStubs && f.isStub) return false
    if (filter && !f.name.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className="space-y-4">
      {/* File picker */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Select a Context File</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={showStubs}
                onChange={e => setShowStubs(e.target.checked)}
                className="w-3 h-3 rounded accent-accent-purple"
              />
              Show stubs
            </label>
            <span className="text-[11px] text-muted">
              {filteredFiles.length} files
            </span>
          </div>
        </div>

        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter files..."
          className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-purple/30"
        />

        <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
          {filteredFiles.map(f => {
            const authColor = f.authority >= 70 ? 'text-green-400' : f.authority >= 50 ? 'text-accent-blue' : f.authority >= 35 ? 'text-amber-400' : 'text-muted/50'
            return (
              <button
                key={f.name}
                onClick={() => setSelectedFile(f.name)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all ${
                  selectedFile === f.name
                    ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/20'
                    : f.isStub
                      ? 'text-muted/50 hover:bg-surface-2/50 border border-transparent'
                      : 'text-white/70 hover:bg-surface-2/50 hover:text-white border border-transparent'
                }`}
              >
                <span className="truncate text-left">{f.name}</span>
                <span className="ml-2 shrink-0 flex items-center gap-2">
                  {!f.isStub && (
                    <span className={`font-mono text-[10px] ${authColor}`} title="Authority score">
                      {f.authority}
                    </span>
                  )}
                  <span className={f.isStub ? 'text-amber-500/50' : 'text-muted'}>
                    {formatSize(f.size)}
                    {f.isStub && ' (stub)'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCompress}
            disabled={!selectedFile || loading}
            className="px-4 py-2 rounded-lg bg-accent-purple/20 text-accent-purple text-xs font-medium border border-accent-purple/20 hover:bg-accent-purple/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Compressing...' : 'Compress Selected File'}
          </button>
          {selectedFile && !loading && (
            <span className="text-[11px] text-muted">
              {selectedFile}
            </span>
          )}
        </div>

        {/* Folder Authority Overview */}
        {(() => {
          const realFiles = files.filter(f => !f.isStub && f.authority > 0)
          const folders = new Map<string, ContextFileInfo[]>()
          for (const f of realFiles) {
            const slashIdx = f.name.indexOf('/')
            const folder = slashIdx >= 0 ? f.name.substring(0, slashIdx) : '(root)'
            if (!folders.has(folder)) folders.set(folder, [])
            folders.get(folder)!.push(f)
          }
          const multiFolders = [...folders.entries()].filter(([, items]) => items.length > 1)
          if (multiFolders.length === 0) return null
          return (
            <div className="mt-3 p-3 bg-surface-1/30 rounded-lg space-y-2">
              <div className="text-[10px] text-muted uppercase tracking-wider">Folder Authority Hierarchy</div>
              {multiFolders.map(([folder, items]) => {
                const sorted = [...items].sort((a, b) => b.authority - a.authority)
                const spread = sorted[0].authority - sorted[sorted.length - 1].authority
                return (
                  <div key={folder} className="space-y-0.5">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-white/80 font-medium">{folder}/</span>
                      {spread >= 20 && (
                        <span className="text-amber-400 text-[10px]">
                          iterative ({spread}pt spread)
                        </span>
                      )}
                    </div>
                    {sorted.map(f => {
                      const baseName = f.name.includes('/') ? f.name.split('/').pop() : f.name
                      const authColor = f.authority >= 70 ? 'bg-green-500' : f.authority >= 50 ? 'bg-accent-blue' : f.authority >= 35 ? 'bg-amber-500' : 'bg-red-500'
                      return (
                        <div key={f.name} className="flex items-center gap-2 ml-4 text-[10px]">
                          <div className={`w-1.5 h-1.5 rounded-full ${authColor}`} />
                          <div className="h-0.5 bg-surface-3 rounded-full flex-shrink-0" style={{ width: `${f.authority}%`, maxWidth: 80 }} />
                          <span className="text-white/50 truncate">{baseName}</span>
                          <span className="text-muted font-mono ml-auto">{f.authority}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
              <div className="text-[10px] text-muted/60 mt-1">
                When compressing, high-authority files override conflicting info from lower-authority files in the same folder.
              </div>
            </div>
          )
        })()}

        {/* Progress */}
        {loading && progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted">{progress.detail}</span>
              <span className="text-accent-purple">{progress.percent}%</span>
            </div>
            <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">Results: {result.fileName}</h3>
              <span className="text-[11px] text-muted">{result.durationMs}ms</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Original', value: formatSize(result.originalSize) },
                { label: 'Chunks', value: result.chunks },
                { label: 'Clusters', value: result.clusters.length },
                { label: 'Facts', value: result.totalFacts },
              ].map(s => (
                <div key={s.label} className="bg-surface-1/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-semibold text-white">{s.value}</div>
                  <div className="text-[10px] text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Overview */}
            <div className="mt-3 p-3 bg-surface-1/30 rounded-lg">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Overview</div>
              <div className="text-xs text-white/80">{result.overview}</div>
            </div>
          </div>

          {/* Side-by-side: Original vs Compressed */}
          <div className="grid grid-cols-2 gap-3">
            {/* Original */}
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-white">Original Content</h4>
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="text-[11px] text-accent-purple hover:text-accent-purple/80"
                >
                  {showOriginal ? 'Collapse' : 'Expand'}
                </button>
              </div>
              <div className={`text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto ${showOriginal ? 'max-h-[600px]' : 'max-h-48'}`}>
                {result.originalText}
              </div>
            </div>

            {/* Compressed */}
            <div className="glass-card rounded-xl p-4">
              <h4 className="text-xs font-medium text-white mb-2">Extracted Knowledge</h4>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {result.clusters.map((cluster, i) => (
                  <div key={i} className="border border-white/[0.06] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedCluster(expandedCluster === i ? null : i)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-surface-2/30 hover:bg-surface-2/50 transition-all"
                    >
                      <span className="text-xs font-medium text-accent-purple">{cluster.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted">{cluster.facts.length} facts</span>
                        <svg className={`w-3 h-3 text-muted transition-transform ${expandedCluster === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                    {expandedCluster === i && (
                      <div className="px-3 py-2 space-y-1.5">
                        <div className="text-[11px] text-white/70 italic mb-2">{cluster.summary}</div>
                        {cluster.facts.map((fact, j) => (
                          <div key={j} className="flex gap-2 text-[11px]">
                            <span className="text-accent-blue shrink-0">•</span>
                            <span className="text-white/60">{fact}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Embedding Similarity Tester
// ============================================================
// Folder Compression (Multi-File Authority-Aware)
// ============================================================

function FolderCompression() {
  const [files, setFiles] = useState<ContextFileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<CompressionProgress | null>(null)
  const [result, setResult] = useState<FolderCompressionResult | null>(null)
  const [expandedCluster, setExpandedCluster] = useState<number | null>(null)
  const [showFileBreakdown, setShowFileBreakdown] = useState(false)

  useEffect(() => {
    window.electronAPI.listContextFiles().then(setFiles).catch(() => {})
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onCompressionProgress((p: CompressionProgress) => {
      setProgress(p)
    })
    return unsub
  }, [])

  // Derive folders from file list
  const folders = (() => {
    const map = new Map<string, { files: ContextFileInfo[]; minAuth: number; maxAuth: number }>()
    for (const f of files) {
      if (f.isStub) continue
      const slashIdx = f.name.indexOf('/')
      if (slashIdx < 0) continue // skip root-level files
      const folder = f.name.substring(0, slashIdx)
      if (!map.has(folder)) map.set(folder, { files: [], minAuth: 100, maxAuth: 0 })
      const entry = map.get(folder)!
      entry.files.push(f)
      entry.minAuth = Math.min(entry.minAuth, f.authority)
      entry.maxAuth = Math.max(entry.maxAuth, f.authority)
    }
    return [...map.entries()]
      .filter(([, v]) => v.files.length >= 2)
      .sort((a, b) => b[1].files.length - a[1].files.length)
  })()

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  const handleCompress = useCallback(async () => {
    if (!selectedFolder) return
    setLoading(true)
    setResult(null)
    setProgress(null)
    try {
      const res = await window.electronAPI.compressFolder(selectedFolder)
      setResult(res)
    } catch (err: any) {
      console.error('Folder compression failed:', err)
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [selectedFolder])

  const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`

  return (
    <div className="space-y-4">
      {/* Folder picker */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Select a Folder to Compress</h3>
          <span className="text-[11px] text-muted">{folders.length} folders with 2+ files</span>
        </div>
        <p className="text-[11px] text-muted">
          Folder compression uses authority-aware dedup and conflict resolution.
          High-authority files (meta-analyses, corrections) override earlier drafts when they disagree.
        </p>

        <div className="space-y-1.5">
          {folders.map(([folder, data]) => {
            const spread = data.maxAuth - data.minAuth
            const isIterative = spread >= 20
            const totalSize = data.files.reduce((s, f) => s + f.size, 0)
            return (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all ${
                  selectedFolder === folder
                    ? 'bg-accent-purple/15 text-accent-purple border border-accent-purple/20'
                    : 'text-white/70 hover:bg-surface-2/50 hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{folder}/</span>
                  <span className="text-muted">{data.files.length} files</span>
                  {isIterative && (
                    <span className="text-amber-400 text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10">
                      iterative ({spread}pt spread)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-muted">{formatSize(totalSize)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-green-400 font-mono">{data.maxAuth}</span>
                    <span className="text-muted">-</span>
                    <span className={`font-mono ${data.minAuth <= 45 ? 'text-red-400' : 'text-muted'}`}>{data.minAuth}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Selected folder file list */}
        {selectedFolder && (() => {
          const data = folders.find(([f]) => f === selectedFolder)?.[1]
          if (!data) return null
          return (
            <div className="p-3 bg-surface-1/30 rounded-lg space-y-1">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Files in {selectedFolder}/</div>
              {data.files.sort((a, b) => b.authority - a.authority).map(f => {
                const baseName = f.name.split('/').pop()
                const authColor = f.authority >= 70 ? 'text-green-400' : f.authority >= 50 ? 'text-accent-blue' : f.authority >= 35 ? 'text-amber-400' : 'text-red-400'
                return (
                  <div key={f.name} className="flex items-center justify-between text-[11px] py-0.5">
                    <span className="text-white/60 truncate">{baseName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono ${authColor}`}>{f.authority}</span>
                      <span className="text-muted">{formatSize(f.size)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        <button
          onClick={handleCompress}
          disabled={!selectedFolder || loading}
          className="px-4 py-2 rounded-lg bg-accent-purple/20 text-accent-purple text-xs font-medium border border-accent-purple/20 hover:bg-accent-purple/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Compressing...' : `Compress ${selectedFolder || 'Folder'}`}
        </button>

        {loading && progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted">{progress.detail}</span>
              <span className="text-accent-purple">{progress.percent}%</span>
            </div>
            <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">
                Results: {result.folder}/
                {result.conflictsResolved && (
                  <span className="ml-2 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                    conflicts resolved
                  </span>
                )}
              </h3>
              <span className="text-[11px] text-muted">{(result.durationMs / 1000).toFixed(1)}s</span>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Files', value: result.fileCount },
                { label: 'Clusters', value: result.clusters.length },
                { label: 'Facts', value: result.totalFacts },
                { label: 'Deduped', value: result.dedupRemoved },
                { label: 'Ratio', value: `${result.fileCount > 0 ? (result.totalFacts / result.fileCount).toFixed(1) : 0}x` },
              ].map(s => (
                <div key={s.label} className="bg-surface-1/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-semibold text-white">{s.value}</div>
                  <div className="text-[10px] text-muted">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Overview */}
            <div className="mt-3 p-3 bg-surface-1/30 rounded-lg">
              <div className="text-[10px] text-muted uppercase tracking-wider mb-1">Overview</div>
              <div className="text-xs text-white/80">{result.overview}</div>
            </div>
          </div>

          {/* File contribution breakdown */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-white">File Contributions (after dedup)</h4>
              <button
                onClick={() => setShowFileBreakdown(!showFileBreakdown)}
                className="text-[11px] text-accent-purple hover:text-accent-purple/80"
              >
                {showFileBreakdown ? 'Collapse' : 'Show Details'}
              </button>
            </div>
            {showFileBreakdown && (
              <div className="space-y-1">
                {result.filesUsed
                  .sort((a, b) => b.chunksContributed - a.chunksContributed)
                  .map(f => {
                    const baseName = f.name.split('/').pop()
                    const authColor = f.authority >= 70 ? 'bg-green-500' : f.authority >= 50 ? 'bg-accent-blue' : f.authority >= 35 ? 'bg-amber-500' : 'bg-red-500'
                    const maxChunks = Math.max(...result.filesUsed.map(x => x.chunksContributed), 1)
                    return (
                      <div key={f.name} className="flex items-center gap-2 text-[11px] py-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${authColor} shrink-0`} />
                        <span className="text-white/60 truncate w-48">{baseName}</span>
                        <span className="text-muted font-mono w-8 text-right">{f.authority}</span>
                        <div className="flex-1 h-1.5 bg-surface-1 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-purple/60 rounded-full"
                            style={{ width: `${(f.chunksContributed / maxChunks) * 100}%` }}
                          />
                        </div>
                        <span className="text-muted font-mono w-12 text-right">
                          {f.chunksContributed} {f.chunksContributed === 0 ? '(deduped)' : 'chunks'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Clusters */}
          <div className="glass-card rounded-xl p-4">
            <h4 className="text-xs font-medium text-white mb-2">Knowledge Clusters</h4>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {result.clusters.map((cluster, i) => (
                <div key={i} className="border border-white/[0.06] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedCluster(expandedCluster === i ? null : i)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-surface-2/30 hover:bg-surface-2/50 transition-all"
                  >
                    <span className="text-xs font-medium text-accent-purple">{cluster.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted">{cluster.facts.length} facts, {cluster.memoryCount} chunks</span>
                      <svg className={`w-3 h-3 text-muted transition-transform ${expandedCluster === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expandedCluster === i && (
                    <div className="px-3 py-2 space-y-1.5">
                      <div className="text-[11px] text-white/70 italic mb-2">{cluster.summary}</div>
                      {cluster.facts.map((fact, j) => (
                        <div key={j} className="flex gap-2 text-[11px]">
                          <span className="text-accent-blue shrink-0">•</span>
                          <span className="text-white/60">{fact}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Embedding Similarity Tester
// ============================================================

function EmbeddingSimilarity() {
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [result, setResult] = useState<{ similarity: number; embeddingDim: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{ textA: string; textB: string; similarity: number }[]>([])

  const handleTest = useCallback(async () => {
    if (!textA.trim() || !textB.trim()) return
    setLoading(true)
    try {
      const res = await window.electronAPI.testEmbeddingSimilarity(textA.trim(), textB.trim())
      setResult(res)
      setHistory(prev => [{ textA: textA.trim().slice(0, 60), textB: textB.trim().slice(0, 60), similarity: res.similarity }, ...prev.slice(0, 9)])
    } catch (err: any) {
      console.error('Similarity test failed:', err)
    } finally {
      setLoading(false)
    }
  }, [textA, textB])

  const getSimColor = (sim: number) => {
    if (sim >= 0.8) return 'text-green-400'
    if (sim >= 0.6) return 'text-accent-blue'
    if (sim >= 0.4) return 'text-amber-400'
    return 'text-red-400'
  }

  const getSimLabel = (sim: number) => {
    if (sim >= 0.9) return 'Nearly identical'
    if (sim >= 0.8) return 'Very similar'
    if (sim >= 0.6) return 'Related'
    if (sim >= 0.4) return 'Somewhat related'
    if (sim >= 0.2) return 'Weakly related'
    return 'Unrelated'
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Test Embedding Similarity</h3>
        <p className="text-[11px] text-muted">
          Enter two texts to see their cosine similarity score using the all-MiniLM-L6-v2 model.
          This is the same model used for memory deduplication and compression clustering.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Text A</label>
            <textarea
              value={textA}
              onChange={e => setTextA(e.target.value)}
              placeholder="Enter first text..."
              rows={4}
              className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-blue/30 resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Text B</label>
            <textarea
              value={textB}
              onChange={e => setTextB(e.target.value)}
              placeholder="Enter second text..."
              rows={4}
              className="w-full bg-surface-1 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted/50 focus:outline-none focus:border-accent-blue/30 resize-none"
            />
          </div>
        </div>

        <button
          onClick={handleTest}
          disabled={!textA.trim() || !textB.trim() || loading}
          className="px-4 py-2 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium border border-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Computing...' : 'Compute Similarity'}
        </button>

        {/* Result */}
        {result && (
          <div className="flex items-center gap-4 p-3 bg-surface-1/30 rounded-lg">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getSimColor(result.similarity)}`}>
                {(result.similarity * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted">cosine similarity</div>
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${getSimColor(result.similarity)}`}>
                {getSimLabel(result.similarity)}
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                Embedding dimension: {result.embeddingDim}
              </div>
              <div className="mt-2 h-2 bg-surface-1 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    result.similarity >= 0.8 ? 'bg-green-500' :
                    result.similarity >= 0.6 ? 'bg-accent-blue' :
                    result.similarity >= 0.4 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${result.similarity * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted mt-0.5">
                <span>0.0 (unrelated)</span>
                <span>dedup: 0.92</span>
                <span>1.0 (identical)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h4 className="text-xs font-medium text-white mb-2">Test History</h4>
          <div className="space-y-1">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5 rounded-lg bg-surface-1/20 text-[11px]">
                <span className={`font-mono font-bold ${getSimColor(h.similarity)}`}>
                  {(h.similarity * 100).toFixed(1)}%
                </span>
                <span className="text-white/50 truncate flex-1">"{h.textA}"</span>
                <span className="text-muted shrink-0">vs</span>
                <span className="text-white/50 truncate flex-1">"{h.textB}"</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Compression Audit Panel
// ============================================================

function CompressionAuditPanel() {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<CompressionProgress | null>(null)
  const [audit, setAudit] = useState<CompressionAudit | null>(null)
  const [showUncovered, setShowUncovered] = useState(false)

  useEffect(() => {
    const unsub = window.electronAPI.onCompressionProgress((p: CompressionProgress) => {
      setProgress(p)
    })
    return unsub
  }, [])

  const handleAudit = useCallback(async () => {
    setLoading(true)
    setProgress(null)
    try {
      const res = await window.electronAPI.auditCompression()
      setAudit(res)
    } catch (err: any) {
      console.error('Audit failed:', err)
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [])

  const getCoverageColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-accent-blue'
    if (score >= 40) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">Compression Quality Audit</h3>
        <p className="text-[11px] text-muted">
          Compares your latest Knowledge Pack against all original sources to measure information coverage.
          Each original chunk is compared to all extracted facts using embedding similarity.
        </p>

        <button
          onClick={handleAudit}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-accent-blue/20 text-accent-blue text-xs font-medium border border-accent-blue/20 hover:bg-accent-blue/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Auditing...' : 'Run Audit'}
        </button>

        {loading && progress && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted">{progress.detail}</span>
              <span className="text-accent-blue">{progress.percent}%</span>
            </div>
            <div className="h-1.5 bg-surface-1 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-blue to-accent-purple rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {audit && (
        <>
          {/* Score card */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getCoverageColor(audit.coverageScore)}`}>
                  {audit.coverageScore}%
                </div>
                <div className="text-[10px] text-muted mt-0.5">coverage score</div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-1/30 rounded-lg p-2 text-center">
                    <div className="text-sm font-semibold text-green-400">{audit.coveredItems}</div>
                    <div className="text-[10px] text-muted">covered</div>
                  </div>
                  <div className="bg-surface-1/30 rounded-lg p-2 text-center">
                    <div className="text-sm font-semibold text-red-400">{audit.uncoveredItems.length}</div>
                    <div className="text-[10px] text-muted">gaps</div>
                  </div>
                  <div className="bg-surface-1/30 rounded-lg p-2 text-center">
                    <div className="text-sm font-semibold text-white">{audit.totalOriginalItems}</div>
                    <div className="text-[10px] text-muted">total</div>
                  </div>
                </div>
                <div className="h-2 bg-surface-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      audit.coverageScore >= 80 ? 'bg-green-500' :
                      audit.coverageScore >= 60 ? 'bg-accent-blue' :
                      audit.coverageScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${audit.coverageScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cluster breakdown */}
          <div className="glass-card rounded-xl p-4">
            <h4 className="text-xs font-medium text-white mb-3">Cluster Coverage</h4>
            <div className="space-y-1.5">
              {audit.clusterCoverage.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-1/20">
                  <span className="text-xs text-accent-purple font-medium flex-1 truncate">{c.label}</span>
                  <span className="text-[11px] text-muted">{c.itemCount} items</span>
                  <span className="text-[11px] text-muted">{c.factCount} facts</span>
                  <span className={`text-[11px] font-mono font-bold ${getCoverageColor(c.avgCoverage)}`}>
                    {c.avgCoverage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Uncovered items */}
          {audit.uncoveredItems.length > 0 && (
            <div className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-white">
                  Information Gaps ({audit.uncoveredItems.length})
                </h4>
                <button
                  onClick={() => setShowUncovered(!showUncovered)}
                  className="text-[11px] text-accent-purple hover:text-accent-purple/80"
                >
                  {showUncovered ? 'Collapse' : 'Show Details'}
                </button>
              </div>
              {showUncovered && (
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {audit.uncoveredItems.map((item, i) => (
                    <div key={i} className="px-3 py-2 rounded-lg bg-surface-1/20 text-[11px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted truncate">{item.source}</span>
                        <span className="text-red-400 font-mono">
                          best: {(item.bestMatchScore * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-white/50 line-clamp-2">{item.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
