import { COGNITO_ACCESS_TOKEN_KEY, COGNITO_ID_TOKEN_KEY } from '../auth/cognitoImplicit'

function authHeaders() {
  const token =
    window.localStorage.getItem(COGNITO_ID_TOKEN_KEY) ??
    window.localStorage.getItem(COGNITO_ACCESS_TOKEN_KEY) ??
    ''
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

/** In dev, call same-origin `/aws-api/*` so Vite proxies to API Gateway (avoids browser CORS). */
function apiBaseUrl() {
  const direct = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
  if (import.meta.env.DEV && direct) return '/aws-api'
  return direct
}

export async function fetchSleepCollection({ limit = 7 } = {}) {
  const baseUrl = apiBaseUrl()
  const res = await fetch(
    `${baseUrl}/sleep?limit=${encodeURIComponent(limit)}`,
    {
      credentials: 'omit',
      headers: authHeaders(),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }

  return await res.json()
}

export async function fetchDashboard() {
  const baseUrl = apiBaseUrl()
  const res = await fetch(`${baseUrl}/dashboard`, {
    credentials: 'omit',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return await res.json()
}

export async function fetchWhoopLoginUrl() {
  const baseUrl = apiBaseUrl()
  const res = await fetch(`${baseUrl}/auth/login-url`, {
    credentials: 'omit',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return await res.json()
}

