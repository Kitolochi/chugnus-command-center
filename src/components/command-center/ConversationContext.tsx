import { useMemo, useState } from 'react'
import { AlignLeft, ChevronDown, Copy, ExternalLink, FileText, Globe } from 'lucide-react'
import type { CCQueueItem } from '../../store/commandCenterStore'
import { excerpt, extractResources, mergeResources, projectResources } from '../../lib/conversationContext'

export default function ConversationContext({ item }: { item: CCQueueItem }) {
  const [showSummary, setShowSummary] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const [copied, setCopied] = useState('')
  const resources = useMemo(() => projectResources(mergeResources(
    item.resources || [],
    item.filesChanged.map(value => ({ kind: 'file' as const, value, evidence: 'changed' as const })),
    extractResources(item.prompt + '\n' + (item.resultText || '')),
    ...item.fullLog.map(entry => extractResources(entry.text || entry.toolInput || '', entry.type === 'tool_use' ? 'tool' : 'mentioned')),
  ), item.projectPath), [item.resources, item.filesChanged, item.prompt, item.resultText, item.fullLog, item.projectPath])
  const files = resources.filter(r => r.kind === 'file').length
  const sites = resources.length - files
  const request = item.latestRequest || [...item.fullLog].reverse().find(m => m.type === 'user')?.text || item.prompt
  const state = item.stopped ? 'Stopped. Send a message to continue this conversation.'
    : item.status === 'errored' ? 'The turn hit an error. Review it before continuing.'
    : item.status === 'working' ? 'Working on your request. You can keep typing and queue a follow-up.'
    : 'The last turn has finished. Ready for your next message.'

  return (
    <section aria-label="Conversation context" className="mb-3 rounded-lg border border-white/[0.06] bg-surface-0/50 text-[10px]" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 px-2.5 py-2">
        <button type="button" aria-expanded={showSummary} onClick={() => setShowSummary(!showSummary)} className="flex items-center gap-1.5 text-white/60 hover:text-accent-blue" title="Explain the current conversation state">
          <AlignLeft size={12} /> Summary
        </button>
        <button type="button" aria-expanded={showResources} onClick={() => setShowResources(!showResources)} className="flex items-center gap-1.5 text-white/50 hover:text-white/90">
          <FileText size={11} /> Files & sites <span className="text-white/30">{files} files · {sites} sites</span>
          <ChevronDown size={10} className={showResources ? 'rotate-180' : ''} />
        </button>
      </div>
      {showSummary && (
        <div className="border-t border-white/[0.04] px-3 py-2.5 space-y-2 leading-relaxed" aria-label="Conversation summary">
          <p className="text-white/80">{state}</p>
          <dl className="space-y-2 text-white/60">
            {request !== item.prompt && <div><dt className="text-white/35">Started with</dt><dd>{excerpt(item.prompt, 180)}</dd></div>}
            <div><dt className="text-white/35">Latest request</dt><dd>{excerpt(request)}</dd></div>
            {item.resultText && <div><dt className="text-white/35">Latest reply (excerpt)</dt><dd>{excerpt(item.resultText, 420)}</dd></div>}
            {item.status === 'working' && item.latestActivity && <div><dt className="text-white/35">Latest activity</dt><dd className="break-words">{excerpt(item.latestActivity, 180)}</dd></div>}
            {item.errorMessage && <div><dt className="text-accent-amber">Needs attention</dt><dd>{excerpt(item.errorMessage)}</dd></div>}
            {item.pendingInput && <div><dt className="text-accent-blue">{item.queuePaused ? 'Queue paused — resume it to continue' : 'Next in queue'}</dt><dd>{excerpt(item.pendingInput)}</dd></div>}
          </dl>
          <p className="text-[9px] text-white/25">Live snapshot from this conversation. Opening it does not send a message.</p>
        </div>
      )}
      {!showResources && resources.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 pb-2">
          {resources.slice(0, 3).map(resource => <button type="button" key={resource.kind + resource.value} title={resource.value} onClick={() => setShowResources(true)} className="max-w-[200px] truncate rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/45 hover:text-white/80">{resource.kind === 'site' ? new URL(resource.value).host : resource.value.split('/').pop()}</button>)}
          {resources.length > 3 && <button type="button" onClick={() => setShowResources(true)} className="text-[9px] text-white/35">+{resources.length - 3} more</button>}
        </div>
      )}
      {showResources && (
        <div className="border-t border-white/[0.04] px-3 py-2.5">
          <p className="text-white/30 mb-2 break-all">Project: {item.projectPath}</p>
          <div className="max-h-48 overflow-y-auto space-y-1" aria-label="Conversation files and sites">
            {!resources.length && <p className="text-white/40">Files and sites will appear when referenced in messages or tool activity.</p>}
            {resources.map(resource => (
              <div key={resource.kind + resource.value} className="flex items-start gap-2 py-1">
                {resource.kind === 'site' ? <Globe size={11} className="shrink-0 mt-0.5 text-accent-blue" /> : <FileText size={11} className="shrink-0 mt-0.5 text-white/40" />}
                <span className="flex-1 min-w-0 break-all text-white/65 select-text">{resource.value}</span>
                <span className="shrink-0 text-[9px] text-white/30">{resource.evidence === 'tool' ? 'tool reference' : resource.evidence}</span>
                {resource.kind === 'site' && <button type="button" title={`Open ${resource.value}`} onClick={() => void window.electronAPI.openExternal(resource.value)} className="text-white/40 hover:text-accent-blue"><ExternalLink size={11} /></button>}
                <button type="button" title={`Copy ${resource.value}`} onClick={() => { window.electronAPI.writeClipboard(resource.value); setCopied(resource.value) }} className="text-white/40 hover:text-white/90"><Copy size={11} /></button>
              </div>
            ))}
          </div>
          {copied && <p role="status" className="text-accent-blue mt-1">Copied to clipboard</p>}
          <p className="text-[9px] text-white/25 mt-2">Observed references only; mentions do not mean a file or site was opened.</p>
        </div>
      )}
    </section>
  )
}
