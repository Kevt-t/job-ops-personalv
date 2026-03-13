/**
 * Database bootstrap script - creates PostgreSQL tables if they do not exist.
 */

import { Pool } from "pg";
import { buildPoolConfig } from "./config";

const bootstrapSql = `
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'job_ops_now_text'
  ) THEN
    CREATE FUNCTION job_ops_now_text()
    RETURNS TEXT
    LANGUAGE SQL
    STABLE
    AS $fn$
      SELECT to_char(
        timezone('UTC', now()),
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      );
    $fn$;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'jobspy',
  source_job_id TEXT,
  job_url_direct TEXT,
  date_posted TEXT,
  job_type TEXT,
  salary_source TEXT,
  salary_interval TEXT,
  salary_min_amount REAL,
  salary_max_amount REAL,
  salary_currency TEXT,
  is_remote BOOLEAN,
  job_level TEXT,
  job_function TEXT,
  listing_type TEXT,
  emails TEXT,
  company_industry TEXT,
  company_logo TEXT,
  company_url_direct TEXT,
  company_addresses TEXT,
  company_num_employees TEXT,
  company_revenue TEXT,
  company_description TEXT,
  skills TEXT,
  experience_range TEXT,
  company_rating REAL,
  company_reviews_count INTEGER,
  vacancy_count INTEGER,
  work_from_home_type TEXT,
  title TEXT NOT NULL,
  employer TEXT NOT NULL,
  employer_url TEXT,
  job_url TEXT NOT NULL UNIQUE,
  application_link TEXT,
  disciplines TEXT,
  deadline TEXT,
  salary TEXT,
  location TEXT,
  degree_required TEXT,
  starting TEXT,
  job_description TEXT,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered', 'processing', 'ready', 'applied', 'in_progress', 'skipped', 'expired')),
  outcome TEXT CHECK (outcome IN ('offer_accepted', 'offer_declined', 'rejected', 'withdrawn', 'no_response', 'ghosted')),
  closed_at BIGINT,
  suitability_score REAL,
  suitability_reason TEXT,
  tailored_summary TEXT,
  tailored_headline TEXT,
  tailored_skills TEXT,
  selected_project_ids TEXT,
  pdf_path TEXT,
  tracer_links_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sponsor_match_score REAL,
  sponsor_match_names TEXT,
  discovered_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  processed_at TEXT,
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  updated_at TEXT NOT NULL DEFAULT job_ops_now_text()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  jobs_discovered INTEGER NOT NULL DEFAULT 0,
  jobs_processed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  updated_at TEXT NOT NULL DEFAULT job_ops_now_text()
);

CREATE TABLE IF NOT EXISTS stage_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  group_id TEXT,
  from_stage TEXT CHECK (from_stage IN ('applied', 'recruiter_screen', 'assessment', 'hiring_manager_screen', 'technical_interview', 'onsite', 'offer', 'closed')),
  to_stage TEXT NOT NULL CHECK (to_stage IN ('applied', 'recruiter_screen', 'assessment', 'hiring_manager_screen', 'technical_interview', 'onsite', 'offer', 'closed')),
  occurred_at BIGINT NOT NULL,
  metadata JSONB,
  outcome TEXT CHECK (outcome IN ('offer_accepted', 'offer_declined', 'rejected', 'withdrawn', 'no_response', 'ghosted'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prep', 'todo', 'follow_up', 'check_status')),
  title TEXT NOT NULL,
  due_date BIGINT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  scheduled_at BIGINT NOT NULL,
  duration_mins INTEGER,
  type TEXT NOT NULL CHECK (type IN ('recruiter_screen', 'technical', 'onsite', 'panel', 'behavioral', 'final')),
  outcome TEXT CHECK (outcome IN ('pass', 'fail', 'pending', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS job_chat_threads (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  updated_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  last_message_at TEXT
);

CREATE TABLE IF NOT EXISTS job_chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES job_chat_threads(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'partial' CHECK (status IN ('complete', 'partial', 'cancelled', 'failed')),
  tokens_in INTEGER,
  tokens_out INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  replaces_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  updated_at TEXT NOT NULL DEFAULT job_ops_now_text()
);

CREATE TABLE IF NOT EXISTS job_chat_runs (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES job_chat_threads(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
  model TEXT,
  provider TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  updated_at TEXT NOT NULL DEFAULT job_ops_now_text()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'coach')),
  created_at TEXT NOT NULL DEFAULT job_ops_now_text(),
  updated_at TEXT NOT NULL DEFAULT job_ops_now_text()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  created_at TEXT NOT NULL DEFAULT job_ops_now_text()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_discovered_at ON jobs(discovered_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status_discovered_at ON jobs(status, discovered_at);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_stage_events_application_id ON stage_events(application_id);
CREATE INDEX IF NOT EXISTS idx_stage_events_occurred_at ON stage_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_tasks_application_id ON tasks(application_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_job_chat_threads_job_updated ON job_chat_threads(job_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_job_chat_messages_thread_created ON job_chat_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_job_chat_runs_thread_status ON job_chat_runs(thread_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_chat_runs_thread_running_unique
  ON job_chat_runs(thread_id)
  WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

COMMIT;
`;

async function runMigrations() {
  const pool = new Pool(buildPoolConfig());

  try {
    console.log("Running PostgreSQL bootstrap...");
    await pool.query(bootstrapSql);
    console.log("PostgreSQL bootstrap complete.");
  } finally {
    await pool.end();
  }
}

try {
  await runMigrations();
} catch (error) {
  console.error("PostgreSQL bootstrap failed:", error);
  process.exit(1);
}
