/**
 * MCP Server Factory for Pomodoro Focus — Cloudflare canonical pattern.
 *
 * createServer(env) returns a fresh McpServer per request. The transport layer
 * (createMcpHandler in src/index.ts) handles JSON-RPC dispatch natively via
 * WorkerTransport (Streamable HTTP, March 2025 spec).
 *
 * Auth context (userId, email) is populated by createMcpHandler from the
 * authContext option in src/index.ts; tools access it via getMcpAuthContext().
 */

import type { Env } from "./types";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { getMcpAuthContext } from "agents/mcp";

import { TOOL_METADATA, getToolDescription, type ToolName } from "./tools/descriptions";
import { SERVER_CONFIG } from "./shared/constants";
import { UI_RESOURCES } from "./resources/ui-resources";
import { loadHtml } from "./helpers/assets";
import { SERVER_INSTRUCTIONS } from "./server-instructions";
import { logger } from "./shared/logger";

import {
  StartPomodoroInput, type StartPomodoroParams,
  CompletePomodoroInput, type CompletePomodoroParams,
  LogDistractionInput, type LogDistractionParams,
  GetTodayStatusInput,
  GetSessionHistoryInput, type GetSessionHistoryParams,
} from "./schemas/inputs";

import {
  startSession, completeSession, logDistraction,
  getTodayStatus, getSessionHistory,
} from "./db/queries";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getUserId(): string {
  const auth = getMcpAuthContext();
  const userId = (auth?.props?.userId as string | undefined) ?? "";
  if (!userId) throw new Error("Unauthenticated request — userId missing from auth context");
  return userId;
}

function getUserEmail(): string {
  const auth = getMcpAuthContext();
  return (auth?.props?.email as string | undefined) ?? "";
}

interface ToolErrorResult {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
}

function toolError(message: string): ToolErrorResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

