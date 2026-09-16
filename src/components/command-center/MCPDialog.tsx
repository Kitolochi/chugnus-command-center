import { useState, useEffect, useCallback, useRef } from 'react'
import Dialog from '../ui/Dialog'
import { Loader2, RefreshCw, ExternalLink, Trash2 } from 'lucide-react'

interface MCPServer {
  name: string
  url: string
  status: 'connected' | 'needs_auth' | 'failed' | 'unknown'
  rawLine: string
}

function parseMcpList(stdout: string): MCPServer[] {
  const servers: MCPServer[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    // Expected: "✓ name (status)   url" or "! name (status)   url" or "✗ name (status)   url"
    const match = trimmed.match(/^([✓!✗])\s+(\S+)\s+\(([^)]+)\)\s+(\S+)$/)
    if (!match) continue
    const [, symbol, name, , url] = match
    let status: MCPServer['status'] = 'unknown'
    if (symbol === '✓') status = 'connected'
    else if (symbol === '!') status = 'needs_auth'
    else if (symbol === '✗') status = 'failed'
    servers.push({ name, url, status, rawLine: trimmed })
  }
  return servers
}

function statusColor(status: MCPServer['status']): string {
  if (status === 'connected') return 'text-accent-emerald'
  if (status === 'needs_auth') return 'text-accent-amber'
  if (status === 'failed') return 'text-red-400'
  return 'text-white/50'
}

function statusSymbol(status: MCPServer['status']): string {
  if (status === 'connected') return '✓'
  if (status === 'needs_auth') return '!'
  if (status === 'failed') return '✗'
  return '?'
}

interface MCPDialogProps {
  open: boolean
  onClose: () => void
  projectPath: string
}

export default function MCPDialog({ open, onClose, projectPath }: MCPDialogProps) {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [actionRunning, setActionRunning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const cwd = projectPath || (typeof process !== 'undefined' ? process.env.USERPROFILE || '~' : '~')

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.ccExecShell({ command: 'claude mcp list', cwd })
      if (result.code !== 0 && result.stderr) {
        setError(result.stderr)
        setServers([])
      } else {
        const parsed = parseMcpList(result.stdout)
        setServers(parsed)
        setSelectedIndex(0)
      }
    } catch (err: any) {
      setError(err.message)
      setServers([])
    }
    setLoading(false)
  }, [cwd])

  useEffect(() => {
    if (open) fetchList()
  }, [open, fetchList])

  useEffect(() => {
    if (open && containerRef.current) {
      containerRef.current.focus()
    }
  }, [open])

  const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9_.-]/g, '')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (servers.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => (i + 1) % servers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => (i - 1 + servers.length) % servers.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handlePrimaryAction(servers[selectedIndex])
    }
  }

  const handlePrimaryAction = async (server: MCPServer) => {
    if (server.status === 'needs_auth') {
      window.electronAPI.openExternal(server.url)
    } else if (server.status === 'failed') {
      await fetchList()
    } else if (server.status === 'connected') {
      await handleRemove(server.name)
    }
  }

  const handleRemove = async (name: string) => {
    setActionRunning(true)
    try {
      const result = await window.electronAPI.ccExecShell({ command: `claude mcp remove ${sanitizeName(name)}`, cwd })
      if (result.code !== 0 && result.stderr) setError(result.stderr)
    } catch (err: any) {
      setError(err.message)
    }
    await fetchList()
    setActionRunning(false)
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div
        className="bg-surface-1 border border-white/[0.08] rounded-xl w-[480px] max-w-[90vw] p-5 shadow-2xl"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        ref={containerRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-white/80 font-mono">/mcp — MCP Servers</span>
          <button
            onClick={fetchList}
            disabled={loading}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2 text-white/30">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Loading...</span>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-[11px] text-red-400 font-mono whitespace-pre-wrap">{error}</p>
            </div>
            <button onClick={fetchList} className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && servers.length === 0 && (
          <p className="text-[11px] text-white/40 text-center py-6">No MCP servers configured</p>
        )}

        {!loading && !error && servers.length > 0 && (
          <div className="space-y-1">
            {servers.map((server, i) => {
              const isSelected = i === selectedIndex
              return (
                <div
                  key={server.name}
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-surface-3' : 'hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-mono text-sm font-bold shrink-0 ${statusColor(server.status)}`}>
                      {statusSymbol(server.status)}
                    </span>
                    <span className="text-[12px] text-white/80 font-mono truncate">{server.name}</span>
                    <span className="text-[10px] text-white/30 truncate hidden sm:block">{server.url}</span>
                  </div>

                  {isSelected && !actionRunning && (
                    <div className="flex items-center gap-1 shrink-0">
                      {server.status === 'needs_auth' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            window.electronAPI.openExternal(server.url)
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-accent-amber hover:bg-accent-amber/10 transition-colors"
                        >
                          <ExternalLink size={10} /> Open in Browser
                        </button>
                      )}
                      {server.status === 'failed' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            fetchList()
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/50 hover:bg-white/[0.05] transition-colors"
                        >
                          <RefreshCw size={10} /> Reconnect
                        </button>
                      )}
                      {server.status === 'connected' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemove(server.name)
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-red-400 hover:bg-red-400/10 transition-colors"
                        >
                          <Trash2 size={10} /> Remove
                        </button>
                      )}
                    </div>
                  )}

                  {isSelected && actionRunning && <Loader2 size={10} className="animate-spin text-white/30 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}

        {/* Footer hint */}
        {servers.length > 0 && (
          <p className="mt-3 text-[9px] text-white/20 font-mono">↑↓ navigate ↵ action esc close</p>
        )}
      </div>
    </Dialog>
  )
}
