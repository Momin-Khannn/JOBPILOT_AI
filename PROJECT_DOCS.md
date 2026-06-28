# JobPilot AI — Project Documentation

> **Version:** 2.0.1
> **Stack:** Node.js (Express) + React (Vite) + SQLite + Electron
> **Last updated:** 2026-06-19

A review-first, AI-powered job application assistant. Upload your CV, discover matching jobs, get AI decision reports, and send approved outreach via Gmail or WhatsApp — nothing goes out without human approval.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Environment Variables](#environment-variables)
4. [Backend API Reference](#backend-api-reference)
5. [Backend Services](#backend-services)
6. [Database](#database)
7. [Frontend Client App](#frontend-client-app)
8. [Admin Portal](#admin-portal)
9. [Desktop App](#desktop-app)
10. [Data Flow](#data-flow)
11. [Security Design](#security-design)
12. [Technology Stack](#technology-stack)
13. [NPM Scripts](#npm-scripts)
14. [LAN Sharing](#lan-sharing)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     JOBPILOT AI MONOREPO                          │
│                                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐    │
│  │  FRONTEND    │  │ ADMIN PORTAL  │  │  DESKTOP APP          │    │
│  │  React+Vite  │  │ React+Vite   │  │  Electron             │    │
│  │  Port 3000   │  │ Port 3001    │  │  Port 51234           │    │
│  │  18 pages    │  │ 6 pages      │  │  Bundles all 3        │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘    │
│         │   REST API       │                                       │
│         └──────┬───────────┘                                       │
│                ▼                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  BACKEND (Express.js) — Port 4000                             │ │
│  │                                                                │ │
│  │  15 Route modules · 15 Service modules · SQLite database      │ │
│  │                                                                │ │
│  │  External: Gmail API · Twilio · Meta Cloud · Anthropic Claude │ │
│  │  Job providers: JSearch · Adzuna · Remotive · Remote OK ·     │ │
│  │                  Arbeitnow · USAJOBS                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```powershell
npm install
Copy-Item backend/.env.example backend/.env    # first time only
npm run dev
```

| What | URL |
|------|-----|
| Client app | `http://localhost:3000` |
| Admin portal | `http://localhost:3001` |
| API health | `http://localhost:4000/api/health` |

### Default Accounts

| Role | Email | Password |
|------|-------|----------|
| Client | Google OAuth sign-in | — |
| Owner | `owner@jobpilot.ai` | `owner12345` |

> Production requires Google OAuth credentials, `OWNER_EMAIL`, and an `OWNER_PASSWORD` of at least 12 characters.

---

## Environment Variables

Configure in `backend/.env`:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend port | `4000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `ADMIN_URL` | Admin portal origin for CORS | `http://localhost:3001` |
| `ENABLE_REAL_SEND` | `true` = real emails/WhatsApp | `false` (demo mode) |
| `ENABLE_OWNER_PORTAL` | Enable admin API routes | `false` |
| `ENCRYPTION_SECRET` | AES-256 key for token encryption | auto-generated |
| `SESSION_TTL_HOURS` | Session expiry | `168` (7 days) |
| **Google OAuth** | | |
| `GOOGLE_CLIENT_ID` | OAuth2 client ID | — |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret | — |
| `GOOGLE_REDIRECT_URI` | OAuth2 callback URL | — |
| **Gmail SMTP** (business updates) | | |
| `SMTP_HOST` | SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `465` |
| `SMTP_USER` | Business email | — |
| `SMTP_PASS` | Google app password | — |
| **AI** | | |
| `ANTHROPIC_API_KEY` | Optional Claude AI (app works without it) | — |
| **Job Providers** | | |
| `JSEARCH_API_KEY` or `RAPIDAPI_KEY` | JSearch API | — |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Adzuna API | — |
| `USAJOBS_API_KEY` / `USAJOBS_EMAIL` | USAJOBS API | — |
| **WhatsApp** | | |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_WHATSAPP_NUMBER` | Twilio | — |
| `META_WA_TOKEN` / `META_PHONE_NUMBER_ID` | Meta Cloud API | — |
| **Software Update Agent** | | |
| `CLIENT_UPDATE_SOFTWARE_AUTO_ENABLED` | Auto-send software change emails | `false` |
| `CLIENT_UPDATE_SOFTWARE_SCAN_INTERVAL_MS` | Scan interval | `60000` |
| `CLIENT_UPDATE_SOFTWARE_QUIET_MS` | Quiet window before sending | `120000` |

---

## Backend API Reference

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create new client account |
| POST | `/login` | Email/password login → session token |
| GET | `/google/auth-url` | Google OAuth authorization URL |
| POST | `/google/callback` | Exchange Google auth code → session |
| GET | `/me` | Current user from session token |
| POST | `/logout` | Destroy session |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password` | Set new password with reset token |

### Jobs — `/api/jobs`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/search` | Filter jobs by query, location, type, salary, experience, deadline |
| POST | `/:id/refresh` | Re-fetch and update a job from its provider |

### Resume — `/api/resume`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/latest` | Most recent uploaded resume |
| POST | `/parse` | Upload PDF/DOCX/TXT (max 8 MB), extract profile, calculate ATS score |

### Applications — `/api/applications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | All applications + summary stats |
| GET | `/summary` | Stats only |
| POST | `/queue` | Queue selected jobs → auto AI scoring, reports, drafts, follow-ups |
| PATCH | `/:id` | Update status, notes, channel, or draft |
| POST | `/:id/approve` | Mark approved (required before sending) |

### AI — `/api/ai`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/decision-report` | Full report: match + risk + research + tailoring + prep |
| POST | `/tailor-resume` | ATS-optimized resume bullets for a specific job |
| POST | `/interview-prep` | Elevator pitch, technical/behavioral questions, topics |

### Career — `/api/career`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Funnel analytics + skill gap + interview sessions + applications |
| POST | `/interviews` | Start a 5-question mock interview session |
| POST | `/interviews/:id/answer` | Submit answer → get AI scoring and coaching feedback |

### Profile — `/api/profile`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/me` | Current user's CV profile |
| PUT | `/me` | Save CV profile (all sections, theme, visibility, slug) |
| POST | `/image` | Upload profile photo or cover image |
| GET | `/public/:slug` | Public CV page data (no auth required) |

### Goal — `/api/goal`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Current career goal |
| PUT | `/` | Save career goal (roles, locations, types, salary) |

### Gmail — `/api/gmail`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Gmail connection status |
| GET | `/auth-url` | OAuth2 authorization URL |
| GET | `/callback` | Exchange OAuth code → encrypted token storage |
| POST | `/send` | Send approved application via Gmail |

### WhatsApp — `/api/whatsapp`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | WhatsApp connection status |
| POST | `/configure` | Set provider (twilio/meta) |
| POST | `/send` | Send approved application via WhatsApp |

### Follow-ups — `/api/followups`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | All follow-ups sorted by due date |
| POST | `/schedule` | Create follow-up for an application |
| PATCH | `/:id` | Update status, due date, or body |

### Inbox — `/api/inbox`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | All classified inbox events |
| POST | `/classify` | Classify message intent → auto-update matching application |

### Settings — `/api/settings`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | User profile + integration statuses |
| PUT | `/` | Update profile and preferences |

### Admin — `/api/admin` (owner only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | System-wide stats |
| GET | `/users` | All client accounts |
| PATCH | `/users/:id` | Suspend/activate user |
| GET | `/applications` | All applications across all users |
| GET | `/activity` | Audit log |

### Client Updates — `/api/admin/client-updates` (owner only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Update agent status and eligible clients |
| POST | `/send` | Send product update email to opted-in clients |
| POST | `/scan` | Trigger immediate software change scan |

---

## Backend Services

### `aiService.js` — Core AI Logic
All scoring works locally via JavaScript. Claude AI is optional for enhanced results.

| Function | What it does |
|----------|-------------|
| `parseResumeText(text)` | Extracts name, email, phone, LinkedIn, GitHub, skills, education, experience. Calculates ATS score and improvement gaps |
| `scoreJobMatch(profile, job)` | Token-overlap scoring → matchScore, atsScore, missingSkills, strengths |
| `analyzeJobRisk(job)` | Scam detection: fee requests, personal emails, urgency. Returns riskLevel (Low/Medium/High) |
| `researchCompany(job)` | Company summary, hiring signals, tech stack, recruiter questions |
| `tailorResumeForJob(profile, job)` | ATS-optimized headline, summary, bullets. Shows before/after ATS score |
| `generateInterviewPrep(profile, job)` | Elevator pitch, technical/behavioral questions, topics to study |
| `generateDecisionReport(profile, job)` | Combines all above → recommendation: Apply / Review / Skip |
| `classifyInboxMessage(payload)` | Detects intent: offer / interview / rejection / follow_up_needed |
| `draftOutreach(payload)` | Professional email (Gmail) or short WhatsApp message |
| `createFollowUpPlan(app, days)` | Follow-up message due N days from now |

### `careerService.js` — Career Intelligence
| Function | What it does |
|----------|-------------|
| `buildFunnelAnalytics(apps)` | Stage-by-stage conversion rates, response rates, median response days |
| `buildSkillGap(data)` | Demand-weighted skill gap analysis, coverage %, learning path |
| `buildInterviewQuestions(data)` | 5 role-tailored questions (opening, behavioral, technical, problem-solving, closing) |
| `evaluateInterviewAnswer(answer, question)` | Scores clarity, evidence, relevance, structure → coaching feedback |
| `summarizeInterviewSession(session)` | Calculates average score across all responses |

### `authService.js` — Authentication
Handles user creation, bcrypt password hashing, Google OAuth user resolution, seed user generation, and role-based access control.

### `jobProviderService.js` — Job Aggregation
Fetches jobs from 6 sources: JSearch (RapidAPI), Adzuna, Remotive, Remote OK, Arbeitnow, and USAJOBS. Normalizes all job formats into a unified schema with deadline detection.

### `profileService.js` — CV Webpage
CRUD for CV webpage profiles: display name, headline, about, experience, projects, education, skills, certifications, languages, images, theme, section order/visibility, public slug.

### `sendPolicy.js` — Safety Guards
- `assertApprovedApplication(app)` — blocks sending unapproved applications
- `assertDailyLimit(store, channel)` — enforces daily send limit (default 15)
- `incrementDailyUsage(store, channel)` — tracks daily send count

### `cryptoService.js` — Token Encryption
AES-256-GCM encrypt/decrypt for Gmail OAuth tokens stored in the database.

---

## Database

**Engine:** SQLite via `better-sqlite3` with WAL mode
**File:** `backend/data/jobpilot.sqlite` (auto-created on first run)

### Tables

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (clients + owner) |
| `sessions` | Active login sessions (token, userId, lastSeenAt) |
| `resumes` | Uploaded and parsed resumes |
| `profiles` | CV webpage profiles (one per user) |
| `jobs` | All job listings from all providers |
| `applications` | Queued/approved/sent applications |
| `messages` | Sent message records |
| `integrations` | Per-user integration state (Gmail, WhatsApp) |
| `follow_ups` | Scheduled follow-up reminders |
| `inbox_events` | Classified recruiter messages |
| `audit_logs` | Action audit trail (max 250 retained) |
| `daily_usage` | Per-day, per-user, per-channel send counts |
| `meta` | Key-value store for system state (provider status, interview sessions) |

### Key Functions (from `store.js`)

| Function | What it does |
|----------|-------------|
| `ensureStore()` | Creates schema, migrates legacy JSON if needed |
| `readStore()` | Reads all tables → normalized store object |
| `writeStore(store)` | Writes entire store to SQLite in a transaction |
| `updateStore(mutator)` | Atomic read → mutate → write with serialized writes |
| `addAuditLog(action, details)` | Appends audit entry |
| `publicSummary(store, userId)` | Dashboard stats for a user |
| `ownerSummary(store)` | System-wide stats for the owner portal |

---

## Frontend Client App

### Design System
- **Font:** DM Sans (body) + Playfair Display (headings) from Google Fonts
- **Style:** Premium glassmorphism with gold/green accent palette
- **Animations:** Framer Motion with `useReducedMotion()` support throughout
- **Layout:** Fixed sidebar (252px) + scrollable main content with page transitions
- **Responsive:** Mobile hamburger menu, collapsible sidebar, fluid grid layouts

### Key Features
- **Dashboard:** Hero section, 4 metric cards, review queue with approve/send, resume card
- **Job Feed:** Multi-filter search, job cards with match scores, detail modal, batch queue
- **Applications:** Kanban board + table view toggle, AI insight panels, status workflow
- **Career Lab:** 3-tab intelligence hub (funnel analytics, skill gap with learning path, interview simulator with voice dictation)
- **CV Webpage Builder:** Live preview + section editor, 3 templates, image upload, public URL with slug
- **Resume Manager:** Upload PDF/DOCX/TXT, parsed profile display, ATS scoring

### PWA Support
Service worker registered in `main.jsx`, manifest in `public/manifest.webmanifest`.

---

## Admin Portal

Separate React app on port 3001. Owner-only access with dedicated login.

- **Dashboard:** System stats (users, applications, jobs, sessions)
- **Users:** View/manage all client accounts
- **Applications:** Cross-user application overview
- **Activity:** Full audit trail
- **Client Updates:** Send product update emails to opted-in clients

The client app does not link to, serve, or bundle the admin portal. Production owner APIs are disabled unless `ENABLE_OWNER_PORTAL=true`.

---

## Desktop App

Electron wrapper that bundles backend + frontend into a native Windows app.

- Port: `51234` (avoids conflict with dev servers)
- Single-instance lock prevents duplicate windows
- Auto-generates encryption secret per machine
- Owner portal is disabled in desktop mode
- NSIS installer via `electron-builder`

---

## Data Flow

```
Step 1: UPLOAD RESUME
   User → ResumeManager → POST /api/resume/parse
   → resumeService.extractText() → aiService.parseResumeText()
   → Saved to SQLite resumes table

Step 2: SET CAREER GOAL
   User → GoalPage → PUT /api/goal
   → Saved to user preferences (target roles, locations, types)

Step 3: SEARCH JOBS
   User → JobFeed → GET /api/jobs/search
   → jobProviderService fetches from 6 sources
   → jobService.searchJobs() + scoreJobsForResume()
   → Returns sorted by match score with risk levels

Step 4: QUEUE APPLICATIONS
   User selects jobs → POST /api/applications/queue
   → For each job: scoreJobMatch + generateDecisionReport
     + draftOutreach + createFollowUpPlan
   → Saved with status: "pending_review"

Step 5: REVIEW & APPROVE
   User → Dashboard or Applications → POST /api/applications/:id/approve
   → Status: "approved"

Step 6: SEND
   User → POST /api/gmail/send or /api/whatsapp/send
   → sendPolicy: approval check + daily limit check
   → gmailService or whatsappService sends message
   → Status: "applied" (or "sent_demo" in demo mode)
   → Follow-up plan auto-created

Step 7: TRACK RESPONSES
   User → InboxMonitor → POST /api/inbox/classify
   → aiService.classifyInboxMessage()
   → Matching application status auto-updated
     (interview / offer / rejected / follow_up_needed)

Step 8: CAREER INTELLIGENCE
   User → Career Lab → GET /api/career/overview
   → buildFunnelAnalytics: conversion rates from tracked → offer
   → buildSkillGap: demand-weighted missing skills + learning path
   → Interview simulator: 5-question practice with coaching scores
```

---

## Security Design

| Feature | Implementation |
|---------|---------------|
| **Human approval required** | No message sent without explicit `/approve` call |
| **Daily send limits** | Default 15/day — prevents spam |
| **Token encryption** | Gmail OAuth tokens encrypted with AES-256-GCM at rest |
| **Rate limiting** | 500 requests per 15 minutes via `express-rate-limit` |
| **Security headers** | `helmet` sets CSP, HSTS, X-Frame-Options |
| **Demo mode default** | `ENABLE_REAL_SEND=false` — no real sends until explicitly enabled |
| **Scam detection** | AI risk analysis flags suspicious job postings |
| **File validation** | Resume uploads limited to 8 MB, validated by MIME type |
| **CORS protection** | Only configured origins + private LAN IPs allowed |
| **Audit logging** | Every significant action logged (max 250 entries) |
| **Session management** | Token-based sessions with configurable TTL (default 7 days) |
| **Password hashing** | bcrypt for stored passwords |
| **Owner isolation** | Admin APIs disabled unless `ENABLE_OWNER_PORTAL=true` on a dedicated deployment |

---

## Technology Stack

### Backend
| Package | Purpose |
|---------|---------|
| `express` + `express-async-errors` | HTTP server with async error handling |
| `better-sqlite3` | SQLite database with WAL mode |
| `cors`, `helmet`, `express-rate-limit` | Security middleware |
| `multer` | File upload handling |
| `pdf-parse`, `mammoth` | PDF and DOCX text extraction |
| `googleapis` | Gmail OAuth2 and email sending |
| `twilio`, `node-fetch` | WhatsApp via Twilio and Meta Cloud API |
| `@anthropic-ai/sdk` | Optional Claude AI integration |
| `bcryptjs` | Password hashing |
| `uuid` | Unique ID generation |
| `nodemailer` | SMTP email for client updates |
| `dotenv` | Environment variable loading |

### Frontend
| Package | Purpose |
|---------|---------|
| `react` 18 + `react-dom` | UI framework |
| `react-router-dom` v6 | Client-side routing |
| `framer-motion` | Animations with reduce-motion support |
| `lucide-react` | Modern icon library |
| `vite` 8 | Dev server and build tool |

### Desktop
| Package | Purpose |
|---------|---------|
| `electron` 34 | Cross-platform desktop wrapper |
| `electron-builder` | NSIS installer packaging |

---

## NPM Scripts

### From project root
```powershell
npm run dev          # Start backend + frontend + admin-portal simultaneously
npm run build        # Production build of frontend + admin-portal
npm run start        # Start backend in production mode
npm run desktop      # Build frontend + launch Electron app
npm run desktop:install  # Build Windows installer (.exe)
npm run fix:sqlite   # Rebuild better-sqlite3 native module
npm run test         # Run backend regression tests
npm run check        # Run tests + build both React apps
```

---

## LAN Sharing

1. Find your IP: `ipconfig` → look for IPv4 Address (e.g., `192.168.1.105`)
2. Set `FRONTEND_URL=http://192.168.1.105:3000` in `backend/.env`
3. Run `npm run dev`
4. Share URLs: `http://YOUR_IP:3000` (client), `http://YOUR_IP:3001` (admin)

Both Vite dev servers listen on `0.0.0.0` by default. If others can't connect, allow ports 3000/3001/4000 through Windows Firewall.

```powershell
netsh advfirewall firewall add rule name="JobPilot Frontend" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="JobPilot Admin" dir=in action=allow protocol=TCP localport=3001
netsh advfirewall firewall add rule name="JobPilot Backend" dir=in action=allow protocol=TCP localport=4000
```
