/**
 * Tool Descriptions and Metadata for Pomodoro Focus.
 *
 * Description style follows industry MCP guide:
 *   - verb + resource, 1-2 sentences max
 *   - front-load the most important information
 *   - DO NOT duplicate the outputSchema (returns belong there)
 *   - DO NOT include implementation details (persistence, polling, etc.)
 *   - DO include workflow constraints + cross-tool disambiguation
 *
 * The 4-part structure (Purpose / Returns / Use Case / Constraints) is kept
 * for internal documentation and any downstream tooling, but
 * `getToolDescription()` concatenates only `part1_purpose` + `part4_constraints`
 * — the agent-actionable parts. Returns are covered by outputSchema (added
 * 2026-05-19); use cases for ambiguous routing live in server-instructions.ts
 * §Usage Patterns.
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
      part1_purpose: "Start a focused Pomodoro session anchored to a task.",
      part2_returns: "Returns the session handle (session_id), end timestamp, today's running total, and current streak — see outputSchema.",
      part3_useCase: "Invoke when the user wants to begin focused work on a specific task.",
      part4_constraints: "Rejects if a focus session is already active — call complete_pomodoro first. Allowed durations: 15, 25, 45, 50 min (default 25).",
    },
    examples: [
      { scenario: "Start classic 25-min focus", description: "Run with just `task` to start a 25-min focus pomodoro." },
      { scenario: "Resume work on existing task", description: "Pass `task_id` to attach this pomodoro to a task the user already started." },
    ],
  } as const satisfies ToolMetadata,

  complete_pomodoro: {
    title: "Complete the active Pomodoro",
    description: {
      part1_purpose: "Mark a Pomodoro session as completed and roll the streak forward.",
      part2_returns: "Returns updated daily totals plus `suggested_next` (short_break / long_break / focus) — see outputSchema.",
      part3_useCase: "Invoke when the widget timer reaches zero or the user confirms the session shipped.",
      part4_constraints: "Idempotent on session_id — calling twice does not double-count. Long break is suggested every 4th completed focus session.",
    },
    examples: [
      { scenario: "Timer hit zero", description: "Widget auto-calls this when the local countdown reaches 0:00." },
      { scenario: "Manual finish", description: "User confirms the session shipped before the timer expires." },
    ],
  } as const satisfies ToolMetadata,

  log_distraction: {
    title: "Log a distraction without breaking focus",
    description: {
      part1_purpose: "Log a distraction (internal thought or external event) during the active session.",
      part2_returns: "Returns the session's full distraction inventory ordered oldest-first — see outputSchema.",
      part3_useCase: "Invoke when the user mentions an interruption mid-session.",
      part4_constraints: "Does NOT pause or stop the session — that defeats Cirillo's 'inventory' rule. Description capped at 200 chars; keep it short.",
    },
    examples: [
      { scenario: "Stray thought (internal)", description: "User says 'I just thought I should reply to Jane' — log type=internal." },
      { scenario: "Phone buzz (external)", description: "User got a Slack ping — log type=external, do not break focus." },
    ],
  } as const satisfies ToolMetadata,

  get_today_status: {
    title: "Get today's Pomodoro dashboard",
    description: {
      part1_purpose: "Get today's Pomodoro dashboard: active session, completed count, streak, and per-task progress.",
      part2_returns: "Returns the full payload the widget renders on load — see outputSchema.",
      part3_useCase: "Invoke when the widget mounts, on resume, or when the user asks about today's progress.",
      part4_constraints: "No parameters. UTC-based 'today' in v1.0 — flag if the user's local midnight differs.",
    },
    examples: [
      { scenario: "Widget hydration", description: "Widget calls this on mount to populate the timer ring and task list." },
      { scenario: "Status check", description: "User asks 'how's my day going' — call this to summarise." },
    ],
  } as const satisfies ToolMetadata,

  get_session_history: {
    title: "List recent Pomodoro sessions",
    description: {
      part1_purpose: "List Pomodoro sessions from the last N days (1-30) for pattern analysis.",
      part2_returns: "Returns sessions ordered started_at DESC plus aggregated totals — see outputSchema.",
      part3_useCase: "Invoke when the user asks about focus patterns over time.",
      part4_constraints: "For end-of-day reflection, prefer the `daily-reflection` prompt — it pulls the data automatically and frames the LLM's analysis.",
    },
    examples: [
      { scenario: "Daily reflection", description: "Called by the daily-reflection prompt to feed today's sessions into the user's LLM." },
      { scenario: "Pattern question", description: "User asks 'when do I get most distracted?' — pull 7 days, look at distractions[]." },
    ],
  } as const satisfies ToolMetadata,
} as const;

export type ToolName = keyof typeof TOOL_METADATA;

/**
 * Concatenates the agent-actionable parts: purpose + constraints.
 * `part2_returns` is intentionally dropped — covered by outputSchema.
 * `part3_useCase` is intentionally dropped — covered by server-instructions
 * Usage Patterns section, which has cross-tool routing context the description
 * shouldn't duplicate.
 */
export function getToolDescription(toolName: ToolName): string {
  const meta = TOOL_METADATA[toolName];
  return `${meta.description.part1_purpose} ${meta.description.part4_constraints}`;
}

export function getToolExamples(toolName: ToolName): readonly { scenario: string; description: string }[] {
  return TOOL_METADATA[toolName].examples;
}
