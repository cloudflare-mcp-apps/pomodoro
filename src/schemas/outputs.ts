/**
 * Output schemas for Pomodoro Focus tools.
 *
 * Same ZodRawShapeCompat convention as inputs.ts — plain object with Zod
 * fields, passed directly to `outputSchema:` on registerTool. The SDK
 * validates structuredContent against these.
 *
 * Reference: opensky, ads-roi `/src/server.ts` use the same pattern.
 *
 * @module schemas/outputs
 */
import * as z from "zod/v4";

const SessionType = z.enum(["focus", "short_break", "long_break"]);
const DistractionType = z.enum(["internal", "external"]);

// ──────────────────────────────────────────────────────────────────────────
// start_pomodoro
// ──────────────────────────────────────────────────────────────────────────

export const StartPomodoroOutput = {
  session_id: z.string().uuid().meta({ description: "Server-issued session handle. Pass to complete_pomodoro / log_distraction." }),
  task: z.string().meta({ description: "Task label this session is anchored to." }),
  task_id: z.string().uuid().meta({ description: "Task UUID — reuse for subsequent pomodoros on the same task." }),
  started_at: z.string().meta({ description: "Session start, ISO 8601 (UTC)." }),
  ends_at: z.string().meta({ description: "Session target end, ISO 8601 (UTC) — authoritative for the widget countdown." }),
  session_type: SessionType.meta({ description: "Session category." }),
  duration_minutes: z.number().int().meta({ description: "Session length in minutes." }),
  today_completed: z.number().int().meta({ description: "Total completed focus pomodoros today (UTC)." }),
  today_target: z.number().int().meta({ description: "Daily target (default 8)." }),
  current_streak: z.number().int().meta({ description: "Days in a row with at least one completed focus session." }),
};

// ──────────────────────────────────────────────────────────────────────────
// complete_pomodoro
// ──────────────────────────────────────────────────────────────────────────

export const CompletePomodoroOutput = {
  session_id: z.string().uuid().meta({ description: "Echo of the completed session ID." }),
  today_completed: z.number().int().meta({ description: "Updated count of completed focus pomodoros today." }),
  today_target: z.number().int().meta({ description: "Daily target (default 8)." }),
  current_streak: z.number().int().meta({ description: "Updated streak (may increment if this was the first completion today)." }),
  suggested_next: SessionType.meta({ description: "Suggested next session type (long_break every 4th, short_break otherwise, focus after a break)." }),
  streak_milestone: z.boolean().meta({ description: "True if current_streak grew with this completion." }),
};

// ──────────────────────────────────────────────────────────────────────────
// log_distraction
// ──────────────────────────────────────────────────────────────────────────

const DistractionRecord = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  user_id: z.string(),
  type: DistractionType,
  description: z.string(),
  logged_at: z.string(),
}).meta({ description: "Distraction inventory entry." });

export const LogDistractionOutput = {
  distraction_id: z.string().uuid().meta({ description: "ID of the newly logged distraction." }),
  session_distraction_count: z.number().int().meta({ description: "Running count of distractions logged in this session." }),
  parked_items: z.array(DistractionRecord).meta({ description: "All distractions for this session, oldest first." }),
};

// ──────────────────────────────────────────────────────────────────────────
// get_today_status
// ──────────────────────────────────────────────────────────────────────────

const ActiveSessionShape = z.object({
  session_id: z.string().uuid(),
  task: z.string(),
  task_id: z.string().nullable(),
  started_at: z.string(),
  ends_at: z.string(),
  duration_minutes: z.number().int(),
  session_type: SessionType,
}).meta({ description: "Currently running session (if any)." });

const TaskItem = z.object({
  id: z.string().uuid(),
  label: z.string(),
  planned_pomodoros: z.number().int(),
  completed_pomodoros: z.number().int(),
}).meta({ description: "Task with per-task pomodoro progress." });

export const GetTodayStatusOutput = {
  active_session: ActiveSessionShape.nullable().meta({ description: "Null when no session is in progress." }),
  today_completed: z.number().int().meta({ description: "Completed focus pomodoros today (UTC)." }),
  today_target: z.number().int().meta({ description: "Daily target (default 8)." }),
  current_streak: z.number().int().meta({ description: "Days in a row with at least one completion." }),
  tasks: z.array(TaskItem).meta({ description: "Up to 10 most recent active tasks." }),
  distractions_today: z.number().int().meta({ description: "Distraction count across all sessions today." }),
};

// ──────────────────────────────────────────────────────────────────────────
// get_session_history
// ──────────────────────────────────────────────────────────────────────────

const HistorySession = z.object({
  session_id: z.string().uuid(),
  started_at: z.string(),
  task: z.string(),
  session_type: SessionType,
  duration_minutes: z.number().int(),
  completed: z.boolean(),
  distractions: z.array(DistractionRecord),
}).meta({ description: "One historical session with inline distractions." });

const HistoryTotals = z.object({
  focus_minutes: z.number().int().meta({ description: "Total focus minutes in the window (completed sessions only)." }),
  completed_sessions: z.number().int(),
  abandoned_sessions: z.number().int(),
  distraction_count: z.number().int(),
}).meta({ description: "Aggregated totals across the window." });

export const GetSessionHistoryOutput = {
  sessions: z.array(HistorySession).meta({ description: "Sessions in the window, started_at DESC." }),
  totals: HistoryTotals,
};
