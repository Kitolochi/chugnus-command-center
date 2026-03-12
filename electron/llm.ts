import https from 'https'
import http from 'http'
import { getLLMSettings, getClaudeApiKey, LLMSettings } from './database'
import { searchAndGather } from './web-search'

// --- Provider Model Registry ---

export const PROVIDER_MODELS: Record<string, { primary: { id: string; name: string }[]; fast: { id: string; name: string }[] }> = {
  claude: {
    primary: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    ],
    fast: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    ],
  },
  gemini: {
    primary: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
    fast: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ],
  },
  groq: {
    primary: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    ],
    fast: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
    ],
  },
  openrouter: {
    primary: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
      { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash' },
    ],
    fast: [
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
    ],
  },
  chatgpt: {
    primary: [
      { id: 'gpt-5.3-codex', name: 'GPT 5.3' },
      { id: 'gpt-5.2-codex', name: 'GPT 5.2' },
    ],
    fast: [
      { id: 'gpt-5.2-codex', name: 'GPT 5.2' },
    ],
  },
  claudeProxy: {
    primary: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    ],
    fast: [
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    ],
  },
}

// All models available for the chat dropdown per provider
export const PROVIDER_CHAT_MODELS: Record<string, { id: string; name: string }[]> = {
  claude: [
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash' },
    { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
  ],
  chatgpt: [
    { id: 'gpt-5.3-codex', name: 'GPT 5.3' },
    { id: 'gpt-5.2-codex', name: 'GPT 5.2' },
  ],
  claudeProxy: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  ],
}

// --- Check if LLM is configured ---

export function isLLMConfigured(): boolean {
  const settings = getLLMSettings()
  const key = getApiKeyForProvider(settings)
  return !!key
}

// --- Types ---

export interface LLMCallOptions {
  prompt?: string
  messages?: { role: string; content: string }[]
  system?: string
  maxTokens?: number
  tier?: 'primary' | 'fast' | 'chat'
  model?: string
  timeout?: number
}

export interface LLMWebSearchOptions extends LLMCallOptions {
  maxSearches?: number
}

// --- Model info helper ---

export function getCurrentModelInfo(tier: 'primary' | 'fast' | 'chat' = 'primary'): { provider: string; model: string } {
  const settings = getLLMSettings()
  const model = tier === 'fast' ? settings.fastModel : settings.primaryModel
  return { provider: settings.provider, model }
}

// --- Helpers ---

function getApiKeyForProvider(settings: LLMSettings): string {
  switch (settings.provider) {
    case 'claude': return getClaudeApiKey()
    case 'gemini': return settings.geminiApiKey
    case 'groq': return settings.groqApiKey
    case 'openrouter': return settings.openrouterApiKey
    case 'chatgpt': return 'proxy'
    case 'claudeProxy': return 'proxy'
  }
}

function resolveModel(options: LLMCallOptions, settings: LLMSettings): string {
  if (options.model) return options.model
  const tier = options.tier || 'fast'
  if (tier === 'chat') {
    // For chat tier, use the chat settings model — caller should pass it explicitly
    return settings.primaryModel
  }
  return tier === 'primary' ? settings.primaryModel : settings.fastModel
}

function buildMessages(options: LLMCallOptions): { role: string; content: string }[] {
  if (options.messages) return options.messages
  if (options.prompt) return [{ role: 'user', content: options.prompt }]
  return []
}

// --- Anthropic Adapter ---

function callAnthropic(apiKey: string, body: object, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
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
            const textParts = (parsed.content || [])
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
            resolve(textParts.join('\n\n') || '')
          }
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(payload)
    req.end()
  })
}

// --- Gemini Adapter ---

function callGemini(apiKey: string, model: string, body: object, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `API error ${res.statusCode}`))
          } else {
            const text = parsed.candidates?.[0]?.content?.parts
              ?.map((p: any) => p.text)
              .join('') || ''
            resolve(text)
          }
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(payload)
    req.end()
  })
}

// --- OpenAI-Compatible Adapter (Groq + OpenRouter) ---

function callOpenAICompat(hostname: string, path: string, apiKey: string, body: object, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname,
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
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
            resolve(parsed.choices?.[0]?.message?.content || '')
          }
        } catch { reject(new Error('Failed to parse API response')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.write(payload)
    req.end()
  })
}

