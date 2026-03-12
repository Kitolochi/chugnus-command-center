import { getChatConversation, getChatConversations, getDailyNote, getRecentNotes, getAllMemories, createMemory, getMemoryTopics, getMemorySettings } from './database'
import { getCliSessions, getCliSessionMessages } from './cli-logs'
import { callLLM, isLLMConfigured } from './llm'

interface ExtractedMemory {
  title: string
  content: string
  topics: string[]
  importance: 1 | 2 | 3
}

export async function extractMemories(
  sourceType: 'chat' | 'cli_session' | 'journal' | 'task' | 'ai_task' | 'manual',
  sourceId: string | null,
  content: string,
  existingTopics: string[]
): Promise<ExtractedMemory[]> {
  const topicHint = existingTopics.length > 0
    ? `\nExisting topics you should try to reuse when relevant: ${existingTopics.join(', ')}`
    : ''

  const prompt = `You are a memory extraction system. Analyze the following content and extract 1-5 key memories worth remembering.

Each memory should capture a distinct piece of knowledge, decision, preference, or insight that would be useful to recall in future conversations.

${topicHint}

Content (from ${sourceType}):
${content.slice(0, 4000)}

Return ONLY valid JSON (no markdown, no explanation) as an array:
[
  {
    "title": "short descriptive title (5-10 words)",
    "content": "detailed memory content (1-3 sentences)",
    "topics": ["topic1", "topic2"],
    "importance": 1-3 (1=low/minor detail, 2=normal/useful, 3=high/critical knowledge)
  }
]

Rules:
- Extract only genuinely useful knowledge, not generic observations
- Topics should be lowercase, single words or short phrases
- Each memory should be self-contained and understandable out of context
- Prefer reusing existing topics when they fit
- If the content doesn't contain anything worth remembering, return an empty array []`

  const response = await callLLM({ prompt, tier: 'fast', maxTokens: 1024 })
  try {
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((m: any) =>
      m.title && m.content && Array.isArray(m.topics) && [1, 2, 3].includes(m.importance)
    ).slice(0, 5)
  } catch {
    return []
  }
}

export function isDuplicateMemory(
  newMem: ExtractedMemory,
  existing: { title: string; content: string; topics: string[] }[]
): boolean {
  const newTitle = newMem.title.toLowerCase()
  const newTopics = new Set(newMem.topics.map(t => t.toLowerCase()))

  for (const mem of existing) {
    const existTitle = mem.title.toLowerCase()
    // Check title similarity
    if (existTitle === newTitle) return true
    // Check if titles share 80%+ words
    const newWords = new Set(newTitle.split(/\s+/))
    const existWords = existTitle.split(/\s+/)
    const overlap = existWords.filter(w => newWords.has(w)).length
    if (overlap / Math.max(newWords.size, existWords.length) > 0.8) return true
    // Check topic + content similarity
    const existTopics = new Set(mem.topics.map(t => t.toLowerCase()))
    const topicOverlap = [...newTopics].filter(t => existTopics.has(t)).length
    if (topicOverlap >= 2 && newMem.content.toLowerCase().includes(mem.content.toLowerCase().slice(0, 50))) return true
  }
  return false
}

export async function extractMemoriesFromChat(conversationId: string): Promise<any[]> {
  if (!isLLMConfigured()) return []

  const conv = getChatConversation(conversationId)
  if (!conv || conv.messages.length < 2) return []

  const content = conv.messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
  const existingTopics = getMemoryTopics().map(t => t.name)
  const allMemories = getAllMemories()

  const extracted = await extractMemories('chat', conversationId, content, existingTopics)
  const created: any[] = []

  for (const mem of extracted) {
    if (!isDuplicateMemory(mem, allMemories)) {
      const preview = conv.messages[0]?.content.slice(0, 100) || ''
      const newMem = createMemory({
        title: mem.title,
        content: mem.content,
        topics: mem.topics,
        sourceType: 'chat',
        sourceId: conversationId,
        sourcePreview: preview,
        importance: mem.importance,
        isPinned: false,
        isArchived: false,
        relatedMemoryIds: [],
      })
      created.push(newMem)
      allMemories.push(newMem)
    }
  }

  return created
}

