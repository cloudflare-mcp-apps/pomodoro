/**
 * Widget Types for Pomodoro Focus.
 *
 * Mirror server-side output shapes from src/db/queries.ts.
 */

export type SessionType = "focus" | "short_break" | "long_break";
export type DistractionType = "internal" | "external";

export interface ActiveSession {
  session_id: string;
  task: string;
  task_id: string | null;
  started_at: string;
  ends_at: string;
  duration_minutes: number;
  session_type: SessionType;
}

export interface TaskItem {
  id: string;
  label: string;
  planned_pomodoros: number;
  completed_pomodoros: number;
}

export interface TodayStatus {
  active_session: ActiveSession | null;
  today_completed: number;
  today_target: number;
  current_streak: number;
  tasks: TaskItem[];
  distractions_today: number;
}

export interface StartPomodoroResult {
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

export interface CompletePomodoroResult {
  session_id: string;
  today_completed: number;
  today_target: number;
  current_streak: number;
  suggested_next: SessionType;
  streak_milestone: boolean;
}

export interface LogDistractionResult {
  distraction_id: string;
  session_distraction_count: number;
  parked_items: Array<{
    id: string;
    session_id: string;
    type: DistractionType;
    description: string;
    logged_at: string;
  }>;
}

/** Widget state persisted via window.openai.setWidgetState. */
export interface PersistedWidgetState {
  active_session_id: string | null;
  active_ends_at: string | null;
  last_hydrated_at: string;
}
