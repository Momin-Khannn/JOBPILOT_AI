# JobPilot AI Deployment

## Platform Decision

Use **Railway** for the production deployment.

Vercel and Netlify are excellent for static React frontends, but JobPilot AI is not only a static site. The app needs:

- A long-running Express API.
- Stripe webhook handling at `/api/billing/webhook`.
- Google OAuth and Gmail OAuth callback routes.
- PostgreSQL-backed persistence.
- Server-side file parsing for resumes.
- One public origin serving the frontend and API together.

Railway fits this shape directly with the existing `railway.json`. The frontend and owner portal are built into static assets, and the backend serves the client app, `/owner`, and `/api`.

## Production Service

Deploy from the GitHub repo:

```text
https://github.com/Momin-Khannn/JOBPILOT_AI.git
```

Railway settings:

- Builder: Railpack, from `railway.json`.
- Build command: already configured.
- Start command: `npm start`.
- Health check path: `/api/health`.
- Attach PostgreSQL and expose `DATABASE_URL`.

## Required Variables

```env
NODE_ENV=production
ENABLE_OWNER_PORTAL=false
ENABLE_REAL_SEND=true
ENABLE_DRY_RUN_SEND=false
REQUIRE_EMAIL_VERIFICATION=true
JOBPILOT_DATA_DIR=/data
DATABASE_URL=${{Postgres.DATABASE_URL}}
ENCRYPTION_SECRET=<64-character-hex-secret>

APP_NAME=JobPilot AI
APP_VERSION=2.0.1
SUPPORT_EMAIL=ai.jobpilot@gmail.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<business-gmail>
SMTP_PASS=<google-app-password>
SMTP_FROM="JobPilot AI <business-gmail>"
SMTP_REPLY_TO=<business-gmail>

GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
STRIPE_PRO_MONTHLY_PRICE_ID=<stripe-monthly-price-id>
STRIPE_PRO_ANNUAL_PRICE_ID=<stripe-annual-price-id>

GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-3.5-flash
```

Optional custom-domain variable:

```env
APP_BASE_URL=https://your-domain.example
```

If no custom domain is set, Railway provides `RAILWAY_PUBLIC_DOMAIN` and JobPilot derives the public app/API URL from it.

## Provider Callback URLs

After Railway creates the public domain, configure Google Cloud OAuth redirects:

```text
https://YOUR-DOMAIN/api/auth/google/callback
https://YOUR-DOMAIN/api/gmail/callback
```

Configure Stripe webhook endpoint:

```text
https://YOUR-DOMAIN/api/billing/webhook
```

## Post-Deploy Smoke Test

Replace `YOUR-DOMAIN` with the deployed URL.

```powershell
$base = "https://YOUR-DOMAIN"
Invoke-RestMethod "$base/api/health"
Invoke-WebRequest "$base/robots.txt"
Invoke-WebRequest "$base/sitemap.xml"
Invoke-WebRequest "$base/privacy"
Invoke-WebRequest "$base/terms"
Invoke-WebRequest "$base/support"
```

Expected:

- `/api/health` returns `status: ok`.
- `/robots.txt` references the live sitemap URL.
- `/sitemap.xml` contains the live domain.
- Public legal/support pages load without login.

## Google Search Submission

Yes, submit the sitemap after deployment.

Google's unauthenticated sitemap ping endpoint is deprecated. Use:

- `robots.txt` with the `Sitemap:` line, already handled by the app.
- Google Search Console Sitemaps report.

Submit:

```text
https://YOUR-DOMAIN/sitemap.xml
```

Then use URL Inspection for:

```text
https://YOUR-DOMAIN/
https://YOUR-DOMAIN/privacy
https://YOUR-DOMAIN/terms
https://YOUR-DOMAIN/support
```