// --- Local Proxy Adapter (ccproxy on localhost:8741) ---

function callLocalProxy(path: string, body: object, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8741,
      path,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `Proxy error ${res.statusCode}`))
          } else {
            const text = parsed.choices?.[0]?.message?.content || ''
            resolve(text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim())
          }
        } catch { reject(new Error('Failed to parse proxy response')) }
      })
    })
    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') reject(new Error('LLM proxy not running. Start with: ccproxy serve'))
      else reject(err)
    })
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Proxy timeout')) })
    req.write(payload)
    req.end()
  })
}

function streamLocalProxy(path: string, body: object, timeout: number, cb: StreamCallbacks): { abort: () => void } {
  const payload = JSON.stringify({ ...body as any, stream: true })
  const req = http.request({
    hostname: '127.0.0.1',
    port: 8741,
    path,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload)
    }
  }, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      let errorData = ''
      res.on('data', (chunk: Buffer) => { errorData += chunk.toString() })
      res.on('end', () => {
        let errorMsg = `Proxy error ${res.statusCode}`
        try { const parsed = JSON.parse(errorData); errorMsg = parsed.error?.message || errorMsg } catch {}
        cb.onError(errorMsg)
      })
      return
    }

    let buffer = ''
    let model = ''

    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue
          try {
            const event = JSON.parse(jsonStr)
            if (!model && event.model) model = event.model
            const text = event.choices?.[0]?.delta?.content
            if (text) cb.onData(text)
          } catch { /* skip */ }
        }
      }
    })

    res.on('end', () => {
      cb.onEnd({ model: model || 'unknown', usage: { input: 0, output: 0 } })
    })
  })

  req.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ECONNREFUSED') cb.onError('LLM proxy not running. Start with: ccproxy serve')
    else cb.onError(err.message || 'Network error')
  })
  req.setTimeout(timeout, () => { req.destroy(); cb.onError('Proxy timeout') })
  req.write(payload)
  req.end()

  return { abort: () => req.destroy() }
}

// --- Main callLLM ---

export async function callLLM(options: LLMCallOptions): Promise<string> {
  const settings = getLLMSettings()
  const apiKey = getApiKeyForProvider(settings)
  if (!apiKey) throw new Error(`No API key configured for ${settings.provider}`)

  const model = resolveModel(options, settings)
  const messages = buildMessages(options)
  const maxTokens = options.maxTokens || 4096
  const timeout = options.timeout || 60000

  switch (settings.provider) {
    case 'claude': {
      const body: any = { model, max_tokens: maxTokens, messages }
      if (options.system) body.system = options.system
      return callAnthropic(apiKey, body, timeout)
    }
    case 'gemini': {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      const body: any = {
        contents,
        generationConfig: { maxOutputTokens: maxTokens }
      }
      if (options.system) {
        body.systemInstruction = { parts: [{ text: options.system }] }
      }
      return callGemini(apiKey, model, body, timeout)
    }
    case 'groq': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return callOpenAICompat('api.groq.com', '/openai/v1/chat/completions', apiKey, body, timeout)
    }
    case 'openrouter': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return callOpenAICompat('openrouter.ai', '/api/v1/chat/completions', apiKey, body, timeout)
    }
    case 'chatgpt': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return callLocalProxy('/codex/v1/chat/completions', body, timeout)
    }
    case 'claudeProxy': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return callLocalProxy('/claude/v1/chat/completions', body, timeout)
    }
  }
}

// --- callLLMWithWebSearch (Claude-only, fallback for others) ---

export async function callLLMWithWebSearch(options: LLMWebSearchOptions): Promise<string> {
  const settings = getLLMSettings()

  if (settings.provider === 'claude') {
    const apiKey = getClaudeApiKey()
    if (!apiKey) throw new Error('No Claude API key configured')
    const model = resolveModel(options, settings)
    const messages = buildMessages(options)
    const maxTokens = options.maxTokens || 16000
    const timeout = options.timeout || 300000
    const body = {
      model,
      max_tokens: maxTokens,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: options.maxSearches || 10 }],
      messages
    }
    return callAnthropic(apiKey, body, timeout)
  }

  // Non-Claude providers: search with DuckDuckGo, inject results as context
  const messages = buildMessages(options)
  const userMsg = messages.find(m => m.role === 'user')
  if (userMsg) {
    const searchContext = await searchAndGather(userMsg.content, options.maxSearches || 3)
    userMsg.content = `${searchContext}\n\n---\n\nBased on the search results above, answer: ${userMsg.content}`
  }
  return callLLM({ ...options, messages })
}

