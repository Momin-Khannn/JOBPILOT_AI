# StudyFlow — Student Task Management App

A clean Flutter portfolio project that helps university students organize assignments, study goals, and deadlines. StudyFlow demonstrates mobile UI development, Supabase authentication, PostgreSQL design, realtime CRUD, Row Level Security, testing, and software-engineering documentation.

## Why Supabase?

Supabase is the best fit for this project because its PostgreSQL database makes the one-user-to-many-tasks relationship clear. It also lets the portfolio demonstrate SQL tables, foreign keys, constraints, indexes, triggers, and Row Level Security. Firebase is an excellent mobile backend, but its document database is less useful for this project's relational database and ER-diagram learning goals.

## Features

- Email/password signup, login, session handling, and logout
- Private student profile created automatically after signup
- Create, read, update, and delete tasks
- Title, description, due date, priority, and status for every task
- Pending, in-progress, and completed dashboard totals
- Status filter and overdue-task indicator
- Realtime task updates from Supabase
- Confirmation before deletion
- Form validation and basic network/database error handling
- Responsive mobile, tablet, and web layout
- PostgreSQL Row Level Security so users see only their own rows
- Unit/widget tests and university-ready project documentation
- A simple GitHub Actions workflow for formatting, analysis, and tests

## Technology

- Flutter and Dart
- Supabase Auth
- Supabase PostgreSQL, PostgREST, Realtime, and RLS
- Material 3
- `flutter_test`

## Architecture

```text
Screens and widgets
        ↓
AuthService / TaskService
        ↓
Supabase Auth + PostgreSQL
        ↓
Row Level Security policies
```

The project intentionally avoids complex state-management or code-generation packages. A realtime `StreamBuilder` is enough for this beginner-to-intermediate scope.

## Project structure

```text
lib/
├── main.dart
├── app.dart
├── config/             # Supabase run-time configuration
├── core/               # Constants, theme, friendly errors
├── models/             # StudentTask and enums
├── services/           # Authentication and task database calls
├── screens/            # Login, signup, dashboard, task form
└── widgets/            # Reusable task and summary components
supabase/schema.sql      # Complete PostgreSQL setup
docs/                    # SRS, requirements, diagrams, tests, file guide
test/                    # Automated unit and widget tests
```

Read [docs/FILE_GUIDE.md](docs/FILE_GUIDE.md) for an easy explanation of every hand-written file.

## Prerequisites

1. Install Flutter 3.32 or newer with Dart 3.8 or newer from the official [Flutter installation guide](https://docs.flutter.dev/get-started/install).
2. Install Android Studio (Android) or Xcode (iOS/macOS).
3. Create a free [Supabase](https://supabase.com/) account.
4. Confirm the setup:

```bash
flutter doctor
flutter devices
```

## First-time project setup

This repository was authored in an environment without the Flutter SDK. Generate the standard platform runner folders once:

```bash
cd student_task_manager
flutter create .
flutter pub get
```

If your operating system cannot generate every platform, list only the platforms you need. For example:

```bash
flutter create . --platforms=android,web
```

## Supabase setup

1. Create a new Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. Copy and run all SQL from [`supabase/schema.sql`](supabase/schema.sql).
4. Open **Project Settings → API**.
5. Copy the project URL and the public anonymous/publishable key.
6. In **Authentication → URL Configuration**, add your local web URL if you run Flutter web.

The application must use only the public anonymous/publishable key. Never place a `service_role` key in a Flutter app.

## Run commands

### PowerShell

```powershell
flutter pub get
flutter run `
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co `
  --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

### macOS/Linux shell

```bash
flutter pub get
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

### Choose a device

```bash
flutter devices
flutter run -d chrome --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_KEY
flutter run -d android --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_KEY
```

The exact Android device ID may be different; use the value printed by `flutter devices`.

## Quality commands

```bash
dart format .
flutter analyze
flutter test
flutter test --coverage
```

## Production build commands

```bash
# Android APK
flutter build apk --release --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_KEY

# Android App Bundle
flutter build appbundle --release --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_KEY

# Web
flutter build web --release --dart-define=SUPABASE_URL=YOUR_URL --dart-define=SUPABASE_ANON_KEY=YOUR_KEY
```

## Database summary

- Supabase `auth.users` stores authentication identities and password hashes.
- `public.users` stores safe profile information.
- `public.tasks` stores task data and references `public.users.id`.
- One user can own many tasks.
- RLS compares each row's `user_id` with the logged-in `auth.uid()`.

See [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) and [DIAGRAMS.md](docs/DIAGRAMS.md) for the ER and class models.

## Documentation

- [Software Requirements Specification](docs/SRS.md)
- [Functional and non-functional requirements](docs/REQUIREMENTS.md)
- [Database design](docs/DATABASE_DESIGN.md)
- [Use case, ER, and class diagrams](docs/DIAGRAMS.md)
- [Test cases](docs/TEST_CASES.md)
- [File-by-file explanation](docs/FILE_GUIDE.md)

## Suggested Git/GitHub workflow

```bash
git init
git add .
git commit -m "feat: build student task management app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/student-task-manager.git
git push -u origin main
```

For later work, create focused branches:

```bash
git switch -c feature/task-reminders
# make and test changes
git add .
git commit -m "feat: add task reminders"
git push -u origin feature/task-reminders
```

## Portfolio demonstration checklist

- Add screenshots of login, dashboard, add task, and completed task states.
- Record a short demo: signup → add → edit → complete → delete.
- Show the Supabase table relationship and RLS policies without exposing keys.
- Include `flutter test` and `flutter analyze` output in your university report.
- Explain one future improvement and its trade-offs during presentation.

## Future improvements

- Deadline notifications
- Course/category labels
- Search and sorting
- Calendar view
- Offline cache
- Simple completion analytics

These are intentionally outside version 1.0 so the current project remains understandable and complete.

## License

This project is available under the MIT License. See [LICENSE](LICENSE).
