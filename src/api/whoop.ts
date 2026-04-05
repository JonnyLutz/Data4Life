import {
  COGNITO_ACCESS_TOKEN_KEY,
  COGNITO_ID_TOKEN_KEY,
  refreshCognitoTokens,
} from '../auth/cognitoPkce'

async function authHeaders(): Promise<Record<string, string> | undefined> {
  await refreshCognitoTokens()
  const token =
    localStorage.getItem(COGNITO_ID_TOKEN_KEY) ??
    localStorage.getItem(COGNITO_ACCESS_TOKEN_KEY) ??
    ''
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

/** In dev, call same-origin `/aws-api/*` so Vite proxies to API Gateway (avoids browser CORS). */
function apiBaseUrl(): string {
  const direct = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  if (import.meta.env.DEV && direct) return '/aws-api'
  return direct
}

export async function fetchSleepCollection({ limit = 25 } = {}): Promise<unknown> {
  const baseUrl = apiBaseUrl()
  const headers = await authHeaders()
  const res = await fetch(`${baseUrl}/sleep?limit=${encodeURIComponent(String(limit))}`, {
    credentials: 'omit',
    headers,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }

  return await res.json()
}

export async function fetchDashboard(): Promise<unknown> {
  const baseUrl = apiBaseUrl()
  const headers = await authHeaders()
  const res = await fetch(`${baseUrl}/dashboard`, {
    credentials: 'omit',
    headers,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return await res.json()
}

export async function fetchWhoopLoginUrl(): Promise<{ url?: string }> {
  const baseUrl = apiBaseUrl()
  const headers = await authHeaders()
  const res = await fetch(`${baseUrl}/auth/login-url`, {
    credentials: 'omit',
    headers,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return (await res.json()) as { url?: string }
}

export type InsightsSummaryResponse = {
  summary: string
  source: 'bedrock' | 'heuristic'
  fetchedAt?: string
}

export async function fetchInsightsSummary(): Promise<InsightsSummaryResponse> {
  const baseUrl = apiBaseUrl()
  const headers = await authHeaders()
  const res = await fetch(`${baseUrl}/insights/summary`, {
    method: 'POST',
    credentials: 'omit',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return (await res.json()) as InsightsSummaryResponse
}
