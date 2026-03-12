import https from 'https'

interface SearchResult {
  title: string
  url: string
  snippet: string
}

interface SearchWithContent extends SearchResult {
  content: string
}

/**
 * Search DuckDuckGo HTML lite and parse results. No API key needed.
 */
export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, kl: '', kp: '-1' })
  const html = await fetchText(`https://html.duckduckgo.com/html/?${params}`)

  const results: SearchResult[] = []
  // Match result blocks: <a class="result__a" href="...">title</a> and <a class="result__snippet">snippet</a>
  const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g
  const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g

  let linkMatch: RegExpExecArray | null
  const links: { url: string; title: string }[] = []
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    let url = linkMatch[1]
    // DDG wraps URLs in a redirect — extract the actual URL
    const uddg = url.match(/uddg=([^&]+)/)
    if (uddg) url = decodeURIComponent(uddg[1])
    const title = stripTags(linkMatch[2]).trim()
    if (url.startsWith('http') && title) links.push({ url, title })
  }

  const snippets: string[] = []
  let snippetMatch: RegExpExecArray | null
  while ((snippetMatch = snippetRegex.exec(html)) !== null) {
    snippets.push(stripTags(snippetMatch[1]).trim())
  }

  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || ''
    })
  }

  return results
}

/**
 * Fetch a page and extract readable text content.
 */
export async function fetchPageContent(url: string, maxChars = 4000): Promise<string> {
  try {
    const html = await fetchText(url, 10000)
    // Remove script, style, nav, header, footer tags and their content
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')

    // Try to extract main/article content first
    const mainMatch = text.match(/<(?:main|article)[\s\S]*?>([\s\S]*?)<\/(?:main|article)>/i)
    if (mainMatch) text = mainMatch[1]

    // Strip remaining tags, decode entities, collapse whitespace
    text = stripTags(text)
    text = decodeEntities(text)
    text = text.replace(/\s+/g, ' ').trim()

    return text.slice(0, maxChars)
  } catch {
    return ''
  }
}

/**
 * Search + fetch top results. Returns structured context for LLM injection.
 */
export async function searchAndGather(query: string, maxResults = 3): Promise<string> {
  const results = await searchWeb(query, maxResults + 2) // fetch extra in case some fail
  if (results.length === 0) return `No search results found for: ${query}`

  // Fetch page content in parallel (with short timeout)
  const withContent: SearchWithContent[] = []
  const fetches = results.slice(0, maxResults + 2).map(async (r) => {
    const content = await fetchPageContent(r.url)
    return { ...r, content }
  })

  const settled = await Promise.allSettled(fetches)
  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value.content) {
      withContent.push(s.value)
      if (withContent.length >= maxResults) break
    }
  }

  // If no pages fetched, use snippets only
  if (withContent.length === 0) {
    const snippetContext = results.slice(0, maxResults).map((r, i) =>
      `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`
    ).join('\n\n')
    return `Web search results for "${query}" (snippets only):\n\n${snippetContext}`
  }

  const contextParts = withContent.map((r, i) =>
    `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`
  )

  return `Web search results for "${query}":\n\n${contextParts.join('\n\n---\n\n')}`
}

// --- Helpers ---

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function fetchText(url: string, timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http')
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    }, (res: any) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href
        fetchText(redirectUrl, timeout).then(resolve).catch(reject)
        return
      }

      if (res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }

      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Fetch timeout')) })
  })
}
