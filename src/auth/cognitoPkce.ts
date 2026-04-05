import { decodeJwtPayload, isTokenValid } from '../lib/jwt'

export const COGNITO_ID_TOKEN_KEY = 'data4life_id_token'
export const COGNITO_ACCESS_TOKEN_KEY = 'data4life_access_token'
export const COGNITO_REFRESH_TOKEN_KEY = 'data4life_refresh_token'
const PKCE_VERIFIER_KEY = 'data4life_pkce_verifier'

export type CognitoEnv = {
  domain: string
  region: string
  clientId: string
  redirectPath: string
}

/** Accept either `my-prefix` or pasted host `my-prefix.auth.us-east-1.amazoncognito.com`. */
function normalizeCognitoDomainPrefix(raw: string): string {
  let s = raw.trim().replace(/^https?:\/\//i, '')
  const authIdx = s.indexOf('.auth.')
  if (authIdx > 0) return s.slice(0, authIdx)
  return s.replace(/\.amazoncognito\.com.*$/i, '')
}

export function readCognitoEnv(): CognitoEnv | null {
  const rawDomain = import.meta.env.VITE_COGNITO_DOMAIN?.trim()
  const domain = rawDomain ? normalizeCognitoDomainPrefix(rawDomain) : ''
  const region = import.meta.env.VITE_COGNITO_REGION?.trim()
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim()
  const redirectPath = import.meta.env.VITE_COGNITO_REDIRECT_PATH?.trim() || '/'
  if (!domain || !region || !clientId) return null
  return { domain, region, clientId, redirectPath }
}

function redirectUri(): string {
  const env = readCognitoEnv()
  if (!env) throw new Error('Missing VITE_COGNITO_DOMAIN, VITE_COGNITO_REGION, or VITE_COGNITO_CLIENT_ID')
  const p = env.redirectPath.startsWith('/') ? env.redirectPath : `/${env.redirectPath}`
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  let out = `${origin}${p === '/' ? '/' : p}`
  if (!out.endsWith('/')) out += '/'
  return out
}

function authorizeBase(env: CognitoEnv): string {
  return `https://${env.domain}.auth.${env.region}.amazoncognito.com/oauth2/authorize`
}

function tokenEndpoint(env: CognitoEnv): string {
  return `https://${env.domain}.auth.${env.region}.amazoncognito.com/oauth2/token`
}

function randomVerifier(): string {
  const a = new Uint8Array(32)
  crypto.getRandomValues(a)
  let s = ''
  for (const b of a) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Base64Url(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const bytes = new Uint8Array(hash)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Start Hosted UI with authorization code + PKCE (no implicit grant). */
export async function getCognitoPkceLoginUrl(): Promise<string> {
  const env = readCognitoEnv()
  if (!env) throw new Error('Configure Cognito env vars (see .env.example)')
  const verifier = randomVerifier()
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  const challenge = await sha256Base64Url(verifier)
  const u = new URL(authorizeBase(env))
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', env.clientId)
  u.searchParams.set('redirect_uri', redirectUri())
  u.searchParams.set('scope', 'openid email profile')
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('code_challenge', challenge)
  return u.toString()
}

function parseTokenResponse(text: string): {
  id_token?: string
  access_token?: string
  refresh_token?: string
} {
  return JSON.parse(text) as {
    id_token?: string
    access_token?: string
    refresh_token?: string
  }
}

export function persistTokens(tokens: {
  id_token?: string
  access_token?: string
  refresh_token?: string
}): void {
  if (tokens.id_token) localStorage.setItem(COGNITO_ID_TOKEN_KEY, tokens.id_token)
  if (tokens.access_token) localStorage.setItem(COGNITO_ACCESS_TOKEN_KEY, tokens.access_token)
  if (tokens.refresh_token) localStorage.setItem(COGNITO_REFRESH_TOKEN_KEY, tokens.refresh_token)
}

export function clearTokens(): void {
  localStorage.removeItem(COGNITO_ID_TOKEN_KEY)
  localStorage.removeItem(COGNITO_ACCESS_TOKEN_KEY)
  localStorage.removeItem(COGNITO_REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
}

export function getStoredIdToken(): string {
  return (
    localStorage.getItem(COGNITO_ID_TOKEN_KEY) ?? localStorage.getItem(COGNITO_ACCESS_TOKEN_KEY) ?? ''
  )
}

/** Exchange ?code= for tokens; strip query on success. */
export async function consumeCognitoPkceRedirect(): Promise<
  { ok: true } | { ok: false; error: string; errorDescription?: string }
> {
  if (typeof window === 'undefined') return { ok: true }
  const env = readCognitoEnv()
  const params = new URLSearchParams(window.location.search)
  const err = params.get('error')
  if (err) {
    const desc = params.get('error_description') ?? ''
    window.history.replaceState(null, '', window.location.pathname)
    return { ok: false, error: err, errorDescription: decodeURIComponent(desc.replace(/\+/g, ' ')) }
  }
  const code = params.get('code')
  if (!code) return { ok: true }

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  if (!verifier) {
    window.history.replaceState(null, '', window.location.pathname)
    return { ok: false, error: 'missing_verifier', errorDescription: 'PKCE verifier missing — try Sign in again' }
  }
  if (!env) {
    window.history.replaceState(null, '', window.location.pathname)
    return { ok: false, error: 'config', errorDescription: 'Cognito env not configured' }
  }

  // Strip ?code= before the async token call. React 18 Strict Mode mounts twice in dev; a
  // second exchange with the same code returns invalid_grant (code is one-time use).
  const pathOnly = window.location.pathname
  window.history.replaceState(null, '', pathOnly)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.clientId,
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  })

  const res = await fetch(tokenEndpoint(env), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await res.text()
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)

  if (!res.ok) {
    let detail = text.slice(0, 500) || `HTTP ${res.status}`
    try {
      const j = JSON.parse(text) as { error?: string; error_description?: string }
      if (typeof j.error_description === 'string' && j.error_description) {
        detail = j.error_description
      } else if (typeof j.error === 'string' && j.error) {
        detail = j.error
      }
    } catch {
      /* keep raw */
    }
    return {
      ok: false,
      error: 'token_exchange',
      errorDescription: detail,
    }
  }
  try {
    persistTokens(parseTokenResponse(text))
    return { ok: true }
  } catch {
    return { ok: false, error: 'parse', errorDescription: 'Invalid token response' }
  }
}

/** Refresh Cognito tokens when the id token is near expiry. */
export async function refreshCognitoTokens(): Promise<void> {
  const env = readCognitoEnv()
  if (!env) return
  const id = localStorage.getItem(COGNITO_ID_TOKEN_KEY) ?? ''
  const refresh = localStorage.getItem(COGNITO_REFRESH_TOKEN_KEY) ?? ''
  if (!refresh) return
  if (id && isTokenValid(id)) {
    const exp = decodeJwtPayload(id)?.exp
    if (typeof exp === 'number' && Date.now() < exp * 1000 - 120_000) return
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.clientId,
    refresh_token: refresh,
  })

  const res = await fetch(tokenEndpoint(env), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const text = await res.text()
  if (!res.ok) return
  try {
    const tokens = parseTokenResponse(text)
    const prevRefresh = localStorage.getItem(COGNITO_REFRESH_TOKEN_KEY)
    persistTokens(tokens)
    if (!tokens.refresh_token && prevRefresh) {
      localStorage.setItem(COGNITO_REFRESH_TOKEN_KEY, prevRefresh)
    }
  } catch {
    /* ignore */
  }
}
