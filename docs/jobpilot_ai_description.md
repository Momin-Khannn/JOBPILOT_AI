# JobPilot AI: Project Overview

JobPilot AI is a comprehensive, review-first job application assistant designed to streamline and optimize the job search process. Built with a focus on both end-user functionality and administrative control, it provides a powerful suite of tools to help candidates secure their ideal roles while offering robust management capabilities.

## Core Features

*   **Intelligent CV Parsing & ATS Analysis:** Parses PDF, DOCX, and TXT resumes, providing actionable feedback on Applicant Tracking System (ATS) compatibility and structural integrity.
*   **Customizable Public CV Webpages:** Generates a personalized, public CV link (`/cv/:slug`) for users. These pages are fully customizable, supporting cover images, circular profile photos, colors, templates, privacy controls, and dedicated sections for projects, experience, education, and skills.
*   **Multi-Source Job Discovery:** Aggregates job listings from multiple top-tier platforms including JSearch, Adzuna, Remotive, Remote OK, Arbeitnow, and USAJOBS.
*   **AI-Powered Insights:** Leverages Gemini to provide match scoring against job descriptions, risk checks, decision reports, resume tailoring, and interview coaching.
*   **Review-First Communication:** Facilitates sending applications and communications via Gmail and WhatsApp, enforcing a "review-first" approach with approval workflows and daily limits to maintain high quality standards.
*   **Pro Subscriptions:** Includes Stripe-ready infrastructure for managing premium user subscriptions seamlessly.
*   **Automated Client Updates:** Features a "Software Change Update Agent" that automatically detects codebase changes and sends professional, digested release notes to opted-in users via a configured business email account.

## Architecture & Portals

JobPilot AI is structured to provide secure, isolated experiences for both clients and administrators:

1.  **Client Application:** The primary interface for job seekers to manage their career goals, tailor resumes, find jobs, and send applications. It utilizes Google OAuth for secure sign-in and isolates per-user data to ensure privacy.
2.  **Owner Portal:** A separate, secure interface strictly for administrators. It requires specific owner credentials and handles administrative tasks, client update configurations, and API authorization.

## Technology & Deployment

*   **Monorepo Structure:** The project is organized into distinct frontend, backend, and admin-portal components for modularity and maintainability.
*   **Deployment:** Designed to be easily deployable on platforms like Railway, with distinct configurations for the public client service and the private owner portal.
*   **Local Desktop App:** Includes a Windows desktop package that runs a client-only local backend for standalone usage.

## Objective

JobPilot AI aims to serve as the ultimate copilot for job seekers, combining the breadth of job aggregators with the precision of AI-driven resume tailoring and interview preparation, all integrated into a privacy-focused and user-friendly platform.
