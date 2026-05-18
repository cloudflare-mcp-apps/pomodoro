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
  StartPomodoroOutput, CompletePomodoroOutput, LogDistractionOutput,
  GetTodayStatusOutput, GetSessionHistoryOutput,
} from "./schemas/outputs";

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
      outputSchema: StartPomodoroOutput,
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
        (r) => `Rozpoczęto: ${r.task} · ${r.duration_minutes}:00 · ${r.today_completed}/${r.today_target} dzisiaj (passa ${r.current_streak})`,
      );
    },
  );

  // ──── complete_pomodoro ──────────────────────────────────────────────────
  // Intentionally NO `_meta.ui.resourceUri`: this is a side-effect tool, not a
  // "show me the widget" action. Rendering it would stack a second widget when
  // the model chains complete → start. The existing widget instance still
  // receives ontoolresult (host broadcasts every result to the loaded widget)
  // and refreshes its state via get_today_status.
  server.registerTool(
    "complete_pomodoro",
    {
      title: TOOL_METADATA.complete_pomodoro.title,
      description: getToolDescription("complete_pomodoro"),
      inputSchema: CompletePomodoroInput,
      outputSchema: CompletePomodoroOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (rawParams) => {
      const p = rawParams as CompletePomodoroParams;
      return runTool(
        "complete_pomodoro",
        (userId) => completeSession(env, userId, p),
        (r) => {
          const nextLabel = r.suggested_next === "long_break" ? "długa przerwa (15-30 min)"
            : r.suggested_next === "short_break" ? "krótka przerwa (5 min)"
            : "skupienie";
          const milestone = r.streak_milestone ? ` · 🔥 passa ${r.current_streak}!` : "";
          return `Ukończono ${r.today_completed}/${r.today_target} dzisiaj · następnie: ${nextLabel}${milestone}`;
        },
      );
    },
  );

  // ──── log_distraction ────────────────────────────────────────────────────
  // No `_meta.ui.resourceUri` — same reasoning as complete_pomodoro. Logging a
  // distraction is text-only confirmation; the existing widget refreshes via
  // get_today_status (called directly from the widget's modal submit handler).
  server.registerTool(
    "log_distraction",
    {
      title: TOOL_METADATA.log_distraction.title,
      description: getToolDescription("log_distraction"),
      inputSchema: LogDistractionInput,
      outputSchema: LogDistractionOutput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (rawParams) => {
      const p = rawParams as LogDistractionParams;
      return runTool(
        "log_distraction",
        (userId) => logDistraction(env, userId, p),
        (r) => `Zapisano (${r.session_distraction_count} w tej sesji). Wracaj do pracy.`,
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
      outputSchema: GetTodayStatusOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: widgetResource.uri } },
    },
    async () =>
      runTool(
        "get_today_status",
        (userId) => getTodayStatus(env, userId),
        (r) => {
          const active = r.active_session ? ` · aktywne: ${r.active_session.task}` : "";
          const streak = r.current_streak >= 3 ? ` · 🔥 ${r.current_streak}` : "";
          return `${r.today_completed}/${r.today_target} pomodoro dzisiaj${streak}${active}`;
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
      outputSchema: GetSessionHistoryOutput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      // No `_meta.ui.resourceUri` — analytical data for the LLM to summarise in
      // text (or via the daily-reflection prompt). The dashboard widget is for
      // current state, not history.
    },
    async (rawParams) => {
      const p = rawParams as GetSessionHistoryParams;
      const days = p.days ?? 1;
      const includeDistractions = p.include_distractions ?? true;
      return runTool(
        "get_session_history",
        (userId) => getSessionHistory(env, userId, days, includeDistractions),
        (r) => {
          const dayLabel = days === 1 ? "dzień" : days < 5 ? "dni" : "dni";
          return `Ostatnie ${days} ${dayLabel}: ${r.totals.completed_sessions} ukończonych, ${r.totals.abandoned_sessions} przerwanych, ${r.totals.distraction_count} rozproszeń w ${r.sessions.length} sesjach`;
        },
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
      title: "Refleksja na koniec dnia",
      description:
        "Wygeneruj podsumowanie dzisiejszych sesji Pomodoro. LLM użytkownika czyta historię sesji (przez get_session_history) i zwraca: co zostało zrobione, powtarzające się rozproszenia, jedną zmianę na jutro.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Podsumuj moje dzisiejsze sesje Pomodoro.\n\n" +
              "1. Wywołaj narzędzie `get_session_history` z parametrami `days=1, include_distractions=true`, aby załadować dzisiejsze dane.\n" +
              "2. Przygotuj zwięzłe podsumowanie:\n" +
              "   - **Sukcesy**: co konkretnie zostało zrobione w ukończonych sesjach (użyj etykiet zadań i notatek).\n" +
              "   - **Wzorce rozproszeń**: jakie powtarzające się tematy widać w logu rozproszeń (wewnętrzne vs zewnętrzne).\n" +
              "   - **Jedna zmiana na jutro**: jedna konkretna rzecz do poprawy (np. „wyciszyć Slack rano podczas bloków skupienia\").\n" +
              "3. Trzymaj się ~150 słów. Bądź konkretny, unikaj ogólników.\n" +
              "4. Odpowiedz po polsku.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "plan-focus-session",
    {
      title: "Rozbij zadanie na pomodora",
      description:
        "Pomóż użytkownikowi oszacować, ile 25-minutowych pomodora potrzebuje dane zadanie. Wymusza regułę Cirillo (podziel jeśli > 7, połącz jeśli < 1).",
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
                `Zaplanuj skupioną pracę nad zadaniem:\n\n"${taskDescription || "(zapytaj użytkownika, jakie zadanie chce rozbić)"}"\n\n` +
                "1. Wywołaj narzędzie `get_today_status`, by poznać pozostałą pojemność dnia (today_completed vs today_target).\n" +
                "2. Oszacuj, ile 25-minutowych pomodora realnie potrzeba na to zadanie. Zastosuj regułę Cirillo:\n" +
                "   - Jeśli > 7 pomodora → rozbij zadanie na mniejsze (każde ≤ 7 pomodora).\n" +
                "   - Jeśli < 1 pomodoro → zasugeruj połączenie z innym małym zadaniem.\n" +
                "3. Zwróć ponumerowaną listę: krótka etykieta + liczba pomodora dla każdego elementu.\n" +
                "4. Poproś użytkownika o potwierdzenie, zanim wywołasz `start_pomodoro` na pierwszym elemencie.\n" +
                "5. Odpowiedz po polsku.",
            },
          },
        ],
      };
    },
  );

  return server;
}
