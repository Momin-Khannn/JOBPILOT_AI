# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose

StudyFlow is a mobile-first task management application for university students. It helps students record academic work, select deadlines and priorities, track progress, and review workload from one dashboard.

### 1.2 Scope

Version 1.0 includes email/password authentication and private CRUD operations for tasks. It does not include team sharing, notifications, timetable synchronization, or AI recommendations. Keeping those features out makes this version appropriate for a beginner-to-intermediate university project.

### 1.3 Intended audience

- University student using the application
- Lecturer or examiner reviewing the project
- Student developer maintaining the repository

### 1.4 Definitions

- **CRUD:** Create, read, update, and delete.
- **RLS:** Row Level Security, database rules that protect each user's rows.
- **Supabase Auth:** Managed authentication service used for account creation and sessions.

## 2. Overall description

### 2.1 Product perspective

The Flutter application is the client. Supabase provides authentication, PostgreSQL storage, and realtime database changes. The app accesses Supabase through its public anonymous key; RLS remains responsible for authorization.

### 2.2 User class

The only user role in version 1.0 is **Student**. A student can register, authenticate, and manage only their own tasks.

### 2.3 Operating environment

- Flutter 3.x and Dart 3.x
- Android/iOS mobile device or emulator
- Optional Flutter web/desktop runner
- Internet connection
- Supabase cloud project

### 2.4 Constraints

- Email/password is the only login method.
- The application requires a Supabase URL and publishable/anonymous key.
- Due dates store a calendar date, not a time or timezone.
- Each task has one priority and one status.

### 2.5 Assumptions

- Supabase is available.
- The user has a valid email address.
- The device clock is reasonably accurate.

## 3. System features

### 3.1 Account management

The system validates signup/login fields, creates a Supabase Auth account, creates a related public user profile through a database trigger, maintains the session, and supports sign out.

### 3.2 Task management

Authenticated users create, view, edit, delete, filter, and complete tasks. Delete actions require confirmation. The dashboard updates through a realtime stream.

### 3.3 Dashboard summary

The dashboard displays pending, in-progress, and completed totals. It clearly shows overdue tasks and allows status filtering.

## 4. External interface requirements

### 4.1 User interface

- Login screen
- Signup screen
- Dashboard screen
- Add/edit task screen
- Confirmation dialog and error snackbars

### 4.2 Software interface

The `supabase_flutter` package communicates with Supabase Auth, PostgREST, PostgreSQL RLS, and Realtime.

### 4.3 Database interface

The app reads and writes `public.tasks`. `public.users` is populated by a trigger linked to `auth.users`.

## 5. Security requirements

- Passwords are handled by Supabase Auth and never stored in `public.users`.
- RLS is enabled for `public.users` and `public.tasks`.
- Every task policy compares `user_id` with `auth.uid()`.
- The Supabase service-role key must never be placed in the Flutter app.

## 6. Future improvements

- Local/offline cache
- Push deadline reminders
- Course/category labels
- Search and sorting
- Calendar view
- Optional analytics of completion patterns