async function runTool<T>(
  toolName: ToolName,
  fn: (userId: string) => Promise<T>,
  toText: (result: T) => string,
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent?: Record<string, unknown>; isError?: true }> {
  const actionId = crypto.randomUUID();
  const startedAt = Date.now();
  let userId = "";
  let userEmail = "";
  try {
    userId = getUserId();
    userEmail = getUserEmail();
    logger.info({
      event: "tool_started",
      tool: toolName,
      user_id: userId,
      user_email: userEmail,
      action_id: actionId,
      args: {},
    });
    const result = await fn(userId);
    logger.info({
      event: "tool_completed",
      tool: toolName,
      user_id: userId,
      user_email: userEmail,
      action_id: actionId,
      duration_ms: Date.now() - startedAt,
    });
    return {
      content: [{ type: "text", text: toText(result) }],
      structuredContent: result as unknown as Record<string, unknown>,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({
      event: "tool_failed",
      tool: toolName,
      error: message,
    });
    return toolError(message);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Server factory — fresh McpServer per request (GHSA-345p-7cg4-v4c7 safe)
// ────────────────────────────────────────────────────────────────────────────

export function createServer(env: Env): McpServer {
  const server = new McpServer(
    { name: SERVER_CONFIG.NAME, version: SERVER_CONFIG.VERSION },
    {
      capabilities: { tools: {}, prompts: { listChanged: true }, resources: { listChanged: true } },
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  const widgetResource = UI_RESOURCES.widget;

  // ──── UI Resource ────────────────────────────────────────────────────────
  server.registerResource(
    "widget",
    widgetResource.uri,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: widgetResource.description,
      _meta: { ui: widgetResource._meta.ui! },
    },
    async () => {
      const templateHTML = await loadHtml(env.ASSETS, "/widget.html");
      return {
        contents: [{
          uri: widgetResource.uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: templateHTML,
          _meta: widgetResource._meta as Record<string, unknown>,
        }],
      };
    },
  );

  // ──── start_pomodoro ─────────────────────────────────────────────────────
  server.registerTool(
    "start_pomodoro",
    {
      title: TOOL_METADATA.start_pomodoro.title,
      description: getToolDescription("start_pomodoro"),
      inputSchema: StartPomodoroInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: widgetResource.uri } },
    },
    async (rawParams) => {
      const p = rawParams as StartPomodoroParams;
      return runTool(
        "start_pomodoro",
        (userId) =>
          startSession(env, userId, {
            task: p.task,
            task_id: p.task_id,
            duration_minutes: p.duration_minutes ?? 25,
            session_type: p.session_type ?? "focus",
          }),
        (r) => `Started: ${r.task} · ${r.duration_minutes}:00 · ${r.today_completed}/${r.today_target} today (streak ${r.current_streak})`,
      );
    },
  );

  // ──── complete_pomodoro ──────────────────────────────────────────────────
  server.registerTool(
    "complete_pomodoro",
    {
      title: TOOL_METADATA.complete_pomodoro.title,
      description: getToolDescription("complete_pomodoro"),
      inputSchema: CompletePomodoroInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: widgetResource.uri } },
    },
    async (rawParams) => {
      const p = rawParams as CompletePomodoroParams;
      return runTool(
        "complete_pomodoro",
        (userId) => completeSession(env, userId, p),
        (r) => {
          const nextLabel = r.suggested_next === "long_break" ? "long break (15-30m)"
            : r.suggested_next === "short_break" ? "short break (5m)"
            : "focus";
          const milestone = r.streak_milestone ? ` · 🔥 streak ${r.current_streak}!` : "";
          return `Completed ${r.today_completed}/${r.today_target} today · next: ${nextLabel}${milestone}`;
        },
      );
    },
  );

  // ──── log_distraction ────────────────────────────────────────────────────
  server.registerTool(
    "log_distraction",
    {
      title: TOOL_METADATA.log_distraction.title,
      description: getToolDescription("log_distraction"),
      inputSchema: LogDistractionInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: widgetResource.uri } },
    },
    async (rawParams) => {
      const p = rawParams as LogDistractionParams;
      return runTool(
        "log_distraction",
        (userId) => logDistraction(env, userId, p),
        (r) => `Logged (${r.session_distraction_count} this session). Back to focus.`,
      );
    },
  );

  // ──── get_today_status ───────────────────────────────────────────────────
  server.registerTool(
    "get_today_status",
    {
      title: TOOL_METADATA.get_today_status.title,
      description: getToolDescription("get_today_status"),
      inputSchema: GetTodayStatusInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: widgetResource.uri } },
    },
    async () =>
      runTool(
        "get_today_status",
        (userId) => getTodayStatus(env, userId),
        (r) => {
          const active = r.active_session ? ` · active: ${r.active_session.task}` : "";
          const streak = r.current_streak >= 3 ? ` · 🔥 ${r.current_streak}` : "";
          return `${r.today_completed}/${r.today_target} pomodoros today${streak}${active}`;
        },
      ),
  );

  // ──── get_session_history ────────────────────────────────────────────────
  server.registerTool(
    "get_session_history",
    {
      title: TOOL_METADATA.get_session_history.title,
      description: getToolDescription("get_session_history"),
      inputSchema: GetSessionHistoryInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: widgetResource.uri } },
    },
    async (rawParams) => {
      const p = rawParams as GetSessionHistoryParams;
      const days = p.days ?? 1;
      const includeDistractions = p.include_distractions ?? true;
      return runTool(
        "get_session_history",
        (userId) => getSessionHistory(env, userId, days, includeDistractions),
        (r) =>
          `Last ${days} day${days === 1 ? "" : "s"}: ${r.totals.completed_sessions} completed, ${r.totals.abandoned_sessions} abandoned, ${r.totals.distraction_count} distractions across ${r.sessions.length} sessions`,
      );
    },
  );

  // ──── Prompts (delegate inference to user's LLM — see PRP §3.5) ──────────
  // Sampling is the spec-defined "server requests inference from client's LLM"
  // primitive, but it's deprecated by SEP-2577 (Final, 2026-04-14) AND no
  // target client (Claude Desktop, Claude.ai, ChatGPT) ever shipped support.
  // Prompts are user-initiated templates — the durable, portable alternative.

  server.registerPrompt(
    "daily-reflection",
    {
      title: "Reflect on today's focus sessions",
      description:
        "Generate an end-of-day reflection on today's pomodoros. The user's LLM reads the session list (via get_session_history) and produces: wins shipped, recurring distraction themes, one concrete tweak for tomorrow.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Reflect on my Pomodoro sessions from today.\n\n" +
              "1. Call the `get_session_history` tool with `days=1, include_distractions=true` to load today's data.\n" +
              "2. Summarise:\n" +
              "   - **Wins**: what completed sessions actually shipped (use session task labels and notes).\n" +
              "   - **Distraction themes**: any recurring patterns in the distraction log (internal vs external, common topics).\n" +
              "   - **One tweak for tomorrow**: a single concrete adjustment (e.g., 'silence Slack notifications during morning focus blocks').\n" +
              "3. Keep the reflection to ~150 words. Be specific, not generic.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "plan-focus-session",
    {
      title: "Break a task into pomodoros",
      description:
        "Help the user estimate how many 25-min pomodoros a task needs. Enforces Cirillo's rule (split if > 7, combine if < 1).",
      argsSchema: {},
    },
    async (args) => {
      const taskDescription = (args && typeof args === "object" && "task_description" in args
        ? String((args as Record<string, unknown>).task_description ?? "")
        : "");
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text:
                `Plan focused work on this task:\n\n"${taskDescription || "(ask the user what task they want to break down)"}"\n\n` +
                "1. Call the `get_today_status` tool to know remaining capacity (today_completed vs today_target).\n" +
                "2. Estimate how many 25-minute pomodoros this task realistically needs. Apply Cirillo's rule:\n" +
                "   - If the estimate is > 7 pomodoros, break the task into smaller sub-tasks (each ≤ 7 pomodoros).\n" +
                "   - If the estimate is < 1 pomodoro, suggest combining with another small task.\n" +
                "3. Return a numbered breakdown: each item with a short label and pomodoro count.\n" +
                "4. Ask the user to confirm before calling `start_pomodoro` on the first item.",
            },
          },
        ],
      };
    },
  );

  return server;
}
