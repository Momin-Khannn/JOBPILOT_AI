# JobPilot AI v2.0.1: Improvements & Roadmap

This document originally outlined high-impact improvements. Version 2.0.1 now includes the first production implementation of PostgreSQL support, Stripe subscription lifecycle endpoints, Gemini-grounded cover letters, recorded interview analysis, CV identity verification, privacy controls, improved job details, and individualized client-update emails. Gemini Live voice and a permission-safe browser extension remain future work.

## 1. Supercharging Mock Interviews with Gemini (Voice Integration)

Currently, the `CareerLab` mock interview feature uses the browser's native Web Speech API (`SpeechRecognition` and `speechSynthesis`). This can be significantly upgraded using Google's Gemini models.

**Option A: One-Shot Audio Processing**
- **How it works:** Use the browser's `MediaRecorder` API to capture the user's voice answer as an `audio/webm` file. Send this file to the Node.js backend.
- **Integration:** The backend sends the raw audio file to the Gemini 1.5 Pro API. Gemini natively understands audio, meaning it can accurately transcribe the text, analyze the tone, and evaluate the quality of the answer in a single prompt.
- **Benefit:** Bypasses inaccurate browser dictation and allows the AI to judge the user's speaking confidence.

**Option B: Conversational AI (Multimodal Live API)**
- **How it works:** Integrate the new Gemini Multimodal Live API via WebSockets.
- **Integration:** Establish a real-time, bi-directional audio stream between the browser and Gemini.
- **Benefit:** Transforms the mock interview into a realistic, low-latency "phone call" where the AI can interrupt, ask follow-up questions, and respond with incredibly human-like text-to-speech.

## 2. Chrome Extension for 1-Click Job Saves

- **The Problem:** Currently, adding a job to the pipeline requires manual data entry or parsing.
- **The Solution:** Build a lightweight Chrome Extension that activates on job boards like LinkedIn, Indeed, and levels.fyi. 
- **User Flow:** A user clicks "Save to JobPilot". The extension scrapes the job title, company, and description, and hits the `/api/applications/queue` endpoint. The backend instantly queues the AI decision report and drops the job into the Kanban board.

## 3. AI Cover Letter Generator

- **The Problem:** The app successfully tailors resumes, but many roles still require cover letters.
- **The Solution:** Add a new feature alongside "Resume Tailoring" in the `ApplicationInsight` component. 
- **Integration:** Pass the user's base profile and the target job description to the LLM to generate a highly targeted, 3-paragraph cover letter formatted for immediate email delivery.

## 4. Real Stripe Monetization

- **Current State:** The "Upgrade to Pro" button hits a simulated `/api/auth/upgrade` endpoint that instantly flips the user's database tier to `pro`.
- **The Solution:** Integrate Stripe to capture real revenue.
- **Integration:**
  1. Update the frontend "Upgrade" button to redirect to a Stripe Checkout Session.
  2. Create a secure Stripe Webhook endpoint in the Express backend.
  3. When the `checkout.session.completed` event is received, find the user in the database and update their `tier` to `pro`.
  4. Add a "Manage Subscription" button in the Settings menu that opens the Stripe Customer Portal.

## 5. Database Migration (PostgreSQL)

- **Current State:** The application uses a local SQLite file wrapped by `store.js`. This is perfect for an MVP.
- **The Problem:** As the Pro user base scales and background AI tasks run concurrently, SQLite will encounter write-locking bottlenecks.
- **The Solution:** Migrate the data persistence layer to a production-grade relational database like PostgreSQL.
- **Integration:** Introduce an ORM like **Prisma** or **Drizzle** to manage database schemas, migrations, and connection pooling. This will guarantee scalability and data integrity for thousands of concurrent users.
