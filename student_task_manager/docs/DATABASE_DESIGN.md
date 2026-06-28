# Database Design

## Why PostgreSQL/Supabase?

This project has structured data and a clear relationship: one user owns many tasks. PostgreSQL represents that relationship directly with primary and foreign keys. It also demonstrates SQL, constraints, indexes, triggers, and security policies—useful portfolio skills for a Data Science student.

## Table: `public.users`

Supabase already has a protected `auth.users` table for passwords and login details. Our public table stores only application profile data.

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `id` | UUID | Primary key, foreign key to `auth.users.id` | Same identity as the authenticated account |
| `full_name` | VARCHAR(100) | Required | Student's display name |
| `email` | TEXT | Required | Student's email for display/reference |
| `created_at` | TIMESTAMPTZ | Defaults to current time | Profile creation time |

## Table: `public.tasks`

| Column | Type | Rule | Meaning |
|---|---|---|---|
| `id` | UUID | Primary key | Unique task identifier |
| `user_id` | UUID | Foreign key to `public.users.id` | Task owner |
| `title` | VARCHAR(120) | Required, non-empty | Short task name |
| `description` | VARCHAR(1000) | Required, default empty | Optional detail stored as an empty string when absent |
| `due_date` | DATE | Required | Calendar deadline |
| `priority` | VARCHAR(10) | `low`, `medium`, or `high` | Importance |
| `status` | VARCHAR(20) | `pending`, `in_progress`, or `completed` | Workflow state |
| `created_at` | TIMESTAMPTZ | Automatic | Creation time |
| `updated_at` | TIMESTAMPTZ | Updated by trigger | Last modification time |

## Relationship

`users (1) ──── owns ──── (many) tasks`

- A user can have zero or many tasks.
- A task must have exactly one user.
- `ON DELETE CASCADE` removes a user's public profile and tasks if the Auth account is deleted.

## Normalization

The design is in a simple third-normal-form shape:

1. Each column stores one value.
2. Every task column describes the task identified by `id`.
3. User profile data is stored once in `users`, not repeated in every task.

Priority and status use checked text values instead of lookup tables to keep a university MVP easy to understand. A larger product could move them to reference tables.

## Indexes

- `tasks_user_id_index` speeds up ownership filtering.
- `tasks_user_due_date_index` helps list one user's tasks in due-date order.

## Security

Row Level Security policies require `auth.uid() = user_id` for all task operations. The mobile app may contain the public anonymous key, but it cannot bypass these policies. Never put the Supabase service-role key in a mobile application.
