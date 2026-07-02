# JobPilot AI

JobPilot AI v2.0.1 is a review-first job application assistant with CV identity verification, ATS analysis, multi-source job discovery, Stripe-ready Pro subscriptions, Gemini cover letters and interview coaching, behavior-aware client updates, and customizable public CV webpages.

## Version 2.0.1 Highlights

- Client signup/login with isolated per-user data.
- Career goal setup at `/goal`.
- PDF, DOCX, and TXT CV parsing with ATS structure feedback.
- CV ownership verification before applications can be approved or sent.
- Customizable CV webpage with cover image, circular profile photo, projects, experience, education, skills, colors, templates, privacy controls, and a public `/cv/:slug` link.
- Job aggregation from JSearch, Adzuna, Remotive, Remote OK, Arbeitnow, and USAJOBS.
- Match scoring, risk checks, decision reports, resume tailoring, and interview preparation.
- Review-first Gmail and WhatsApp sending with approval and daily limits.
- A separate owner portal with owner-only API authorization.
- PostgreSQL production persistence with automatic first-deploy migration from the attached SQLite volume.
- Stripe Checkout, webhook, recurring-payment, cancellation, and Customer Portal support.
- Gemini-grounded cover letters and recorded mock-interview coaching.
- Privacy/Terms pages plus account export and permanent deletion controls.
- Five-stage application pipeline with category filters and ATS, match, risk, and recency ordering.
- Portal-based job detail modal, cached Google profile photos, and CV-to-role course recommendations with proof projects.

## Run Locally

```powershell
npm install
Copy-Item backend/.env.example backend/.env
npm run dev
```

- Client app: `http://localhost:3000`
- Owner portal: `http://localhost:3001`
- API health: `http://localhost:4000/api/health`

Production owner APIs remain disabled unless `ENABLE_OWNER_PORTAL=true`. The Railway build also prepares the owner UI at `/owner/`; when enabled, Google owner login is restricted to `OWNER_EMAIL` and all owner APIs still require an owner session.

## Local Development Accounts

- Client sign-in should use Google OAuth. A seeded password account can be enabled for local development with `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD`.
- Owner: `owner@jobpilot.ai` / `owner12345`

Production startup requires Google OAuth credentials, `OWNER_EMAIL`, and an `OWNER_PASSWORD` of at least 12 characters. Never deploy local development credentials.

Google OAuth must be set to **In production** for accounts outside the test-user list to connect Gmail. Gmail send access is a sensitive scope, so Google verification and a verified custom domain are still required to remove the unverified-app warning and pre-verification user cap.

The Windows desktop package is client-only. It does not include admin assets and starts its local backend with owner access disabled.

## Job Provider Configuration

Add provider credentials to `backend/.env`. JSearch accepts either `JSEARCH_API_KEY` or the legacy `RAPIDAPI_KEY` name.

## Business Gmail Client Updates

The owner portal includes a separate Client Update Agent at `/client-updates`. It sends product and application updates to active client accounts that have update emails enabled.

Configure your business Gmail in `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-business@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM="JobPilot AI <your-business@gmail.com>"
SMTP_REPLY_TO=your-business@gmail.com
CLIENT_UPDATE_AGENT_ENABLED=true
CLIENT_UPDATE_PERSONALIZATION_ENABLED=true
CLIENT_UPDATE_GEMINI_PERSONALIZATION=true
```

Use a Google app password for `SMTP_PASS`; do not commit or paste the real password into chat.

The same mailbox sends a one-time welcome email when a client account is first created through Google or password signup. Later logins do not resend it. Release emails are individualized from safe workspace signals such as goal setup, CV verification, review-queue counts, interview activity, and connected delivery tools. Raw CV text, employer names, inbox contents, and private message bodies are excluded from personalization.

## Pro Billing and Gemini

Production Pro access changes only after verified Stripe events. The legacy direct-upgrade endpoint is disabled unless the explicit test flag is enabled.

```env
APP_VERSION=2.0.1
DATABASE_URL=${{Postgres.DATABASE_URL}}
GEMINI_API_KEY=<private-gemini-key>
GEMINI_MODEL=gemini-3.5-flash
STRIPE_SECRET_KEY=<private-stripe-key>
STRIPE_WEBHOOK_SECRET=<private-webhook-secret>
STRIPE_PRO_MONTHLY_PRICE_ID=<stripe-price-id>
STRIPE_PRO_ANNUAL_PRICE_ID=<optional-stripe-price-id>
```

Never place private provider keys in frontend variables or commit them to Git.

### Automatic Software Change Emails

The backend can also run a Software Change Update Agent that watches the codebase and sends one professional digest email to opted-in clients after a software change settles. It reuses the business Gmail SMTP mailbox and stores a software fingerprint with each email so the same change is not announced twice.

```env
CLIENT_UPDATE_SOFTWARE_AUTO_ENABLED=true
CLIENT_UPDATE_SOFTWARE_SCAN_INTERVAL_MS=60000
CLIENT_UPDATE_SOFTWARE_QUIET_MS=300000
CLIENT_UPDATE_SOFTWARE_MIN_DIGEST_INTERVAL_MS=1800000
CLIENT_UPDATE_LAUNCH_PROGRESS_PERCENT=80
CLIENT_UPDATE_LAUNCH_STATUS=Core client features, Gmail delivery, Google sign-in, CV webpages, and owner update tools are being finalized for launch.
```

The agent watches only client-facing UI and feature files, uses content hashes to ignore repeated saves, waits for editing to settle, and batches nearby changes into one release digest. The owner portal can request a safe scan without bypassing duplicate protection.

## Validation

```powershell
npm run check
npm audit --omit=dev
```

`npm run check` runs backend regression tests and builds both React applications.

## Deploy the Public Client on Railway

The included `railway.json` builds the client and runs the API as one public service. Attach a volume at `/data`, set `JOBPILOT_DATA_DIR=/data`, and attach Railway PostgreSQL through `DATABASE_URL`. On the first PostgreSQL deployment, the backend copies the existing SQLite snapshot into PostgreSQL before accepting requests.

Required production variables:

```env
NODE_ENV=production
JOBPILOT_DATA_DIR=/data
ENABLE_OWNER_PORTAL=false
ENABLE_REAL_SEND=true
ENABLE_DRY_RUN_SEND=false
ENCRYPTION_SECRET=<64-character-hex-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

Railway supplies `RAILWAY_PUBLIC_DOMAIN`; JobPilot uses it for the frontend URL and both Google callbacks. In Google Cloud, add these authorized redirect URIs after Railway creates the public domain:

```text
https://YOUR-DOMAIN.up.railway.app/api/auth/google/callback
https://YOUR-DOMAIN.up.railway.app/api/gmail/callback
```

Keep the owner portal on a separate private deployment. Do not set `ENABLE_OWNER_PORTAL=true` on the public client service.