// --- Streaming ---

interface StreamCallbacks {
  onData: (text: string) => void
  onEnd: (info: { model: string; usage: { input: number; output: number } }) => void
  onError: (error: string) => void
}

function streamAnthropic(apiKey: string, body: object, timeout: number, cb: StreamCallbacks): { abort: () => void } {
  const payload = JSON.stringify({ ...body as any, stream: true })
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
    if (res.statusCode && res.statusCode >= 400) {
      let errorData = ''
      res.on('data', (chunk: Buffer) => { errorData += chunk.toString() })
      res.on('end', () => {
        let errorMsg = `API error ${res.statusCode}`
        try { const parsed = JSON.parse(errorData); errorMsg = parsed.error?.message || errorMsg } catch {}
        cb.onError(errorMsg)
      })
      return
    }

    let buffer = ''
    let usage = { input: 0, output: 0 }
    let model = ''

    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue
          try {
            const event = JSON.parse(jsonStr)
            if (event.type === 'content_block_delta' && event.delta?.text) {
              cb.onData(event.delta.text)
            } else if (event.type === 'message_start' && event.message) {
              model = event.message.model || model
              if (event.message.usage) usage.input = event.message.usage.input_tokens || 0
            } else if (event.type === 'message_delta' && event.usage) {
              usage.output = event.usage.output_tokens || 0
            } else if (event.type === 'message_stop') {
              cb.onEnd({ model, usage })
            } else if (event.type === 'error') {
              cb.onError(event.error?.message || 'Stream error')
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    })

    res.on('end', () => {
      // If we didn't get a message_stop event, signal end anyway
    })
  })

  req.on('error', (err) => cb.onError(err.message || 'Network error'))
  req.setTimeout(timeout, () => { req.destroy(); cb.onError('Request timeout') })
  req.write(payload)
  req.end()

  return { abort: () => req.destroy() }
}

function streamGemini(apiKey: string, model: string, body: object, timeout: number, cb: StreamCallbacks): { abort: () => void } {
  const payload = JSON.stringify(body)
  const req = https.request({
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    method: 'POST',
    headers: { 'content-type': 'application/json' }
  }, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      let errorData = ''
      res.on('data', (chunk: Buffer) => { errorData += chunk.toString() })
      res.on('end', () => {
        let errorMsg = `API error ${res.statusCode}`
        try { const parsed = JSON.parse(errorData); errorMsg = parsed.error?.message || errorMsg } catch {}
        cb.onError(errorMsg)
      })
      return
    }

    let buffer = ''
    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue
          try {
            const event = JSON.parse(jsonStr)
            const text = event.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) cb.onData(text)
          } catch { /* skip */ }
        }
      }
    })

    res.on('end', () => {
      cb.onEnd({ model, usage: { input: 0, output: 0 } })
    })
  })

  req.on('error', (err) => cb.onError(err.message || 'Network error'))
  req.setTimeout(timeout, () => { req.destroy(); cb.onError('Request timeout') })
  req.write(payload)
  req.end()

  return { abort: () => req.destroy() }
}

function streamOpenAICompat(hostname: string, path: string, apiKey: string, body: object, timeout: number, cb: StreamCallbacks): { abort: () => void } {
  const payload = JSON.stringify({ ...body as any, stream: true })
  const req = https.request({
    hostname,
    path,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    }
  }, (res) => {
    if (res.statusCode && res.statusCode >= 400) {
      let errorData = ''
      res.on('data', (chunk: Buffer) => { errorData += chunk.toString() })
      res.on('end', () => {
        let errorMsg = `API error ${res.statusCode}`
        try { const parsed = JSON.parse(errorData); errorMsg = parsed.error?.message || errorMsg } catch {}
        cb.onError(errorMsg)
      })
      return
    }

    let buffer = ''
    let model = ''

    res.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (!jsonStr || jsonStr === '[DONE]') continue
          try {
            const event = JSON.parse(jsonStr)
            if (!model && event.model) model = event.model
            const text = event.choices?.[0]?.delta?.content
            if (text) cb.onData(text)
          } catch { /* skip */ }
        }
      }
    })

    res.on('end', () => {
      cb.onEnd({ model: model || 'unknown', usage: { input: 0, output: 0 } })
    })
  })

  req.on('error', (err) => cb.onError(err.message || 'Network error'))
  req.setTimeout(timeout, () => { req.destroy(); cb.onError('Request timeout') })
  req.write(payload)
  req.end()

  return { abort: () => req.destroy() }
}

