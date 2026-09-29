export interface ConversationResource {
  kind: 'file' | 'site'
  value: string
  evidence: 'mentioned' | 'tool' | 'changed' | 'attached'
}

export interface ConversationContext {
  resources?: ConversationResource[]
  latestRequest?: string
  latestActivity?: string
  stopped?: boolean
  queuePaused?: boolean
}

const rank = { mentioned: 0, tool: 1, attached: 2, changed: 3 }

export function mergeResources(...groups: ConversationResource[][]): ConversationResource[] {
  const found = new Map<string, ConversationResource>()
  for (const resource of groups.flat()) {
    let value = resource.value.trim()
    if (!value || value.length > 4096) continue
    if (resource.kind === 'site') {
      try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) continue
        value = url.href
      } catch { continue }
    } else {
      value = value.replace(/\\/g, '/')
      value = value.replace(/^\.\//, '')
    }
    const key = resource.kind + ':' + (/^[a-z]:\//i.test(value) ? value.toLowerCase() : value)
    const previous = found.get(key)
    if (!previous || rank[resource.evidence] > rank[previous.evidence]) found.set(key, { ...resource, value })
  }
  return [...found.values()]
}

export function projectResources(resources: ConversationResource[], projectPath: string): ConversationResource[] {
  return mergeResources(resources.map(resource => {
    if (resource.kind !== 'file') return resource
    let value = resource.value.replace(/\\/g, '/')
    if (!/^(?:[a-z]:\/|\/)/i.test(value)) value = projectPath.replace(/\\/g, '/').replace(/\/$/, '') + '/' + value
    const parts: string[] = []
    for (const part of value.split('/')) {
      if (part === '.') continue
      if (part === '..' && parts.length > 1) parts.pop()
      else parts.push(part)
    }
    return { ...resource, value: parts.join('/') }
  }))
}

/** Only records visible references; a mention is not evidence that a resource was opened. */
export function extractResources(text: string, evidence: ConversationResource['evidence'] = 'mentioned'): ConversationResource[] {
  const resources: ConversationResource[] = []
  const add = (kind: ConversationResource['kind'], value: string) => resources.push({ kind, value, evidence })
  const withoutUrls = text.replace(/https?:\/\/[^\s<>"'`]+/gi, value => {
    add('site', value.replace(/[.,;!?)\]}]+$/, ''))
    return ' '
  })
  // Quoted paths preserve spaces. Unquoted references stop at whitespace.
  const filePattern = /^(?:[a-z]:[\\/]|\.{0,2}[\\/])|^[\w@.-]+[\\/].+\.[a-z0-9]{1,12}(?::\d+)?$/i
  const fileName = /^[\w@.-]+\.(?:tsx?|jsx?|json|md|txt|py|css|html|ya?ml|toml|png|jpe?g|webp|gif|svg|pdf|csv|ps1|sh|sql|rs|go|java|c|cpp|h|env|lock)$/i
  for (const match of withoutUrls.matchAll(/[`"']([^`"'\r\n]+)[`"']/g)) {
    if (filePattern.test(match[1]) || fileName.test(match[1])) add('file', match[1].replace(/:\d+(?::\d+)?$/, ''))
  }
  const unquoted = withoutUrls.replace(/[`"'][^`"'\r\n]+[`"']/g, ' ').replace(/^[a-z]:[\\/][^\r\n]+\.[a-z0-9]{1,12}$/gim, value => {
    add('file', value)
    return ' '
  })
  for (const raw of unquoted.split(/\s+/)) {
    const value = raw.replace(/^[([]+|[.),;\]}]+$/g, '').replace(/:\d+(?::\d+)?$/, '')
    if ((filePattern.test(value) || fileName.test(value)) && !value.includes('://') && !value.startsWith('//')) add('file', value)
  }
  return mergeResources(resources)
}

export function toolResources(input: unknown): ConversationResource[] {
  const resources: ConversationResource[] = []
  const walk = (value: unknown, key = '', depth = 0) => {
    if (depth > 12) return
    if (typeof value === 'string') {
      if (/^(file_?path|path|filename)$/i.test(key) && value.trim()) resources.push({ kind: 'file', value, evidence: 'tool' })
      else resources.push(...extractResources(value, 'tool'))
    } else if (Array.isArray(value)) value.forEach(child => walk(child, key, depth + 1))
    else if (value && typeof value === 'object') Object.entries(value).forEach(([name, child]) => walk(child, name, depth + 1))
  }
  walk(input)
  return mergeResources(resources)
}

export function excerpt(text: string | undefined, limit = 300): string {
  const plain = (text || '').replace(/```[\s\S]*?```/g, ' [code] ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[#*`]/g, '').replace(/\s+/g, ' ').trim()
  if (plain.length <= limit) return plain
  const end = plain.slice(0, limit).lastIndexOf(' ')
  return plain.slice(0, end > limit * 0.7 ? end : limit) + '…'
}