export async function extractMemoriesFromCli(sessionId: string): Promise<any[]> {
  if (!isLLMConfigured()) return []

  try {
    const { messages } = await getCliSessionMessages(sessionId, 0, 50)
    if (messages.length < 2) return []

    const content = messages.map(m => `${m.type}: ${m.content.slice(0, 500)}`).join('\n\n')
    const existingTopics = getMemoryTopics().map(t => t.name)
    const allMemories = getAllMemories()

    const extracted = await extractMemories('cli_session', sessionId, content, existingTopics)
    const created: any[] = []

    for (const mem of extracted) {
      if (!isDuplicateMemory(mem, allMemories)) {
        const preview = messages[0]?.content.slice(0, 100) || ''
        const newMem = createMemory({
          title: mem.title,
          content: mem.content,
          topics: mem.topics,
          sourceType: 'cli_session',
          sourceId: sessionId,
          sourcePreview: preview,
          importance: mem.importance,
          isPinned: false,
          isArchived: false,
          relatedMemoryIds: [],
        })
        created.push(newMem)
        allMemories.push(newMem)
      }
    }

    return created
  } catch {
    return []
  }
}

export async function extractMemoriesFromJournal(date: string): Promise<any[]> {
  if (!isLLMConfigured()) return []

  const note = getDailyNote(date)
  if (!note || note.content.length < 20) return []

  const existingTopics = getMemoryTopics().map(t => t.name)
  const allMemories = getAllMemories()

  const extracted = await extractMemories('journal', date, note.content, existingTopics)
  const created: any[] = []

  for (const mem of extracted) {
    if (!isDuplicateMemory(mem, allMemories)) {
      const newMem = createMemory({
        title: mem.title,
        content: mem.content,
        topics: mem.topics,
        sourceType: 'journal',
        sourceId: date,
        sourcePreview: note.content.slice(0, 100),
        importance: mem.importance,
        isPinned: false,
        isArchived: false,
        relatedMemoryIds: [],
      })
      created.push(newMem)
      allMemories.push(newMem)
    }
  }

  return created
}

export async function batchExtractMemories(): Promise<any[]> {
  if (!isLLMConfigured()) return []

  const allCreated: any[] = []
  const allMemories = getAllMemories()

  // Extract from recent chats (skip already-processed ones)
  const processedChatIds = new Set(allMemories.filter(m => m.sourceType === 'chat').map(m => m.sourceId))
  const conversations = getChatConversations()
  for (const conv of conversations.slice(0, 10)) {
    if (processedChatIds.has(conv.id) || conv.messages.length < 4) continue
    try {
      const created = await extractMemoriesFromChat(conv.id)
      allCreated.push(...created)
    } catch { /* continue */ }
  }

  // Extract from recent journal entries
  const processedDates = new Set(allMemories.filter(m => m.sourceType === 'journal').map(m => m.sourceId))
  const recentNotes = getRecentNotes(10)
  for (const note of recentNotes) {
    if (processedDates.has(note.date) || note.content.length < 20) continue
    try {
      const created = await extractMemoriesFromJournal(note.date)
      allCreated.push(...created)
    } catch { /* continue */ }
  }

  // Extract from recent CLI sessions
  const processedSessions = new Set(allMemories.filter(m => m.sourceType === 'cli_session').map(m => m.sourceId))
  try {
    const sessions = await getCliSessions()
    for (const session of sessions.slice(0, 5)) {
      if (processedSessions.has(session.sessionId)) continue
      try {
        const created = await extractMemoriesFromCli(session.sessionId)
        allCreated.push(...created)
      } catch { /* continue */ }
    }
  } catch { /* CLI logs may not exist */ }

  return allCreated
}

