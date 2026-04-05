function base64UrlDecodeToString(segment: string): string {
  let s = segment.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  return atob(s)
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = base64UrlDecodeToString(payload)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

export function isTokenValid(token: string): boolean {
  const trimmed = token.trim()
  if (!trimmed) return false
  const p = decodeJwtPayload(trimmed)
  if (!p) return false
  if (typeof p.exp !== 'number') return true
  return Date.now() < p.exp * 1000 - 30_000
}

export function getTokenExpiryMs(token: string): number | null {
  const p = decodeJwtPayload(token.trim())
  if (!p || typeof p.exp !== 'number') return null
  return p.exp * 1000
}
