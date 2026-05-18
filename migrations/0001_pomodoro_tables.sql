-- Pomodoro Focus: per-user session, task, distraction, and daily-stats tables.
-- Shares the mcp-oauth D1 database (binding DB) with auth users table.
-- Table names prefixed with pomodoro_ to avoid namespace collision.

CREATE TABLE IF NOT EXISTS pomodoro_tasks (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  label             TEXT NOT NULL,
  planned_pomodoros INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  archived_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_tasks_user_active
  ON pomodoro_tasks(user_id, archived_at);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  task_id          TEXT,
  session_type     TEXT NOT NULL CHECK (session_type IN ('focus','short_break','long_break')),
  duration_minutes INTEGER NOT NULL,
  started_at       TEXT NOT NULL,
  ends_at          TEXT NOT NULL,
  completed_at     TEXT,
  notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_date
  ON pomodoro_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_active
  ON pomodoro_sessions(user_id, completed_at);

CREATE TABLE IF NOT EXISTS pomodoro_distractions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('internal','external')),
  description TEXT NOT NULL,
  logged_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pomodoro_distractions_session
  ON pomodoro_distractions(session_id);

CREATE INDEX IF NOT EXISTS idx_pomodoro_distractions_user_date
  ON pomodoro_distractions(user_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS pomodoro_daily_stats (
  user_id         TEXT NOT NULL,
  date            TEXT NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  streak_day      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