// Extract memories from agent task results (Feature 3: Feedback/Learning Loop)
export async function extractMemoriesFromAgentResult(
  content: string,
  goalId: string,
  goalTitle: string,
  goalTopics: string[]
): Promise<any[]> {
  if (!isLLMConfigured()) return []
  if (content.length < 50) return []

  const existingTopics = getMemoryTopics().map(t => t.name)
  const allTopics = [...new Set([...existingTopics, ...goalTopics.filter(Boolean)])]
  const allMemories = getAllMemories()

  const extracted = await extractMemories('ai_task', goalId, content, allTopics)
  const created: any[] = []

  for (const mem of extracted) {
    // Merge goal topics into memory topics
    const mergedTopics = [...new Set([...mem.topics, ...goalTopics.filter(Boolean).map(t => t.toLowerCase())])]
    const enrichedMem = { ...mem, topics: mergedTopics }

    if (!isDuplicateMemory(enrichedMem, allMemories)) {
      const newMem = createMemory({
        title: enrichedMem.title,
        content: enrichedMem.content,
        topics: enrichedMem.topics,
        sourceType: 'ai_task',
        sourceId: goalId,
        sourcePreview: `Goal: ${goalTitle}`,
        importance: enrichedMem.importance,
        isPinned: false,
        isArchived: false,
        relatedMemoryIds: [],
      })
      created.push(newMem)
      allMemories.push(newMem)
    }
  }

  return created
}

// Phase 3: Relevance matching for chat context injection
export function getRelevantMemories(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  maxCount?: number,
  maxTokens?: number
): { id: string; title: string; content: string; topics: string[] }[] {
  const settings = getMemorySettings()
  const limit = maxCount || settings.maxMemoriesInContext
  const tokenBudget = maxTokens || settings.tokenBudget
  const memories = getAllMemories().filter(m => !m.isArchived)

  if (memories.length === 0) return []

  // Build keyword set from user message + last 2 messages
  const recentText = [
    userMessage,
    ...conversationHistory.slice(-2).map(m => m.content)
  ].join(' ').toLowerCase()

  const keywords = recentText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .map(w => w.toLowerCase())
  const keywordSet = new Set(keywords)

  // Score each memory
  const scored = memories.map(mem => {
    let score = 0

    // Topic match (10pts per matching topic keyword)
    mem.topics.forEach(t => {
      const topicLower = t.toLowerCase()
      if (recentText.includes(topicLower)) score += 10
      if (keywordSet.has(topicLower)) score += 5
    })

    // Keyword match in title + content (1pt each)
    const memText = (mem.title + ' ' + mem.content).toLowerCase()
    keywords.forEach(kw => {
      if (memText.includes(kw)) score += 1
    })

    // Importance boost
    score += (mem.importance - 1) * 3

    // Pinned boost
    if (mem.isPinned) score += 15

    // Recency boost (memories from last 7 days get +5)
    const age = Date.now() - new Date(mem.createdAt).getTime()
    if (age < 7 * 24 * 60 * 60 * 1000) score += 5
    else if (age < 30 * 24 * 60 * 60 * 1000) score += 2

    return { mem, score }
  })

  // Sort by score, take top N within token budget
  scored.sort((a, b) => b.score - a.score)

  const result: { id: string; title: string; content: string; topics: string[] }[] = []
  let tokensUsed = 0

  for (const { mem, score } of scored) {
    if (score <= 0) break
    if (result.length >= limit) break
    // Rough token estimate: ~4 chars per token
    const estimatedTokens = Math.ceil((mem.title.length + mem.content.length + mem.topics.join(', ').length) / 4)
    if (tokensUsed + estimatedTokens > tokenBudget) continue
    result.push({
      id: mem.id,
      title: mem.title,
      content: mem.content,
      topics: mem.topics,
    })
    tokensUsed += estimatedTokens
  }

  return result
}
