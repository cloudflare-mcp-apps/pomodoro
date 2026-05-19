-- Add abandoned_at column to distinguish user-initiated abandon from
-- auto-completion of expired sessions and from genuine completion.
--
-- Cirillo's rule: an abandoned pomodoro does NOT count toward the daily
-- target or streak — the user explicitly walked away mid-session.
-- Stored separately so daily_stats counts can keep using
-- `completed_at IS NOT NULL` without false positives.

ALTER TABLE pomodoro_sessions ADD COLUMN abandoned_at TEXT;

CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_abandoned
  ON pomodoro_sessions(user_id, abandoned_at);
