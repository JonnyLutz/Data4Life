
# Data4Life

Installable **React + Vite PWA** that signs in with **Amazon Cognito**, connects **WHOOP** via a **serverless API**, and shows **recovery, strain, sleep, workouts**, a **sleep calendar**, and optional **insights** (heuristic summary; **Amazon Bedrock** if you configure a model on the stack).

## Architecture

- **Frontend:** Cognito Hosted UI → authorization code flow → `id_token` / `access_token` / `refresh_token` in `localStorage`; silent **refresh** before API calls.
- **Backend (`infra/`):** API Gateway HTTP API → single Lambda → verifies Cognito **ID token**, stores WHOOP OAuth tokens in **DynamoDB**, reads WHOOP client credentials from **Secrets Manager**, proxies WHOOP Developer API v2.

## Local dev (frontend)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Fill `.env.local`:

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Deployed API URL from CDK (`HttpApiUrl` output). In dev, requests go to `/aws-api` and Vite proxies to this host. |
| `VITE_COGNITO_DOMAIN` | Cognito domain **prefix** only (before `.auth.<region>.amazoncognito.com`). |
| `VITE_COGNITO_REGION` | Same region as the pool (e.g. `us-east-1`). |
| `VITE_COGNITO_CLIENT_ID` | App client id from CDK (`UserPoolClientId`). |
| `VITE_COGNITO_REDIRECT_PATH` | Default `/`. Must match a **callback URL** on the app client (including trailing slash if you use one). |

Dev-only **“Show dev auth”** still lets you paste a Cognito `id_token` for debugging.

### AWS Amplify (`redirect_mismatch` after deploy)

The SPA sends **`redirect_uri` = your Amplify site origin + `/`** (see `src/auth/cognitoPkce.ts`). Cognito only allows sign-in if that URL is on the app client’s **Allowed callback URLs**.

1. Note your app URL, e.g. `https://main.dxxxxxxxxxxxx.amplifyapp.com`.
2. Redeploy the stack with **`appUrl`** set to that origin (trailing slash is fine):

```bash
cd infra
npx cdk deploy -c appUrl=https://main.dxxxxxxxxxxxx.amplifyapp.com/
```

3. In **Amplify Console → Environment variables**, set the same `VITE_*` values you use locally (`VITE_API_BASE_URL`, Cognito vars). Rebuild the frontend.

For **preview branches**, add URLs via `-c extraCallbackUrls=https://branch.dxxx.amplifyapp.com/,...` (or run `cdk deploy` again with those included).

## Backend (CDK)

```bash
cd infra
npm install
npx cdk bootstrap   # once per account/region
npx cdk deploy
```

**If deploy says “Unable to resolve AWS account”:** the AWS CLI has no usable credentials in this shell. Check:

```bash
aws sts get-caller-identity
```

If that errors, run `aws configure` (access key) or sign in with SSO (`aws sso login --profile YOUR_PROFILE`) and deploy with `AWS_PROFILE=YOUR_PROFILE npx cdk deploy`.

Note stack context (optional):

- `appUrl` — hosted app origin for Cognito **callback/logout** URLs and Lambda **`APP_URL`** (WHOOP redirects here after connect). Use your **Amplify URL** for production, e.g. `https://main.dxxxxxxxxxxxx.amplifyapp.com/` (include trailing slash if your app uses `redirect_uri` with one). Default `http://localhost:5173/`.
- `extraCallbackUrls` — comma-separated extra origins (e.g. **Amplify branch previews**): `https://pr-3.dxxx.amplifyapp.com/,https://www.example.com/`
- `cognitoDomainPrefix` — globally unique Cognito hosted domain prefix if the default conflicts.
- `bedrockModelId` — e.g. `amazon.titan-text-express-v1` to enable LLM summaries on `POST /insights/summary` (Lambda has `bedrock:InvokeModel`; may still fall back to heuristics if the model/region is unavailable).

After deploy:

1. Copy **HttpApiUrl** → `VITE_API_BASE_URL`.
2. Copy **UserPoolClientId**, **UserPoolId**, **CognitoHostedUiDomain** (prefix) → Cognito env vars in `.env.local`.
3. Register **WhoopRedirectUri** (output) as the **Redirect URL** in the [WHOOP Developer Dashboard](https://developer.whoop.com/).
4. Update Secrets Manager secret **`WhoopOAuthSecret`** JSON:

```json
{
  "clientId": "YOUR_WHOOP_CLIENT_ID",
  "clientSecret": "YOUR_WHOOP_CLIENT_SECRET"
}
```

Optional: add `"stateSecret"` for WHOOP OAuth state signing; if omitted, the Lambda uses `clientSecret` for HMAC (fine for a personal deployment).

## API routes (HTTP API, no `/prod` stage prefix)

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/dashboard` | Cognito `id_token` |
| `GET` | `/sleep?limit=1-25` | Cognito `id_token` |
| `GET` | `/auth/login-url` | Cognito `id_token` — returns WHOOP authorize URL |
| `GET` | `/auth/callback` | Public — WHOOP OAuth redirect; redirects browser to `APP_URL` |
| `POST` | `/insights/summary` | Cognito `id_token` — bounded text summary |

## Tests

```bash
npm run test        # Vitest (unit)
npm run test:e2e    # Playwright — starts Vite on 127.0.0.1:5174 (install browsers once: npx playwright install chromium)
```

## Publishing to GitHub

- **Do not commit** `.env.local` or any file with real `VITE_*` values, WHOOP credentials, or JWTs. This repo ignores `.env*`, `*.local`, and `infra/cdk.context.json` (except `.env.example`).
- If you **ever** committed secrets by mistake, rotate them (WHOOP secret, Cognito app client, AWS keys) and use [git history cleanup](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) — ignoring files does not remove past commits.

## Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (TypeScript modules under `src/`) |
| `npm run test` | Vitest |
| `npm run test:e2e` | Playwright |
