# JobPilot AI — File Map

> Every source file, where it lives, and what it does.
> Last updated: 2026-06-19

---

## Root

| File | Purpose |
|------|---------|
| `package.json` | Monorepo root — npm workspaces, dev/build/start/desktop scripts |
| `README.md` | Project overview, setup, credentials, provider config |
| `FILE_MAP.md` | This file — locates every file and describes its function |
| `PROJECT_DOCS.md` | Full up-to-date technical documentation |

---

## Backend — `backend/`

### Entry & Config

| File | Purpose |
|------|---------|
| `src/index.js` | Express server entry — mounts all routes, CORS, helmet, rate-limit, static serving |
| `src/env.js` | Loads `dotenv` for environment variables |
| `.env` / `.env.example` | Environment config (ports, API keys, OAuth secrets, send mode) |
| `package.json` | Backend dependencies and scripts (`dev`, `start`, `test`) |

### Routes — `backend/src/routes/`

| File | Mount Point | Purpose |
|------|------------|---------|
| `auth.js` | `/api/auth` | Register, login, Google OAuth, forgot/reset password, session management |
| `admin.js` | `/api/admin` | Owner-only portal: user list, application overview, activity logs |
| `ai.js` | `/api/ai` | AI endpoints: decision reports, resume tailoring, interview prep |
| `applications.js` | `/api/applications` | Queue, list, approve, update, send applications |
| `career.js` | `/api/career` | Career Lab: funnel analytics, skill gap, interview simulator |
| `clientUpdates.js` | `/api/admin/client-updates` | Owner tool to send product update emails to clients |
| `followups.js` | `/api/followups` | Schedule, list, update follow-up reminders |
| `gmail.js` | `/api/gmail` | Gmail OAuth flow, connection status, send approved emails |
| `goal.js` | `/api/goal` | Get/save career goal (target roles, locations, job types) |
| `inbox.js` | `/api/inbox` | List inbox events, classify recruiter messages |
| `jobs.js` | `/api/jobs` | Search/filter jobs, refresh job data, manual job entry |
| `profile.js` | `/api/profile` | CV webpage builder: get/save profile, upload images, public slug |
| `resume.js` | `/api/resume` | Upload and parse PDF/DOCX/TXT resumes |
| `settings.js` | `/api/settings` | User preferences: daily limits, blacklists, target roles |
| `whatsapp.js` | `/api/whatsapp` | WhatsApp status, provider config, send approved messages |

### Services — `backend/src/services/`

| File | Purpose |
|------|---------|
| `aiService.js` | Core AI logic: resume parsing, job scoring, risk analysis, outreach drafting, decision reports, inbox classification |
| `authService.js` | User creation, password hashing, Google OAuth user resolution, seed users, role management |
| `careerService.js` | Funnel analytics builder, skill gap analysis, interview question generation, answer evaluation |
| `clientUpdateAgentService.js` | Sends product/application update emails to opted-in clients via SMTP |
| `cryptoService.js` | AES-256-GCM encryption/decryption for OAuth tokens at rest |
| `emailService.js` | SMTP email sending (business Gmail for client updates) |
| `gmailService.js` | Gmail API wrapper: OAuth URL, token exchange, email sending |
| `googleAuthService.js` | Google OAuth2 client setup, ID token verification, user info fetch |
| `jobProviderService.js` | Multi-source job aggregation: JSearch, Adzuna, Remotive, Remote OK, Arbeitnow, USAJOBS |
| `jobService.js` | Job filtering, scoring against resume, blacklist enforcement |
| `profileService.js` | CV webpage profile CRUD: create/update, image upload, slug management, public read |
| `resumeService.js` | PDF text extraction (pdf-parse), DOCX extraction (mammoth), file validation |
| `sendPolicy.js` | Approval guards + daily send limit enforcement |
| `softwareChangeUpdateAgentService.js` | Watches codebase for changes, sends digest emails to opted-in clients |
| `whatsappService.js` | WhatsApp sending via Twilio or Meta Cloud API |

### Database — `backend/src/db/`

| File | Purpose |
|------|---------|
| `store.js` | SQLite database (better-sqlite3): schema creation, read/write/update, audit logs, summaries |
| `seed.js` | Demo seed data: sample jobs with realistic data for development |

### Middleware — `backend/src/middleware/`

| File | Purpose |
|------|---------|
| `auth.js` | Session token validation, user lookup, owner role check |

### Data — `backend/data/`

| File | Purpose |
|------|---------|
| `jobpilot.sqlite` | SQLite database file (auto-created on first run) |

---

## Frontend (Client App) — `frontend/`

### Entry & Config

| File | Purpose |
|------|---------|
| `index.html` | HTML shell with meta tags, manifest link, root div |
| `vite.config.js` | Vite dev server config (port 3000, host 0.0.0.0) |
| `package.json` | Frontend dependencies (React, Framer Motion, Lucide) |
| `src/main.jsx` | React entry: BrowserRouter, StrictMode, service worker registration |
| `src/App.jsx` | Route definitions: auth flow, protected layout, all page routes |
| `src/styles.css` | Global CSS: premium design system, all component styles (~4000 lines) |
| `src/marketing.css` | Landing page / marketing section styles |

