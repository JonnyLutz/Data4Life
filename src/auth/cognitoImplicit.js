export const COGNITO_ID_TOKEN_KEY = 'data4life_id_token'
export const COGNITO_ACCESS_TOKEN_KEY = 'data4life_access_token'

const DEFAULT_DOMAIN = 'data4life-infrastack'
const DEFAULT_REGION = 'us-east-1'
const DEFAULT_CLIENT_ID = '701ra0a68gajudu537coa318n8'

/**
 * Hosted UI (implicit). `redirect_uri` must match the app client callback list exactly.
 * Set `VITE_COGNITO_LOGIN_URL` to override the built URL (e.g. fixed localhost during dev).
 */
export function getCognitoImplicitLoginUrl() {
  const preset = import.meta.env.VITE_COGNITO_LOGIN_URL
  if (preset) return preset

  const domain = import.meta.env.VITE_COGNITO_DOMAIN || DEFAULT_DOMAIN
  const region = import.meta.env.VITE_COGNITO_REGION || DEFAULT_REGION
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || DEFAULT_CLIENT_ID

  const path = import.meta.env.VITE_COGNITO_REDIRECT_PATH || '/'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  let redirectUri = `${origin}${normalizedPath === '/' ? '/' : normalizedPath}`
  if (!redirectUri.endsWith('/')) redirectUri += '/'

  const u = new URL(`https://${domain}.auth.${region}.amazoncognito.com/oauth2/authorize`)
  u.searchParams.set('response_type', 'token')
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('scope', 'openid email profile')
  return u.toString()
}

/**
 * Read tokens from the URL hash after Hosted UI redirect, persist, strip the hash.
 * @returns {{ ok: true } | { ok: false, error: string, errorDescription: string } | null}
 */
export function consumeImplicitCognitoRedirect() {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash
  if (!raw || raw.length <= 1) return null

  const params = new URLSearchParams(raw.startsWith('#') ? raw.slice(1) : raw)
  const error = params.get('error')
  if (error) {
    let errorDescription = params.get('error_description') || ''
    try {
      errorDescription = decodeURIComponent(errorDescription.replace(/\+/g, ' '))
    } catch {
      /* keep raw */
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    return { ok: false, error, errorDescription }
  }

  const idToken = params.get('id_token')
  if (!idToken) return null

  window.localStorage.setItem(COGNITO_ID_TOKEN_KEY, idToken)
  const accessToken = params.get('access_token')
  if (accessToken) window.localStorage.setItem(COGNITO_ACCESS_TOKEN_KEY, accessToken)

  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return { ok: true }
}