// --- Main streamLLM ---

export function streamLLM(options: LLMCallOptions, callbacks: StreamCallbacks): { abort: () => void } {
  const settings = getLLMSettings()
  const apiKey = getApiKeyForProvider(settings)
  if (!apiKey) {
    callbacks.onError(`No API key configured for ${settings.provider}`)
    return { abort: () => {} }
  }

  const model = resolveModel(options, settings)
  const messages = buildMessages(options)
  const maxTokens = options.maxTokens || 4096
  const timeout = options.timeout || 120000

  switch (settings.provider) {
    case 'claude': {
      const body: any = { model, max_tokens: maxTokens, messages }
      if (options.system) body.system = options.system
      return streamAnthropic(apiKey, body, timeout, callbacks)
    }
    case 'gemini': {
      const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
      const body: any = {
        contents,
        generationConfig: { maxOutputTokens: maxTokens }
      }
      if (options.system) {
        body.systemInstruction = { parts: [{ text: options.system }] }
      }
      return streamGemini(apiKey, model, body, timeout, callbacks)
    }
    case 'groq': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return streamOpenAICompat('api.groq.com', '/openai/v1/chat/completions', apiKey, body, timeout, callbacks)
    }
    case 'openrouter': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return streamOpenAICompat('openrouter.ai', '/api/v1/chat/completions', apiKey, body, timeout, callbacks)
    }
    case 'chatgpt': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return streamLocalProxy('/codex/v1/chat/completions', body, timeout, callbacks)
    }
    case 'claudeProxy': {
      const msgs = options.system
        ? [{ role: 'system', content: options.system }, ...messages]
        : messages
      const body = { model, max_tokens: maxTokens, messages: msgs }
      return streamLocalProxy('/claude/v1/chat/completions', body, timeout, callbacks)
    }
  }
}

// --- Verify API Key ---

export async function verifyLLMKey(provider: string, key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'claude': {
        const body = { model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Say ok' }] }
        await callAnthropic(key, body, 15000)
        return { valid: true }
      }
      case 'gemini': {
        const body = { contents: [{ role: 'user', parts: [{ text: 'Say ok' }] }], generationConfig: { maxOutputTokens: 10 } }
        await callGemini(key, 'gemini-2.5-flash', body, 15000)
        return { valid: true }
      }
      case 'groq': {
        const body = { model: 'llama-3.1-8b-instant', max_tokens: 10, messages: [{ role: 'user', content: 'Say ok' }] }
        await callOpenAICompat('api.groq.com', '/openai/v1/chat/completions', key, body, 15000)
        return { valid: true }
      }
      case 'openrouter': {
        const body = { model: 'meta-llama/llama-3.1-8b-instruct', max_tokens: 10, messages: [{ role: 'user', content: 'Say ok' }] }
        await callOpenAICompat('openrouter.ai', '/api/v1/chat/completions', key, body, 15000)
        return { valid: true }
      }
      case 'chatgpt': {
        const body = { model: 'gpt-5.3-codex', max_tokens: 10, messages: [{ role: 'user', content: 'Say ok' }] }
        await callLocalProxy('/codex/v1/chat/completions', body, 15000)
        return { valid: true }
      }
      case 'claudeProxy': {
        const body = { model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'Say ok' }] }
        await callLocalProxy('/claude/v1/chat/completions', body, 15000)
        return { valid: true }
      }
      default:
        return { valid: false, error: `Unknown provider: ${provider}` }
    }
  } catch (err: any) {
    return { valid: false, error: err.message || 'Verification failed' }
  }
}