### API Client — `frontend/src/api/`

| File | Purpose |
|------|---------|
| `client.js` | Centralized fetch wrapper with 35+ API methods, session token management |

### Components — `frontend/src/components/`

| File | Purpose |
|------|---------|
| `Layout.jsx` | App shell: sidebar navigation (3 groups), topbar, settings drawer, page transitions |
| `ApplicationInsight.jsx` | 4-panel AI insight card: decision, resume tailoring, company research, interview prep |
| `CvProfileView.jsx` | LinkedIn-style CV renderer: cover photo, avatar, sections, templates, social layout |
| `JobCard.jsx` | Job listing card: title, company, match score, risk, deadline, selection toggle |
| `MetricCard.jsx` | Dashboard stat card with tone-based color, icon, hover animation |
| `StatusBadge.jsx` | Color-coded status badge (pending_review, approved, applied, interview, etc.) |

### Pages — `frontend/src/pages/`

| File | Route | Purpose |
|------|-------|---------|
| `Landing.jsx` | `/` | Marketing page: hero, capabilities grid, workflow steps, CTA |
| `LoginPage.jsx` | `/login` | Email/password + Google OAuth login |
| `SignupPage.jsx` | `/signup` | New user registration |
| `ForgotPasswordPage.jsx` | `/forgot-password` | Password reset email request |
| `ResetPasswordPage.jsx` | `/reset-password` | Set new password from reset token |
| `GoogleAuthCallback.jsx` | `/auth/google/callback` | Handles Google OAuth redirect |
| `PublicCvPage.jsx` | `/cv/:slug` | Public-facing CV webpage (no auth required) |
| `Dashboard.jsx` | `/dashboard` | Command center: hero, metrics, review queue, resume card |
| `GoalPage.jsx` | `/goal` | Career goal setup: target roles, locations, job types, salary |
| `JobFeed.jsx` | `/jobs` | Job search with filters, match scores, queue selection, detail modal |
| `ResumeManager.jsx` | `/resume` | Upload PDF/DOCX/TXT, view parsed profile and ATS score |
| `ProfileBuilder.jsx` | `/profile` | CV webpage builder: live preview + section editor |
| `Applications.jsx` | `/applications` | Kanban board + table view, approve/send/follow-up actions |
| `CareerLab.jsx` | `/career-lab` | 3-tab career intelligence: funnel analytics, skill gap, interview simulator |
| `FollowUps.jsx` | `/followups` | Scheduled follow-up list with complete/reschedule actions |
| `InboxMonitor.jsx` | `/inbox` | Paste recruiter emails to classify intent |
| `GmailSetup.jsx` | `/gmail` | Gmail OAuth connection status and setup |
| `WhatsAppSetup.jsx` | `/whatsapp` | WhatsApp provider configuration (Twilio/Meta) |
| `Settings.jsx` | `/settings` | User profile, preferences, daily limits, blacklists |

### Public Assets — `frontend/public/`

| File | Purpose |
|------|---------|
| `sw.js` | Service worker for PWA offline caching |
| `manifest.webmanifest` | PWA manifest (app name, icons, theme) |
| `icon.svg` | App icon |

---

## Admin Portal (Owner Dashboard) — `admin-portal/`

### Entry & Config

| File | Purpose |
|------|---------|
| `src/main.jsx` | React entry for admin portal |
| `src/App.jsx` | Admin route definitions: login, dashboard, users, applications, activity, client updates |
| `src/styles.css` | Admin portal styles |
| `vite.config.js` | Vite config (port 3001) |
| `package.json` | Admin portal dependencies |

### API Client — `admin-portal/src/api/`

| File | Purpose |
|------|---------|
| `client.js` | Admin API wrapper with owner-specific methods |

### Components — `admin-portal/src/components/`

| File | Purpose |
|------|---------|
| `AdminLayout.jsx` | Admin shell: sidebar, topbar, outlet |

### Pages — `admin-portal/src/pages/`

| File | Route | Purpose |
|------|-------|---------|
| `LoginPage.jsx` | `/` , `/login` | Owner login (email + password) |
| `DashboardPage.jsx` | `/dashboard` | System-wide stats: users, applications, jobs, sessions |
| `UsersPage.jsx` | `/users` | View all registered client accounts |
| `ApplicationsPage.jsx` | `/applications` | All applications across all users |
| `ActivityPage.jsx` | `/activity` | Audit trail of every system action |
| `ClientUpdatesPage.jsx` | `/client-updates` | Send product updates to opted-in clients |

---

## Desktop App (Electron) — `desktop/`

| File | Purpose |
|------|---------|
| `main.mjs` | Electron main process: window creation, backend lifecycle, single-instance lock |
| `prepare-pack.mjs` | Build script: copies backend + frontend dist into `pack/` for electron-builder |
| `package.json` | Electron + electron-builder config, NSIS installer settings |
| `README.md` | Desktop-specific setup and troubleshooting |
| `pack/` | Bundled app resources for installer packaging |

---

## Test Files — `backend/test/`

| File | Purpose |
|------|---------|
| `careerService.test.js` | Unit tests for career service (funnel, skill gap, interview evaluation) |
