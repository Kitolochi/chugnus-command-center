import crypto from 'crypto'
import http from 'http'
import https from 'https'
import { shell } from 'electron'

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const AUTH_URL = 'https://auth.openai.com/oauth/authorize'
const TOKEN_URL = 'https://auth.openai.com/oauth/token'
const SCOPES = 'openid profile email offline_access'
const TIMEOUT_MS = 5 * 60 * 1000

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePKCE() {
  const verifier = base64url(crypto.randomBytes(64))
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function decodeJWTPayload(token: string): Record<string, any> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8')
  return JSON.parse(payload)
}

function postJSON(url: string, body: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString()
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => (raw += chunk))
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Token request failed (${res.statusCode}): ${raw}`))
          } else {
            resolve(JSON.parse(raw))
          }
        })
      },
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

interface OAuthResult {
  tokens: {
    access_token: string
    refresh_token: string
    id_token: string
    expires_in: number
  }
  profile: {
    sub: string
    name: string
    email: string
  }
}

export function startChatGPTOAuth(): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    const { verifier, challenge } = generatePKCE()
    const state = base64url(crypto.randomBytes(32))

    const server = http.createServer()
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('OAuth timed out after 5 minutes'))
    }, TIMEOUT_MS)

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port
      const redirectUri = `http://localhost:${port}/auth/callback`

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        scope: SCOPES,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        id_token_add_organizations: 'true',
        codex_cli_simplified_flow: 'true',
      })

      shell.openExternal(`${AUTH_URL}?${params.toString()}`)

      server.on('request', async (req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${port}`)

        if (url.pathname !== '/auth/callback') {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const error = url.searchParams.get('error')
        if (error) {
          const desc = url.searchParams.get('error_description') || error
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Sign-in failed</h2><p>You can close this tab.</p></body></html>')
          clearTimeout(timer)
          server.close()
          reject(new Error(`OAuth error: ${desc}`))
          return
        }

        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')

        if (returnedState !== state) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>State mismatch</h2><p>You can close this tab.</p></body></html>')
          clearTimeout(timer)
          server.close()
          reject(new Error('OAuth state mismatch'))
          return
        }

        try {
          const tokens = await postJSON(TOKEN_URL, {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            code: code!,
            redirect_uri: redirectUri,
            code_verifier: verifier,
          })

          const profile = decodeJWTPayload(tokens.id_token)

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Signed in!</h2><p>You can close this tab and return to Chugnus Command Center.</p></body></html>')
          clearTimeout(timer)
          server.close()

          resolve({
            tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              id_token: tokens.id_token,
              expires_in: tokens.expires_in,
            },
            profile: {
              sub: profile.sub || '',
              name: profile.name || profile.email || 'ChatGPT User',
              email: profile.email || '',
            },
          })
        } catch (err: any) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Token exchange failed</h2><p>You can close this tab.</p></body></html>')
          clearTimeout(timer)
          server.close()
          reject(err)
        }
      })
    })

    server.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export function refreshChatGPTTokens(refreshToken: string): Promise<{
  access_token: string
  refresh_token: string
  id_token: string
  expires_in: number
}> {
  return postJSON(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  })
}
