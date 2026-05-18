/**
 * Input Schemas for Pomodoro Focus MCP Tools
 *
 * Zod 4 (ZodRawShapeCompat): plain object with Zod fields — NOT z.object().
 * No .default() — handle defaults in handler code (MCP SDK doesn't apply Zod defaults
 * before invoking handlers across all clients consistently).
 *
 * @module schemas/inputs
 */
import * as z from "zod/v4";

// ──────────────────────────────────────────────────────────────────────────
// start_pomodoro
// ──────────────────────────────────────────────────────────────────────────

export const StartPomodoroInput = {
  task: z.string().min(1).max(200)
    .meta({ description: "The task to focus on during this pomodoro." }),
  duration_minutes: z.union([z.literal(15), z.literal(25), z.literal(45), z.literal(50)])
    .optional()
    .meta({ description: "Session length in minutes. Default 25 (classic Pomodoro). Allowed: 15, 25, 45, 50." }),
  session_type: z.enum(["focus", "short_break", "long_break"])
    .optional()
    .meta({ description: "Session category. Default 'focus'. Use 'short_break' (5m) between pomodoros, 'long_break' (15-30m) every 4th." }),
  task_id: z.string().uuid().optional()
    .meta({ description: "Existing task UUID to attach this pomodoro to. Omit to create or reuse a task from the `task` label." }),
};

export interface StartPomodoroParams {
  task: string;
  duration_minutes?: 15 | 25 | 45 | 50;
  session_type?: "focus" | "short_break" | "long_break";
  task_id?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// complete_pomodoro
// ──────────────────────────────────────────────────────────────────────────

export const CompletePomodoroInput = {
  session_id: z.string().uuid()
    .meta({ description: "Session ID returned by start_pomodoro." }),
  distractions_count: z.number().int().min(0).optional()
    .meta({ description: "Number of distractions logged during the session (server auto-derives if omitted)." }),
  notes: z.string().max(500).optional()
    .meta({ description: "Optional reflection on what shipped during the session." }),
};

export interface CompletePomodoroParams {
  session_id: string;
  distractions_count?: number;
  notes?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// log_distraction
// ──────────────────────────────────────────────────────────────────────────

export const LogDistractionInput = {
  session_id: z.string().uuid()
    .meta({ description: "Active session ID." }),
  type: z.enum(["internal", "external"])
    .meta({ description: "internal = stray thought / urge to switch tasks. external = phone, message, person." }),
  description: z.string().min(1).max(200)
    .meta({ description: "Short note about the distraction so it can be reviewed after the session." }),
};

export interface LogDistractionParams {
  session_id: string;
  type: "internal" | "external";
  description: string;
}

// ──────────────────────────────────────────────────────────────────────────
// get_today_status
// ──────────────────────────────────────────────────────────────────────────

export const GetTodayStatusInput = {} as const;

export interface GetTodayStatusParams {}

// ──────────────────────────────────────────────────────────────────────────
// get_session_history
// ──────────────────────────────────────────────────────────────────────────

export const GetSessionHistoryInput = {
  days: z.number().int().min(1).max(30).optional()
    .meta({ description: "Number of days back from today to include. Default 1." }),
  include_distractions: z.boolean().optional()
    .meta({ description: "Whether to inline distraction records into each session. Default true." }),
};

export interface GetSessionHistoryParams {
  days?: number;
  include_distractions?: boolean;
}
