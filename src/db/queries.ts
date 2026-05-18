/**
 * D1 query layer for Pomodoro Focus.
 *
 * All queries are parameterized (D1 prepared statements) and pivot on user_id.
 * "Today" is computed in UTC for v1.0 — multi-timezone is a v1.1 concern.
 */
import type { Env } from "../types";

export type SessionType = "focus" | "short_break" | "long_break";
export type DistractionType = "internal" | "external";

const DEFAULT_TODAY_TARGET = 8;

// ──────────────────────────────────────────────────────────────────────────
// Types — DB row shapes
// ──────────────────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: string;
  task_id: string | null;
  session_type: SessionType;
  duration_minutes: number;
  started_at: string;
  ends_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface TaskRow {
  id: string;
  user_id: string;
  label: string;
  planned_pomodoros: number;
  created_at: string;
  archived_at: string | null;
}

export interface DistractionRow {
  id: string;
  session_id: string;
  user_id: string;
  type: DistractionType;
  description: string;
  logged_at: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

function utcYesterday(now: Date = new Date()): string {
  const y = new Date(now);
  y.setUTCDate(y.getUTCDate() - 1);
  return y.toISOString().slice(0, 10);
}

function isoNow(): string {
  return new Date().toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// ──────────────────────────────────────────────────────────────────────────
// Task lookup / creation
// ──────────────────────────────────────────────────────────────────────────

export async function getOrCreateTask(
  env: Env,
  userId: string,
  label: string,
): Promise<TaskRow> {
  const existing = await env.DB.prepare(
    `SELECT id, user_id, label, planned_pomodoros, created_at, archived_at
     FROM pomodoro_tasks
     WHERE user_id = ? AND label = ? AND archived_at IS NULL
     LIMIT 1`,
  ).bind(userId, label).first<TaskRow>();
  if (existing) return existing;

  const id = crypto.randomUUID();
  const createdAt = isoNow();
  await env.DB.prepare(
    `INSERT INTO pomodoro_tasks (id, user_id, label, planned_pomodoros, created_at)
     VALUES (?, ?, ?, 1, ?)`,
  ).bind(id, userId, label, createdAt).run();
  return { id, user_id: userId, label, planned_pomodoros: 1, created_at: createdAt, archived_at: null };
}

async function getTaskById(env: Env, userId: string, taskId: string): Promise<TaskRow | null> {
  return env.DB.prepare(
    `SELECT id, user_id, label, planned_pomodoros, created_at, archived_at
     FROM pomodoro_tasks
     WHERE id = ? AND user_id = ?`,
  ).bind(taskId, userId).first<TaskRow>();
}

async function bumpTaskPlannedIfNeeded(env: Env, userId: string, taskId: string): Promise<void> {
  // Auto-increment planned_pomodoros if completed already meets/exceeds it.
  // Keeps the per-task progress dots growing as the user runs more sessions on a task.
  const row = await env.DB.prepare(
    `SELECT t.planned_pomodoros,
            (SELECT COUNT(*) FROM pomodoro_sessions s
             WHERE s.task_id = t.id AND s.user_id = t.user_id
               AND s.session_type = 'focus' AND s.completed_at IS NOT NULL) AS completed
     FROM pomodoro_tasks t
     WHERE t.id = ? AND t.user_id = ?`,
  ).bind(taskId, userId).first<{ planned_pomodoros: number; completed: number }>();
  if (row && row.completed >= row.planned_pomodoros) {
    await env.DB.prepare(
      `UPDATE pomodoro_tasks SET planned_pomodoros = ? WHERE id = ? AND user_id = ?`,
    ).bind(row.completed + 1, taskId, userId).run();
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sessions
// ──────────────────────────────────────────────────────────────────────────

async function getActiveSession(env: Env, userId: string): Promise<SessionRow | null> {
  return env.DB.prepare(
    `SELECT id, user_id, task_id, session_type, duration_minutes, started_at, ends_at, completed_at, notes
     FROM pomodoro_sessions
     WHERE user_id = ? AND completed_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
  ).bind(userId).first<SessionRow>();
}

export interface StartSessionInput {
  task: string;
  task_id?: string;
  duration_minutes: number;
  session_type: SessionType;
}

export interface StartSessionResult {
  session_id: string;
  task: string;
  task_id: string;
  started_at: string;
  ends_at: string;
  session_type: SessionType;
  duration_minutes: number;
  today_completed: number;
  today_target: number;
  current_streak: number;
}

export async function startSession(
  env: Env,
  userId: string,
  input: StartSessionInput,
): Promise<StartSessionResult> {
  // Reject if focus session already running (force explicit completion per PRP §5).
  if (input.session_type === "focus") {
    const active = await getActiveSession(env, userId);
    if (active && active.session_type === "focus") {
      throw new Error(
        `Active focus session already in progress (id=${active.id}). Complete or abandon it before starting a new one.`,
      );
    }
  }

  let taskRow: TaskRow;
  if (input.task_id) {
    const existing = await getTaskById(env, userId, input.task_id);
    if (!existing) throw new Error(`Task not found: ${input.task_id}`);
    taskRow = existing;
  } else {
    taskRow = await getOrCreateTask(env, userId, input.task);
  }

  const sessionId = crypto.randomUUID();
  const startedAt = isoNow();
  const endsAt = addMinutes(startedAt, input.duration_minutes);

  await env.DB.prepare(
    `INSERT INTO pomodoro_sessions
       (id, user_id, task_id, session_type, duration_minutes, started_at, ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(sessionId, userId, taskRow.id, input.session_type, input.duration_minutes, startedAt, endsAt).run();

  const stats = await readDailyStats(env, userId, utcToday());
  return {
    session_id: sessionId,
    task: taskRow.label,
    task_id: taskRow.id,
    started_at: startedAt,
    ends_at: endsAt,
    session_type: input.session_type,
    duration_minutes: input.duration_minutes,
    today_completed: stats.completed,
    today_target: DEFAULT_TODAY_TARGET,
    current_streak: stats.streak,
  };
}

export interface CompleteSessionInput {
  session_id: string;
  distractions_count?: number;
  notes?: string;
}

export interface CompleteSessionResult {
  session_id: string;
  today_completed: number;
  today_target: number;
  current_streak: number;
  suggested_next: SessionType;
  streak_milestone: boolean;
}

export async function completeSession(
  env: Env,
  userId: string,
  input: CompleteSessionInput,
): Promise<CompleteSessionResult> {
  const row = await env.DB.prepare(
    `SELECT id, user_id, task_id, session_type, duration_minutes, started_at, ends_at, completed_at, notes
     FROM pomodoro_sessions
     WHERE id = ? AND user_id = ?`,
  ).bind(input.session_id, userId).first<SessionRow>();

  if (!row) throw new Error(`Session not found: ${input.session_id}`);

  const previousStreak = (await readDailyStats(env, userId, utcToday())).streak;

  if (!row.completed_at) {
    await env.DB.prepare(
      `UPDATE pomodoro_sessions
       SET completed_at = ?, notes = COALESCE(?, notes)
       WHERE id = ? AND user_id = ? AND completed_at IS NULL`,
    ).bind(isoNow(), input.notes ?? null, input.session_id, userId).run();

    if (row.session_type === "focus") {
      await recomputeDailyStats(env, userId, utcToday());
      if (row.task_id) await bumpTaskPlannedIfNeeded(env, userId, row.task_id);
    }
  }
  // Idempotent: if already completed, we just re-read stats below.

  const stats = await readDailyStats(env, userId, utcToday());
  const suggestedNext: SessionType = row.session_type === "focus"
    ? (stats.completed > 0 && stats.completed % 4 === 0 ? "long_break" : "short_break")
    : "focus";

  return {
    session_id: input.session_id,
    today_completed: stats.completed,
    today_target: DEFAULT_TODAY_TARGET,
    current_streak: stats.streak,
    suggested_next: suggestedNext,
    streak_milestone: stats.streak > previousStreak,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Distractions
// ──────────────────────────────────────────────────────────────────────────

export interface LogDistractionInput {
  session_id: string;
  type: DistractionType;
  description: string;
}

export interface LogDistractionResult {
  distraction_id: string;
  session_distraction_count: number;
  parked_items: DistractionRow[];
}

export async function logDistraction(
  env: Env,
  userId: string,
  input: LogDistractionInput,
): Promise<LogDistractionResult> {
  // Verify session belongs to user (avoid silent cross-user writes).
  const owned = await env.DB.prepare(
    `SELECT id FROM pomodoro_sessions WHERE id = ? AND user_id = ?`,
  ).bind(input.session_id, userId).first<{ id: string }>();
  if (!owned) throw new Error(`Session not found: ${input.session_id}`);

  const id = crypto.randomUUID();
  const loggedAt = isoNow();
  await env.DB.prepare(
    `INSERT INTO pomodoro_distractions (id, session_id, user_id, type, description, logged_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(id, input.session_id, userId, input.type, input.description, loggedAt).run();

  const all = await env.DB.prepare(
    `SELECT id, session_id, user_id, type, description, logged_at
     FROM pomodoro_distractions
     WHERE session_id = ? AND user_id = ?
     ORDER BY logged_at ASC`,
  ).bind(input.session_id, userId).all<DistractionRow>();

  const parked = all.results ?? [];
  return {
    distraction_id: id,
    session_distraction_count: parked.length,
    parked_items: parked,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Today status (widget hydration)
// ──────────────────────────────────────────────────────────────────────────

export interface TodayStatusResult {
  active_session: {
    session_id: string;
    task: string;
    task_id: string | null;
    started_at: string;
    ends_at: string;
    duration_minutes: number;
    session_type: SessionType;
  } | null;
  today_completed: number;
  today_target: number;
  current_streak: number;
  tasks: Array<{
    id: string;
    label: string;
    planned_pomodoros: number;
    completed_pomodoros: number;
  }>;
  distractions_today: number;
}

export async function getTodayStatus(env: Env, userId: string): Promise<TodayStatusResult> {
  const today = utcToday();
  const stats = await readDailyStats(env, userId, today);

  const active = await getActiveSession(env, userId);
  let activeWithTask: TodayStatusResult["active_session"] = null;
  if (active) {
    const label = active.task_id
      ? (await getTaskById(env, userId, active.task_id))?.label ?? "(unknown task)"
      : "(break)";
    activeWithTask = {
      session_id: active.id,
      task: label,
      task_id: active.task_id,
      started_at: active.started_at,
      ends_at: active.ends_at,
      duration_minutes: active.duration_minutes,
      session_type: active.session_type,
    };
  }

  const tasksRes = await env.DB.prepare(
    `SELECT t.id, t.label, t.planned_pomodoros,
            COUNT(s.id) AS completed_pomodoros
     FROM pomodoro_tasks t
     LEFT JOIN pomodoro_sessions s
       ON s.task_id = t.id
      AND s.user_id = t.user_id
      AND s.session_type = 'focus'
      AND s.completed_at IS NOT NULL
     WHERE t.user_id = ? AND t.archived_at IS NULL
     GROUP BY t.id
     ORDER BY t.created_at DESC
     LIMIT 10`,
  ).bind(userId).all<{ id: string; label: string; planned_pomodoros: number; completed_pomodoros: number }>();

  const distractionsRes = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM pomodoro_distractions WHERE user_id = ? AND logged_at >= ?`,
  ).bind(userId, `${today}T00:00:00.000Z`).first<{ n: number }>();

  return {
    active_session: activeWithTask,
    today_completed: stats.completed,
    today_target: DEFAULT_TODAY_TARGET,
    current_streak: stats.streak,
    tasks: (tasksRes.results ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      planned_pomodoros: t.planned_pomodoros,
      completed_pomodoros: t.completed_pomodoros,
    })),
    distractions_today: distractionsRes?.n ?? 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Session history
// ──────────────────────────────────────────────────────────────────────────

export interface SessionHistoryResult {
  sessions: Array<{
    session_id: string;
    started_at: string;
    task: string;
    session_type: SessionType;
    duration_minutes: number;
    completed: boolean;
    distractions: DistractionRow[];
  }>;
  totals: {
    focus_minutes: number;
    completed_sessions: number;
    abandoned_sessions: number;
    distraction_count: number;
  };
}

export async function getSessionHistory(
  env: Env,
  userId: string,
  days: number,
  includeDistractions: boolean,
): Promise<SessionHistoryResult> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  cutoff.setUTCHours(0, 0, 0, 0);

  const rows = await env.DB.prepare(
    `SELECT s.id, s.task_id, s.session_type, s.duration_minutes,
            s.started_at, s.completed_at, t.label AS task_label
     FROM pomodoro_sessions s
     LEFT JOIN pomodoro_tasks t ON t.id = s.task_id AND t.user_id = s.user_id
     WHERE s.user_id = ? AND s.started_at >= ?
     ORDER BY s.started_at DESC`,
  ).bind(userId, cutoff.toISOString()).all<{
    id: string; task_id: string | null; session_type: SessionType; duration_minutes: number;
    started_at: string; completed_at: string | null; task_label: string | null;
  }>();

  const sessions = rows.results ?? [];
  const sessionIds = sessions.map((s) => s.id);

  let distractionsBySession = new Map<string, DistractionRow[]>();
  if (includeDistractions && sessionIds.length > 0) {
    const placeholders = sessionIds.map(() => "?").join(",");
    const distractionsRes = await env.DB.prepare(
      `SELECT id, session_id, user_id, type, description, logged_at
       FROM pomodoro_distractions
       WHERE user_id = ? AND session_id IN (${placeholders})
       ORDER BY logged_at ASC`,
    ).bind(userId, ...sessionIds).all<DistractionRow>();
    for (const d of distractionsRes.results ?? []) {
      const list = distractionsBySession.get(d.session_id) ?? [];
      list.push(d);
      distractionsBySession.set(d.session_id, list);
    }
  }

  let focusMinutes = 0;
  let completed = 0;
  let abandoned = 0;
  let distractionCount = 0;
  const out = sessions.map((s) => {
    const isCompleted = s.completed_at !== null;
    if (s.session_type === "focus" && isCompleted) {
      focusMinutes += s.duration_minutes;
      completed += 1;
    } else if (s.session_type === "focus" && !isCompleted) {
      abandoned += 1;
    }
    const distractions = distractionsBySession.get(s.id) ?? [];
    distractionCount += distractions.length;
    return {
      session_id: s.id,
      started_at: s.started_at,
      task: s.task_label ?? "(no task)",
      session_type: s.session_type,
      duration_minutes: s.duration_minutes,
      completed: isCompleted,
      distractions,
    };
  });

  return {
    sessions: out,
    totals: {
      focus_minutes: focusMinutes,
      completed_sessions: completed,
      abandoned_sessions: abandoned,
      distraction_count: distractionCount,
    },
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Daily stats (streak computation)
// ──────────────────────────────────────────────────────────────────────────

async function readDailyStats(
  env: Env,
  userId: string,
  date: string,
): Promise<{ completed: number; streak: number }> {
  const row = await env.DB.prepare(
    `SELECT completed_count, streak_day FROM pomodoro_daily_stats
     WHERE user_id = ? AND date = ?`,
  ).bind(userId, date).first<{ completed_count: number; streak_day: number }>();
  if (row) return { completed: row.completed_count, streak: row.streak_day };

  // If today's row is missing, the current streak ends on yesterday (if any).
  const yRow = await env.DB.prepare(
    `SELECT streak_day FROM pomodoro_daily_stats WHERE user_id = ? AND date = ?`,
  ).bind(userId, utcYesterday(new Date(`${date}T00:00:00.000Z`))).first<{ streak_day: number }>();
  return { completed: 0, streak: yRow?.streak_day ?? 0 };
}

async function recomputeDailyStats(env: Env, userId: string, date: string): Promise<void> {
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM pomodoro_sessions
     WHERE user_id = ? AND session_type = 'focus'
       AND completed_at IS NOT NULL
       AND substr(completed_at, 1, 10) = ?`,
  ).bind(userId, date).first<{ n: number }>();

  const completedToday = today?.n ?? 0;

  let streak = 0;
  if (completedToday > 0) {
    const yRow = await env.DB.prepare(
      `SELECT streak_day FROM pomodoro_daily_stats
       WHERE user_id = ? AND date = ?`,
    ).bind(userId, utcYesterday(new Date(`${date}T00:00:00.000Z`))).first<{ streak_day: number }>();
    streak = (yRow?.streak_day ?? 0) + 1;
  }

  await env.DB.prepare(
    `INSERT INTO pomodoro_daily_stats (user_id, date, completed_count, streak_day)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET completed_count = excluded.completed_count, streak_day = excluded.streak_day`,
  ).bind(userId, date, completedToday, streak).run();
}
