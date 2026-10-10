// A few plain words on what an agent is doing, for the agent sidebar. Shared by the renderer and the main process.

const MAX = 90

const clip = (text: string) => (text.length > MAX ? `${text.slice(0, MAX - 1).trimEnd()}…` : text)
const baseName = (filePath: string) => filePath.split(/[\\/]/).pop() || filePath

/** Turns one tool call into a short phrase: "Editing LiveView.tsx", "Searching the web". */
export function describeTool(name: string, input: unknown): string {
  const args = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (key: string) => (typeof args[key] === 'string' ? (args[key] as string).trim() : '')
  const description = str('description')
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return clip(description || 'Running a command')
    case 'Read':
      return str('file_path') ? clip(`Reading ${baseName(str('file_path'))}`) : 'Reading a file'
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return str('file_path') ? clip(`Editing ${baseName(str('file_path'))}`) : 'Editing a file'
    case 'Grep':
    case 'Glob':
      return 'Searching files'
    case 'WebSearch':
      return str('query') ? clip(`Searching the web for ${str('query')}`) : 'Searching the web'
    case 'WebFetch':
      return 'Reading a web page'
    case 'Agent':
    case 'Task':
      return description ? clip(`Helper agent: ${description}`) : 'Running a helper agent'
    case 'TodoWrite':
      return 'Updating its plan'
    case 'Skill':
      return str('skill') ? clip(`Using the ${str('skill')} skill`) : 'Using a skill'
    case 'ScheduleWakeup':
    case 'Monitor':
      return 'Waiting on a background job'
    case 'AskUserQuestion':
      return 'Asking you a question'
    case 'Workflow':
      return 'Running a multi-agent workflow'
  }
  if (/^mcp__(chrome-devtools|claude-in-chrome|plugin_playwright)/.test(name)) return 'Using the browser'
  if (name.startsWith('mcp__supabase__')) return 'Querying the database'
  if (name.startsWith('mcp__blender__')) return 'Working in Blender'
  if (name.startsWith('mcp__')) return `Using ${name.split('__')[1]}`
  return clip(description || name)
}

/** The first sentence of a reply, without markdown. */
export function firstSentence(text: string): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>|]/g, '')
    .replace(/^\s*(?:[-+]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
  const match = plain.match(/^.+?[.!?](?=\s|$)/)
  return clip(match ? match[0] : plain)
}

/** Reads a queue item's "Name: {json}" activity line back into a short phrase. */
export function describeActivityLine(line: string): string {
  const split = line.indexOf(': ')
  // Codex activity is already plain text, not a tool name plus JSON input.
  if (split < 0 || line[split + 2] !== '{') return clip(line)
  const name = line.slice(0, split)
  let input: unknown = {}
  try {
    input = JSON.parse(line.slice(split + 2))
  } catch {
    /* the JSON was cut short; describe by tool name only */
  }
  return describeTool(name, input)
}
