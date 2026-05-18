/**
 * Tool Descriptions and Metadata for Pomodoro Focus.
 *
 * Centralized metadata. 4-part description pattern:
 *   Purpose -> Returns -> Use Case -> Constraints
 *
 * @module tools/descriptions
 */

export interface ToolMetadata {
  title: string;
  description: {
    part1_purpose: string;
    part2_returns: string;
    part3_useCase: string;
    part4_constraints: string;
  };
  examples: { scenario: string; description: string }[];
}

export const TOOL_METADATA = {
  start_pomodoro: {
    title: "Start a Pomodoro session",
    description: {
      part1_purpose:
        "Begin a focused work session anchored to a specific task and persist it server-side so the widget timer survives chat refreshes.",
      part2_returns:
        "Returns session_id, started_at and ends_at timestamps, today's completed count and target, and the current daily streak.",
      part3_useCase:
        "Use when the user says 'start a pomodoro', 'begin a focus session', or 'let's work on X for 25 minutes'.",
      part4_constraints:
        "Default duration is 25 minutes (allowed: 15, 25, 45, 50). Default session_type is 'focus'. Rejects if another focus session is already running — call complete_pomodoro first.",
    },
    examples: [
      { scenario: "Start classic 25-min focus", description: "Run with just `task` to start a 25-min focus pomodoro." },
      { scenario: "Resume work on existing task", description: "Pass `task_id` to attach this pomodoro to a task the user already started." },
    ],
  } as const satisfies ToolMetadata,

  complete_pomodoro: {
    title: "Complete the active Pomodoro",
    description: {
      part1_purpose:
        "Mark the active pomodoro as completed and roll the daily counter, streak, and per-task progress forward.",
      part2_returns:
        "Returns updated today_completed, current_streak, suggested_next ('short_break' | 'long_break' | 'focus'), and streak_milestone flag if a new streak day was reached.",
      part3_useCase:
        "Use when the widget timer reaches zero, or the user says 'done', 'finished', 'completed'.",
      part4_constraints:
        "Idempotent on session_id — calling twice does not double-count. Long-break suggestion fires on every 4th completed focus session.",
    },
    examples: [
      { scenario: "Timer hit zero", description: "Widget auto-calls this when the local countdown reaches 0:00." },
      { scenario: "Manual finish", description: "User confirms the session shipped — call before the widget timer expires." },
    ],
  } as const satisfies ToolMetadata,

  log_distraction: {
    title: "Log a distraction without breaking focus",
    description: {
      part1_purpose:
        "Capture an interruption mid-session (internal thought or external event) following Cirillo's 'inventory' rule — write it down so the mind can release it and return to focus.",
      part2_returns:
        "Returns distraction_id, session_distraction_count, and parked_items (all distractions logged in this session, oldest first).",
      part3_useCase:
        "Use when the user mentions getting interrupted, having a stray thought, or wanting to 'park' something for later.",
      part4_constraints:
        "Description is limited to 200 characters — keep it short, the point is to release the thought, not solve it. Logging a distraction does NOT pause or stop the session.",
    },
    examples: [
      { scenario: "Stray thought (internal)", description: "User says 'I just thought I should reply to Jane' — log type=internal." },
      { scenario: "Phone buzz (external)", description: "User got a Slack ping — log type=external, do not break focus." },
    ],
  } as const satisfies ToolMetadata,

  get_today_status: {
    title: "Get today's Pomodoro dashboard",
    description: {
      part1_purpose:
        "Fetch today's pomodoro dashboard: active session (if any), completed count, target, streak, task backlog with per-task progress dots.",
      part2_returns:
        "Returns active_session (or null), today_completed, today_target, current_streak, tasks[] with planned vs completed pomodoros, and distractions_today count.",
      part3_useCase:
        "Use when the widget mounts, on resume, or when the user asks 'how's my day going' / 'what's left'.",
      part4_constraints:
        "No parameters. Returns the most recent 10 active (non-archived) tasks. UTC-based 'today' in v1.0; multi-timezone is a v1.1 concern.",
    },
    examples: [
      { scenario: "Widget hydration", description: "Widget calls this on mount to populate the timer ring and task list." },
      { scenario: "Status check", description: "User asks 'how's my day going' — call this to summarise." },
    ],
  } as const satisfies ToolMetadata,

  get_session_history: {
    title: "Retrieve recent Pomodoro session history",
    description: {
      part1_purpose:
        "Retrieve recent session records (tasks, durations, distractions, completion flags) so the conversation LLM can spot patterns.",
      part2_returns:
        "Returns sessions[] with started_at, task, duration, completed flag, and distractions[]; plus totals (focus_minutes, completed_sessions, abandoned_sessions, distraction_count).",
      part3_useCase:
        "Use when generating the daily-reflection or plan-focus-session prompt, or when the user asks about their focus patterns.",
      part4_constraints:
        "Window: 1-30 days back from today. include_distractions defaults to true. Sessions ordered by started_at DESC.",
    },
    examples: [
      { scenario: "Daily reflection", description: "Called by the daily-reflection prompt to feed today's sessions into the user's LLM." },
      { scenario: "Pattern question", description: "User asks 'when do I get most distracted?' — pull 7 days, look at distractions[]." },
    ],
  } as const satisfies ToolMetadata,
} as const;

export type ToolName = keyof typeof TOOL_METADATA;

export function getToolDescription(toolName: ToolName): string {
  const meta = TOOL_METADATA[toolName];
  const { part1_purpose, part2_returns, part3_useCase, part4_constraints } = meta.description;
  return `${part1_purpose} ${part2_returns} ${part3_useCase} ${part4_constraints}`;
}

export function getToolExamples(toolName: ToolName): readonly { scenario: string; description: string }[] {
  return TOOL_METADATA[toolName].examples;
}
