---
name: firebase-supabase
description: Choose, configure, and integrate Firebase or Supabase for authentication, database storage, realtime updates, files, and student-project backends. Use when comparing Firebase with Supabase, implementing signup/login/logout, connecting frontend CRUD, defining Firestore rules or Supabase Row Level Security, and documenting safe client configuration.
---

# Firebase and Supabase

Recommend the service that best matches the data model and learning goals, then implement the smallest secure integration.

## Choose the Backend First

- Prefer **Supabase** for SQL, relationships, joins, ER diagrams, PostgreSQL learning, or Row Level Security.
- Prefer **Firebase** for document-oriented data, strong offline-first mobile behavior, or an existing Google/Firebase stack.
- Explain the recommendation and trade-offs before implementation. Do not choose only because one service is familiar.

## Integration Workflow

1. Identify authentication methods, entities, relationships, file needs, and realtime needs.
2. Create the backend schema or collection structure before UI integration.
3. Implement signup, login, session handling, and logout.
4. Implement create, read, update, and delete through a small service layer.
5. Add loading, empty, and readable error states.
6. Enforce authorization in backend rules or policies, not only in the UI.
7. Test with two users to prove that private data is isolated.
8. Document dashboard setup, local configuration, and run commands.

## Security Rules

- Never place Firebase Admin credentials or a Supabase `service_role` key in client code.
- Treat Firebase web config and Supabase anonymous/publishable keys as identifiers; backend rules remain the security boundary.
- Store local values outside Git and commit only placeholders such as `.env.example`.
- For Supabase, enable RLS and compare ownership with `auth.uid()`.
- For Firebase, write Firestore/Storage rules that compare the authenticated UID with document ownership.
- Validate important allowed values and relationships in the database where possible.

## README Requirements

Include provider choice, project creation, authentication configuration, schema/rules installation, required keys, run commands, security warning, and troubleshooting steps.
