# Data4Life

Installable React PWA that connects to WHOOP and shows **sleep** on a dashboard (calendar + details).

## Local dev (frontend)

```bash
cd Data4Life
cp .env.example .env.local
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` to your deployed API URL (from CDK output).

## Backend (serverless, CDK)

The backend lives in `infra/` and deploys:
- API Gateway + Lambda
- Cognito User Pool (+ domain)
- DynamoDB table for WHOOP tokens
- Secrets Manager secret for WHOOP OAuth client credentials

### Deploy

```bash
cd infra
npm install
npx cdk bootstrap
npx cdk deploy
```

Then update the generated Secrets Manager secret (`WhoopOAuthSecret`) to include your real values:

```json
{
  "clientId": "YOUR_WHOOP_CLIENT_ID",
  "clientSecret": "YOUR_WHOOP_CLIENT_SECRET"
}
```

### WHOOP redirect URL

After deployment, register the callback URL in WHOOP:

- `https://<your-api-host>/prod/auth/callback`

## Notes

- The UI currently has a **temporary dev auth** field for a Cognito ID token (JWT) stored in localStorage. Next step is wiring full Cognito Hosted UI login in the PWA so you don’t paste tokens manually.
