export default function LoginPanel({ onSignIn, callbackError, sessionExpired }) {
  return (
    <div className="loginGate">
      <div className="loginCard">
        <div className="loginBrand">Data4Life</div>
        <p className="loginTagline">WHOOP overview — demo</p>
        <p className="loginCopy">
          {sessionExpired
            ? 'Your session expired. Sign in again to load the dashboard.'
            : 'Sign in with your Cognito user to connect the API and WHOOP data.'}
        </p>
        {callbackError ? (
          <div className="errorBox loginCallbackErr">
            <div className="errorTitle">Sign-in didn’t complete</div>
            <div className="errorBody">{callbackError}</div>
          </div>
        ) : null}
        <button type="button" className="primaryBtn loginSignInBtn" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    </div>
  )
}
