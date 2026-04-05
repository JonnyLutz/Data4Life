import { describe, expect, it } from 'vitest'
import { decodeJwtPayload, isTokenValid } from './jwt'

function b64url(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

describe('jwt helpers', () => {
  it('decodes payload', () => {
    const payload = { sub: 'abc', exp: Math.floor(Date.now() / 1000) + 3600 }
    const token = `x.${b64url(payload)}.y`
    expect(decodeJwtPayload(token)).toMatchObject({ sub: 'abc' })
  })

  it('rejects invalid token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
  })

  it('isTokenValid respects exp', () => {
    const past = { exp: Math.floor(Date.now() / 1000) - 100 }
    const token = `h.${b64url(past)}.s`
    expect(isTokenValid(token)).toBe(false)
  })
})
