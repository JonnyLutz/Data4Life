export default function LoginPanel({ onSignIn, callbackError, sessionExpired, missingCognitoEnv }) {
  return (
    <div className="loginGate">
      <div className="loginCard">
        <div className="loginBrand">Data4Life</div>
        <p className="loginTagline">WHOOP overview — demo</p>
        {missingCognitoEnv ? (
          <div className="errorBox loginCallbackErr">
            <div className="errorTitle">Cognito not configured</div>
            <div className="errorBody">
              Set <span className="mono">VITE_COGNITO_DOMAIN</span>,{' '}
              <span className="mono">VITE_COGNITO_REGION</span>, and{' '}
              <span className="mono">VITE_COGNITO_CLIENT_ID</span> in{' '}
              <span className="mono">.env.local</span> (see <span className="mono">.env.example</span>
              ).
            </div>
          </div>
        ) : null}
        <p className="loginCopy">
          {sessionExpired
            ? 'Your session expired. Sign in again to load the dashboard.'
            : 'Sign in with Cognito (PKCE) to call the API and connect WHOOP.'}
        </p>
        {callbackError ? (
          <div className="errorBox loginCallbackErr">
            <div className="errorTitle">Sign-in didn’t complete</div>
            <div className="errorBody">{callbackError}</div>
          </div>
        ) : null}
        <button
          type="button"
          className="primaryBtn loginSignInBtn"
          onClick={onSignIn}
          disabled={missingCognitoEnv}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}
