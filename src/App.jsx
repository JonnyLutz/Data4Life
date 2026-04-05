import { useLayoutEffect, useMemo, useState } from 'react'
import './App.css'

import {
  COGNITO_ACCESS_TOKEN_KEY,
  COGNITO_ID_TOKEN_KEY,
  consumeImplicitCognitoRedirect,
  getCognitoImplicitLoginUrl,
} from './auth/cognitoImplicit'
import { fetchDashboard, fetchWhoopLoginUrl } from './api/whoop'
import Dashboard from './components/Dashboard.jsx'
import LoginPanel from './components/LoginPanel.jsx'

function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isTokenValid(token) {
  const trimmed = token.trim()
  if (!trimmed) return false
  const p = decodeJwtPayload(trimmed)
  if (!p) return false
  if (typeof p.exp !== 'number') return true
  return Date.now() < p.exp * 1000 - 30_000
}

function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const apiDisplay =
    import.meta.env.DEV && apiBaseUrl
      ? `Dev proxy: /aws-api → ${apiBaseUrl.replace(/\/$/, '')}`
      : apiBaseUrl
  const [sessionChecked, setSessionChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboardPayload, setDashboardPayload] = useState(null)
  const [showDevAuth, setShowDevAuth] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)
  const [cognitoLinkCopied, setCognitoLinkCopied] = useState(false)
  const [authCallbackError, setAuthCallbackError] = useState('')
  const [idTokenDraft, setIdTokenDraft] = useState(
    () =>
      window.localStorage.getItem(COGNITO_ID_TOKEN_KEY) ??
      window.localStorage.getItem(COGNITO_ACCESS_TOKEN_KEY) ??
      '',
  )

  const tokenPayload = useMemo(() => decodeJwtPayload(idTokenDraft.trim()), [idTokenDraft])
  const tokenUse = tokenPayload?.token_use ?? tokenPayload?.tokenUse ?? ''
  const tokenExpMs =
    typeof tokenPayload?.exp === 'number' ? tokenPayload.exp * 1000 : null
  const tokenExpired = tokenExpMs ? Date.now() > tokenExpMs - 30_000 : false
  const tokenIssuer = typeof tokenPayload?.iss === 'string' ? tokenPayload.iss : ''
  const tokenClientId =
    typeof tokenPayload?.client_id === 'string'
      ? tokenPayload.client_id
      : typeof tokenPayload?.aud === 'string'
        ? tokenPayload.aud
        : ''

  const displayName =
    (typeof tokenPayload?.email === 'string' && tokenPayload.email) ||
    (typeof tokenPayload?.['cognito:username'] === 'string' && tokenPayload['cognito:username']) ||
    ''

  const loggedIn = sessionChecked && isTokenValid(idTokenDraft)
  const sessionExpired =
    sessionChecked &&
    idTokenDraft.trim().length > 0 &&
    (!tokenPayload || tokenExpired)

  const cognitoLoginUrl = getCognitoImplicitLoginUrl()

  async function copyCognitoLoginUrl() {
    try {
      await navigator.clipboard.writeText(cognitoLoginUrl)
      setCognitoLinkCopied(true)
      window.setTimeout(() => setCognitoLinkCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function load() {
    if (!isTokenValid(idTokenDraft)) {
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await fetchDashboard()
      setDashboardPayload(data)
    } catch (e) {
      setDashboardPayload(null)
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  async function connectWhoop() {
    setError('')
    try {
      const data = await fetchWhoopLoginUrl()
      if (data?.url) window.location.assign(data.url)
      else throw new Error('Backend did not return a WHOOP login URL')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start WHOOP connect')
    }
  }

  function signIn() {
    window.location.assign(getCognitoImplicitLoginUrl())
  }

  function logout() {
    window.localStorage.removeItem(COGNITO_ID_TOKEN_KEY)
    window.localStorage.removeItem(COGNITO_ACCESS_TOKEN_KEY)
    setIdTokenDraft('')
    setDashboardPayload(null)
    setError('')
    setAuthCallbackError('')
    setLoading(false)
  }

  useLayoutEffect(() => {
    const rr = consumeImplicitCognitoRedirect()
    if (rr && !rr.ok) {
      setAuthCallbackError(rr.errorDescription || rr.error)
    } else if (rr?.ok) {
      setAuthCallbackError('')
    }

    const stored =
      window.localStorage.getItem(COGNITO_ID_TOKEN_KEY) ??
      window.localStorage.getItem(COGNITO_ACCESS_TOKEN_KEY) ??
      ''
    setIdTokenDraft(stored)

    if (stored.trim() && isTokenValid(stored)) {
      void (async () => {
        setError('')
        setLoading(true)
        try {
          const data = await fetchDashboard()
          setDashboardPayload(data)
        } catch (e) {
          setDashboardPayload(null)
          setError(e instanceof Error ? e.message : 'Failed to load dashboard')
        } finally {
          setLoading(false)
        }
      })()
    } else {
      setLoading(false)
    }

    setSessionChecked(true)
  }, [])

  if (!sessionChecked) {
    return (
      <div className="appShell">
        <div className="loginGate">
          <div className="pill">Loading…</div>
        </div>
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div className="appShell">
        <LoginPanel
          onSignIn={signIn}
          callbackError={authCallbackError}
          sessionExpired={sessionExpired}
        />
      </div>
    )
  }

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandTitle">Data4Life</div>
          <div className="brandSub">
            {displayName ? <span className="brandUser">{displayName}</span> : 'WHOOP overview'}
          </div>
        </div>

        <div className="ctaRow">
          {import.meta.env.DEV ? (
            <button type="button" className="ghostBtn" onClick={() => setShowDevAuth((v) => !v)}>
              {showDevAuth ? 'Hide' : 'Show'} dev auth
            </button>
          ) : null}
          <button type="button" className="ghostBtn" onClick={logout}>
            Log out
          </button>
          <button type="button" onClick={connectWhoop} disabled={loading}>
            Connect WHOOP
          </button>
          <button type="button" className="primaryBtn" onClick={() => void load()} disabled={loading}>
            {loading ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      {import.meta.env.DEV && showDevAuth ? (
        <div className="devAuthBar">
          <div className="panelMeta" style={{ marginBottom: 6 }}>
            Dev tools: manual token paste. Prefer <strong>Sign in</strong> on the login screen. After
            scope changes, use <strong>Connect WHOOP</strong> again.
          </div>
          <div className="panelMeta" style={{ marginBottom: 8 }}>
            API: <span className="mono">{apiDisplay || '—'}</span>
          </div>
          <div className="devAuthCognito">
            <div className="devAuthCognitoLabel">Hosted UI URL (same as Sign in)</div>
            <div className="devAuthCognitoRow">
              <a
                className="devAuthCognitoOpen"
                href={cognitoLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Cognito login
              </a>
              <button type="button" className="ghostBtn" onClick={() => void copyCognitoLoginUrl()}>
                {cognitoLinkCopied ? 'Copied URL' : 'Copy URL'}
              </button>
            </div>
            <div className="devAuthCognitoHint mono">{cognitoLoginUrl}</div>
          </div>
          <div className="panelMeta" style={{ marginBottom: 8 }}>
            Token:{' '}
            <span className="mono">
              {tokenPayload
                ? `${tokenUse || 'unknown'}${tokenExpired ? ' (expired)' : ''}`
                : 'not a JWT'}
            </span>
            {tokenPayload ? (
              <>
                {' '}
                ·{' '}
                <span className="mono">
                  {tokenIssuer ? tokenIssuer.replace('https://', '') : '—'} /{' '}
                  {tokenClientId ? `${tokenClientId.slice(0, 6)}…` : '—'}
                </span>
              </>
            ) : null}
          </div>
          <div className="devAuthRow">
            <input
              value={idTokenDraft}
              onChange={(e) => setIdTokenDraft(e.target.value)}
              placeholder="Cognito id_token (JWT)"
              className="devAuthInput"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = idTokenDraft.trim()
                if (!trimmed) return
                window.localStorage.setItem(COGNITO_ID_TOKEN_KEY, trimmed)
                setTokenSaved(true)
                window.setTimeout(() => setTokenSaved(false), 2000)
                void load()
              }}
            >
              {tokenSaved ? 'Saved' : 'Save token'}
            </button>
          </div>
        </div>
      ) : null}

      <main className="mainSingle">
        {loading && !dashboardPayload ? (
          <div className="pill">Loading dashboard…</div>
        ) : null}
        {error ? (
          <div className="errorBox">
            <div className="errorTitle">Couldn’t load dashboard</div>
            <div className="errorBody">{error}</div>
          </div>
        ) : null}
        {dashboardPayload ? <Dashboard payload={dashboardPayload} /> : null}
      </main>

      <p className="footerHint">
        Sleep calendar UI is preserved in{' '}
        <span className="mono">src/views/SleepCalendarView.jsx</span> — import it in{' '}
        <span className="mono">App.jsx</span> if you want it back.
      </p>
    </div>
  )
}

export default App
