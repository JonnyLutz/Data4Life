import { useLayoutEffect, useMemo, useState } from 'react'
import './App.css'

import {
  clearTokens,
  COGNITO_ID_TOKEN_KEY,
  consumeCognitoPkceRedirect,
  getCognitoPkceLoginUrl,
  getStoredIdToken,
  readCognitoEnv,
  refreshCognitoTokens,
} from './auth/cognitoPkce'
import { fetchDashboard, fetchInsightsSummary, fetchWhoopLoginUrl } from './api/whoop'
import { decodeJwtPayload, isTokenValid } from './lib/jwt'
import Dashboard from './components/Dashboard.jsx'
import LoginPanel from './components/LoginPanel.jsx'
import SleepCalendarView from './views/SleepCalendarView.jsx'
import { buildMockDashboardPayload, mockInsightsSummary } from './demo/mockDashboard'

const SLEEP_LIMIT = 25
const DEMO_MODE_KEY = 'data4life_demo_mode'

function App() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
  const apiDisplay =
    import.meta.env.DEV && apiBaseUrl
      ? `Dev proxy: /aws-api → ${apiBaseUrl.replace(/\/$/, '')}`
      : apiBaseUrl
  const cognitoReady = Boolean(readCognitoEnv())

  const [sessionChecked, setSessionChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dashboardPayload, setDashboardPayload] = useState(null)
  const [activeView, setActiveView] = useState('dashboard')
  const [showDevAuth, setShowDevAuth] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)
  const [cognitoLinkCopied, setCognitoLinkCopied] = useState(false)
  const [authCallbackError, setAuthCallbackError] = useState('')
  const [idTokenDraft, setIdTokenDraft] = useState(() => getStoredIdToken())
  const [insightsText, setInsightsText] = useState('')
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [insightsSource, setInsightsSource] = useState('')
  const [demoMode, setDemoMode] = useState(() => window.localStorage.getItem(DEMO_MODE_KEY) === '1')

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

  const displayName = demoMode
    ? 'Guest'
    : (typeof tokenPayload?.email === 'string' && tokenPayload.email) ||
      (typeof tokenPayload?.['cognito:username'] === 'string' && tokenPayload['cognito:username']) ||
      ''

  const loggedIn = sessionChecked && (demoMode || isTokenValid(idTokenDraft))
  const sessionExpired =
    sessionChecked &&
    idTokenDraft.trim().length > 0 &&
    (!tokenPayload || tokenExpired)

  const sleepRecords = useMemo(() => {
    const s = dashboardPayload?.sections?.sleep
    if (!s?.ok || !s.data?.records) return []
    return s.data.records
  }, [dashboardPayload])

  async function copyCognitoLoginUrl() {
    try {
      const url = await getCognitoPkceLoginUrl()
      await navigator.clipboard.writeText(url)
      setCognitoLinkCopied(true)
      window.setTimeout(() => setCognitoLinkCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function load() {
    if (demoMode) {
      setError('')
      setLoading(true)
      try {
        setDashboardPayload(buildMockDashboardPayload())
      } finally {
        setLoading(false)
      }
      return
    }
    if (!isTokenValid(idTokenDraft)) {
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      await refreshCognitoTokens()
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
    if (demoMode) return
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
    void (async () => {
      try {
        window.location.assign(await getCognitoPkceLoginUrl())
      } catch (e) {
        setAuthCallbackError(e instanceof Error ? e.message : 'Sign-in failed to start')
      }
    })()
  }

  function enterDemoMode() {
    window.localStorage.setItem(DEMO_MODE_KEY, '1')
    setDemoMode(true)
    clearTokens()
    setIdTokenDraft('')
    setAuthCallbackError('')
    setError('')
    setInsightsText('')
    setInsightsError('')
    setInsightsSource('')
    setActiveView('dashboard')
    setDashboardPayload(buildMockDashboardPayload())
    setLoading(false)
  }

  function logout() {
    window.localStorage.removeItem(DEMO_MODE_KEY)
    setDemoMode(false)
    clearTokens()
    setIdTokenDraft('')
    setDashboardPayload(null)
    setError('')
    setAuthCallbackError('')
    setInsightsText('')
    setInsightsError('')
    setLoading(false)
  }

  async function loadInsights() {
    if (demoMode) {
      setInsightsError('')
      setInsightsLoading(true)
      try {
        const r = mockInsightsSummary()
        setInsightsText(r.summary)
        setInsightsSource(r.source)
      } finally {
        setInsightsLoading(false)
      }
      return
    }
    setInsightsError('')
    setInsightsLoading(true)
    try {
      await refreshCognitoTokens()
      const r = await fetchInsightsSummary()
      setInsightsText(r.summary)
      setInsightsSource(r.source ?? '')
    } catch (e) {
      setInsightsText('')
      setInsightsError(e instanceof Error ? e.message : 'Failed to load insights')
    } finally {
      setInsightsLoading(false)
    }
  }

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('whoop') === 'connected') {
      params.delete('whoop')
      const q = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}`)
    }

    let alive = true
    void (async () => {
      try {
        const demo = window.localStorage.getItem(DEMO_MODE_KEY) === '1'
        if (demo && alive) {
          setDemoMode(true)
          setAuthCallbackError('')
          setError('')
          setLoading(false)
          setDashboardPayload(buildMockDashboardPayload())
          return
        }

        const rr = await consumeCognitoPkceRedirect()
        if (!alive) return
        if (rr && !rr.ok) {
          setAuthCallbackError(rr.errorDescription || rr.error)
        } else if (rr?.ok) {
          setAuthCallbackError('')
        }

        const stored = getStoredIdToken()
        setIdTokenDraft(stored)

        if (stored.trim() && isTokenValid(stored)) {
          await refreshCognitoTokens()
          setError('')
          setLoading(true)
          try {
            const data = await fetchDashboard()
            if (!alive) return
            setDashboardPayload(data)
          } catch (e) {
            if (!alive) return
            setDashboardPayload(null)
            setError(e instanceof Error ? e.message : 'Failed to load dashboard')
          } finally {
            if (alive) setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } finally {
        if (alive) setSessionChecked(true)
      }
    })()

    return () => {
      alive = false
    }
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
          onDemoMode={enterDemoMode}
          callbackError={authCallbackError}
          sessionExpired={sessionExpired}
          missingCognitoEnv={!cognitoReady}
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
            {demoMode ? 'Exit demo' : 'Log out'}
          </button>
          {!demoMode ? (
            <button type="button" onClick={connectWhoop} disabled={loading}>
              Connect WHOOP
            </button>
          ) : null}
          <button type="button" className="primaryBtn" onClick={() => void load()} disabled={loading}>
            {loading ? 'Syncing…' : demoMode ? 'Refresh demo' : 'Sync'}
          </button>
        </div>
      </header>

      <nav className="navTabs" aria-label="Views">
        <button
          type="button"
          className={activeView === 'dashboard' ? 'navTab navTab--active' : 'navTab'}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={activeView === 'calendar' ? 'navTab navTab--active' : 'navTab'}
          onClick={() => setActiveView('calendar')}
        >
          Sleep calendar
        </button>
        <button
          type="button"
          className={activeView === 'insights' ? 'navTab navTab--active' : 'navTab'}
          onClick={() => setActiveView('insights')}
        >
          Insights
        </button>
      </nav>

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
            <div className="devAuthCognitoLabel">Hosted UI (same as Sign in)</div>
            <div className="devAuthCognitoRow">
              <button type="button" className="ghostBtn" onClick={() => void copyCognitoLoginUrl()}>
                {cognitoLinkCopied ? 'Copied URL' : 'Copy login URL'}
              </button>
            </div>
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
        {activeView === 'dashboard' ? (
          <>
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
          </>
        ) : null}

        {activeView === 'calendar' ? (
          <SleepCalendarView
            sleeps={sleepRecords}
            loading={loading && !dashboardPayload}
            error={error}
            onRetry={() => void load()}
            sleepMeta={`Last ${SLEEP_LIMIT} sleeps (from dashboard sync)`}
          />
        ) : null}

        {activeView === 'insights' ? (
          <section className="panel insightsPanel">
            <div className="panelHeader">
              <div className="panelTitle">Weekly snapshot</div>
              <div className="panelMeta">
                Bounded summary from your latest WHOOP dashboard data (heuristic; optional Bedrock on
                the API).
              </div>
            </div>
            <div className="panelBody">
              <button type="button" className="primaryBtn" onClick={() => void loadInsights()} disabled={insightsLoading}>
                {insightsLoading ? 'Generating…' : 'Generate summary'}
              </button>
              {insightsSource ? (
                <p className="insightsSource">
                  Source: <span className="mono">{insightsSource}</span>
                </p>
              ) : null}
              {insightsError ? (
                <div className="errorBox" style={{ marginTop: 12 }}>
                  <div className="errorTitle">Insights</div>
                  <div className="errorBody">{insightsError}</div>
                </div>
              ) : null}
              {insightsText ? <p className="insightsBody">{insightsText}</p> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
