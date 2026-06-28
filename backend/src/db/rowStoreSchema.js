export const ROW_STORE_SCHEMA = 'jobpilot_row'

export const ROW_STORE_SCHEMA_SQL = `
  CREATE SCHEMA IF NOT EXISTS jobpilot_row;

  CREATE TABLE IF NOT EXISTS jobpilot_row.schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS jobpilot_row.snapshot_backups (
    id TEXT PRIMARY KEY,
    source_version BIGINT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS jobpilot_row.users (
    id TEXT PRIMARY KEY,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'client',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS row_users_email_unique
    ON jobpilot_row.users (LOWER(email)) WHERE email IS NOT NULL AND email <> '';
  CREATE INDEX IF NOT EXISTS row_users_role_status
    ON jobpilot_row.users (role, status);

  CREATE TABLE IF NOT EXISTS jobpilot_row.sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_sessions_user
    ON jobpilot_row.sessions (user_id, last_seen_at DESC);
  CREATE INDEX IF NOT EXISTS row_sessions_expiry
    ON jobpilot_row.sessions (expires_at);

  CREATE TABLE IF NOT EXISTS jobpilot_row.resumes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_resumes_user_created
    ON jobpilot_row.resumes (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    slug TEXT UNIQUE,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_profiles_public_slug
    ON jobpilot_row.profiles (slug) WHERE published = TRUE;

  CREATE TABLE IF NOT EXISTS jobpilot_row.jobs (
    id TEXT PRIMARY KEY,
    provider TEXT,
    external_id TEXT,
    deadline_status TEXT,
    is_expired BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS row_jobs_provider_external_unique
    ON jobpilot_row.jobs (provider, external_id)
    WHERE provider IS NOT NULL AND external_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS row_jobs_deadline
    ON jobpilot_row.jobs (deadline_status, is_expired);
  CREATE INDEX IF NOT EXISTS row_jobs_last_seen
    ON jobpilot_row.jobs (last_seen_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    job_id TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_applications_user_status
    ON jobpilot_row.applications (user_id, status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS row_applications_job
    ON jobpilot_row.applications (job_id);

  CREATE TABLE IF NOT EXISTS jobpilot_row.messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    application_id TEXT REFERENCES jobpilot_row.applications(id) ON DELETE SET NULL,
    channel TEXT,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_messages_user_created
    ON jobpilot_row.messages (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.follow_ups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    application_id TEXT REFERENCES jobpilot_row.applications(id) ON DELETE CASCADE,
    status TEXT,
    due_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_follow_ups_user_due
    ON jobpilot_row.follow_ups (user_id, status, due_at);

  CREATE TABLE IF NOT EXISTS jobpilot_row.inbox_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_inbox_events_user_created
    ON jobpilot_row.inbox_events (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.integrations (
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    updated_at TIMESTAMPTZ,
    data JSONB NOT NULL,
    PRIMARY KEY (user_id, provider)
  );
  CREATE INDEX IF NOT EXISTS row_integrations_provider
    ON jobpilot_row.integrations (provider, updated_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_audit_logs_created
    ON jobpilot_row.audit_logs (created_at DESC);
  CREATE INDEX IF NOT EXISTS row_audit_logs_action
    ON jobpilot_row.audit_logs (action);

  CREATE TABLE IF NOT EXISTS jobpilot_row.support_tickets (
    id TEXT PRIMARY KEY,
    type TEXT,
    status TEXT,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_support_tickets_status_created
    ON jobpilot_row.support_tickets (status, type, created_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.analytics_events (
    id TEXT PRIMARY KEY,
    type TEXT,
    name TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_analytics_events_created
    ON jobpilot_row.analytics_events (created_at DESC);
  CREATE INDEX IF NOT EXISTS row_analytics_events_type_name
    ON jobpilot_row.analytics_events (type, name);
  CREATE INDEX IF NOT EXISTS row_analytics_events_session
    ON jobpilot_row.analytics_events (session_id);

  CREATE TABLE IF NOT EXISTS jobpilot_row.job_sync_runs (
    id TEXT PRIMARY KEY,
    provider TEXT,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobpilot_row.interview_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    application_id TEXT REFERENCES jobpilot_row.applications(id) ON DELETE SET NULL,
    status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_interview_sessions_user
    ON jobpilot_row.interview_sessions (user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.billing_events (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES jobpilot_row.users(id) ON DELETE SET NULL,
    type TEXT,
    created_at TIMESTAMPTZ,
    data JSONB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS row_billing_events_user_created
    ON jobpilot_row.billing_events (user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS jobpilot_row.daily_usage (
    day_key TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES jobpilot_row.users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    data JSONB NOT NULL,
    PRIMARY KEY (day_key, user_id, channel)
  );

  CREATE TABLE IF NOT EXISTS jobpilot_row.meta (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO jobpilot_row.schema_migrations (version)
  VALUES (1)
  ON CONFLICT (version) DO NOTHING;
`
