---
generator: /describe-server
generated: 2026-05-25
source_commit: 091da442
depends_on: [snapshot.md]
---

# MCP Server Description Report: Pomodoro Focus

Generated: 2026-05-25
Source: projects/pomodoro/

---

## 1. SERVER IDENTITY

- **Server name:** `Pomodoro Focus` (from `SERVER_CONFIG.NAME` in `src/shared/constants.ts`)
- **Version:** `1.0.0` (from `package.json`)
- **One-sentence purpose:** Per-user focused-work session tracker implementing the Pomodoro Technique — start timed sessions anchored to tasks, log mid-session distractions without breaking focus, and receive LLM-coached daily reflection with streak tracking.
- **Live URL / domain:** `https://pomodoro.wtyczki.ai` (custom domain, `workers_dev: false`)
- **Authentication method:** OAuth 2.1 (WorkOS AuthKit JWT Bearer only — no API key path)
- **Language:** Bilingual — LLM-facing tool descriptions and schema in **English**; all runtime output (`content[]` text), widget UI strings, elicitation prompts, and prompt titles in **Polish**. Server instructions explicitly direct: `"Respond in Polish unless the user switches."`

---

## 2. TOOLS — DETAILED

### Tool: `start_pomodoro`

- **Title:** Start a Pomodoro session
- **Description (verbatim):** "Start a focused Pomodoro session anchored to a task. Rejects if a focus session is already active — call complete_pomodoro first. Allowed durations: 15, 25, 45, 50 min (default 25)."
- **Input parameters:**

  | Parameter | Type | Required | Default | Constraints | Description |
  |-----------|------|----------|---------|-------------|-------------|
  | `task` | string | yes | — | min 1, max 200 chars | The task to focus on during this pomodoro. |
  | `duration_minutes` | 15 \| 25 \| 45 \| 50 | no | 25 (in handler) | literal union | Session length in minutes. |
  | `session_type` | "focus" \| "short_break" \| "long_break" | no | "focus" (in handler) | enum | Session category. |
  | `task_id` | string (UUID) | no | — | UUID format | Existing task UUID to attach this pomodoro to. |

- **Output structure:** `session_id` (UUID handle), `task` (label), `task_id` (UUID for reuse), `started_at` (ISO 8601 UTC), `ends_at` (authoritative countdown end, ISO 8601 UTC), `session_type`, `duration_minutes`, `today_completed` (focus count today), `today_target` (default 8), `current_streak` (days in a row)
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`
- **Widget linked:** yes — `_meta: { ui: { resourceUri: "ui://pomodoro/widget" } }`
- **Example invocation:** "Start a 25-minute Pomodoro on writing the report." / "Zacznij pomodoro na pisanie raportu."

---

### Tool: `complete_pomodoro`

- **Title:** Complete the active Pomodoro
- **Description (verbatim):** "Mark a Pomodoro session as completed and roll the streak forward. Idempotent on session_id — calling twice does not double-count. Long break is suggested every 4th completed focus session."
- **Input parameters:**

  | Parameter | Type | Required | Default | Constraints | Description |
  |-----------|------|----------|---------|-------------|-------------|
  | `session_id` | string (UUID) | yes | — | UUID format | Session ID returned by start_pomodoro. |
  | `distractions_count` | integer | no | auto-derived | min 0 | Number of distractions logged (server derives if omitted). |
  | `notes` | string | no | — | max 500 chars | Optional reflection on what shipped during the session. |

- **Output structure:** `session_id` (echo), `today_completed`, `today_target`, `current_streak` (updated), `suggested_next` ("short_break" / "long_break" / "focus"), `streak_milestone` (boolean — true if streak grew)
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`
- **Widget linked:** no (intentional — side-effect tool; widget state refreshed via `start_pomodoro` or `get_today_status`)
- **Example invocation:** "I finished my session." / "Timer hit zero on the active pomodoro."

---

### Tool: `log_distraction`

- **Title:** Log a distraction without breaking focus
- **Description (verbatim):** "Log a distraction (internal thought or external event) during the active session. Does NOT pause or stop the session — that defeats Cirillo's 'inventory' rule. Description capped at 200 chars; keep it short."
- **Input parameters:**

  | Parameter | Type | Required | Default | Constraints | Description |
  |-----------|------|----------|---------|-------------|-------------|
  | `session_id` | string (UUID) | yes | — | UUID format | Active session ID. |
  | `type` | "internal" \| "external" | yes | — | enum | internal = stray thought / urge to switch tasks; external = phone, message, person. |
  | `description` | string | yes | — | min 1, max 200 chars | Short note about the distraction for post-session review. |

- **Output structure:** `distraction_id` (UUID of new entry), `session_distraction_count` (running count for session), `parked_items` (DistractionRecord[], all distractions for session ordered oldest-first with fields: id, session_id, user_id, type, description, logged_at)
- **Annotations:** `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`
- **Widget linked:** no (text confirmation only)
- **Example invocation:** "I just got a Slack ping, log it as external." / "Zapisz rozproszenie: ktoś mnie zagadnął."

---

### Tool: `get_today_status`

- **Title:** Get today's Pomodoro dashboard
- **Description (verbatim):** "Get today's Pomodoro dashboard: active session, completed count, streak, and per-task progress. No parameters. UTC-based 'today' in v1.0 — flag if the user's local midnight differs."
- **Input parameters:** none (`{}`)
- **Output structure:** `active_session` (nullable — fields: session_id, task, task_id, started_at, ends_at, duration_minutes, session_type), `today_completed`, `today_target`, `current_streak`, `tasks` (TaskItem[], up to 10 most recent: id, label, planned_pomodoros, completed_pomodoros), `distractions_today` (count across all sessions today)
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`
- **Widget linked:** yes — `_meta: { ui: { resourceUri: "ui://pomodoro/widget" } }`
- **Example invocation:** "How's my day going?" / "Pokaż mi dzisiejszy postęp."

---

### Tool: `get_session_history`

- **Title:** List recent Pomodoro sessions
- **Description (verbatim):** "List Pomodoro sessions from the last N days (1-30) for pattern analysis. For end-of-day reflection, prefer the `daily-reflection` prompt — it pulls the data automatically and frames the LLM's analysis."
- **Input parameters:**

  | Parameter | Type | Required | Default | Constraints | Description |
  |-----------|------|----------|---------|-------------|-------------|
  | `days` | integer | no | 1 (in handler) | min 1, max 30 | Number of days back from today to include. |
  | `include_distractions` | boolean | no | true (in handler) | — | Whether to inline distraction records into each session. |

- **Output structure:** `sessions` (HistorySession[], fields: session_id, started_at, task, session_type, duration_minutes, completed, distractions[]), `totals` (focus_minutes, completed_sessions, abandoned_sessions, distraction_count)
- **Annotations:** `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`
- **Widget linked:** no (analytical data for LLM summarization)
- **Example invocation:** "Show me my focus patterns from the last week." / "Called by `daily-reflection` prompt automatically."

---

## 3. PROMPTS / SLASH COMMANDS

### Prompt: `daily-reflection`

- **Name:** `daily-reflection`
- **Title (Polish):** "Refleksja na koniec dnia"
- **Description (verbatim):** "Wygeneruj podsumowanie dzisiejszych sesji Pomodoro. LLM użytkownika czyta historię sesji (przez get_session_history) i zwraca: co zostało zrobione, powtarzające się rozproszenia, jedną zmianę na jutro."
- **Parameters:** `argsSchema: {}` — no formal Zod schema; the prompt triggers the LLM to call `get_session_history` and produce a Polish-language summary.
- **Example:** User selects "/daily-reflection" in the prompt menu or says "Podsumuj mój dzień."

---

### Prompt: `plan-focus-session`

- **Name:** `plan-focus-session`
- **Title (Polish):** "Rozbij zadanie na pomodora"
- **Description (verbatim):** "Pomóż użytkownikowi oszacować, ile 25-minutowych pomodora potrzebuje dane zadanie. Wymusza regułę Cirillo (podziel jeśli > 7, połącz jeśli < 1)."
- **Parameters:** Reads `task_description` from user input at runtime — no formal Zod `argsSchema` declared (known gap: field is not validated or rendered in prompt form UI).
- **Example:** User selects "/plan-focus-session" and describes a task; LLM estimates pomodoro count following Cirillo's split/combine rules.

---

## 4. INTERACTIVE WIDGET

- **Widget type:** Focus timer dashboard with modal overlay
- **What it displays:**
  - Circular countdown timer ring showing time remaining in the active session
  - Today's completed vs. target counter and streak (day count)
  - Per-task progress dots (`●` filled / `○` empty, planned vs. completed pomodoros)
  - Start session form (task text input + 15/25/45/50-minute duration toggle buttons)
  - Distraction logging modal overlay with type selector (internal/external) and description input
- **User interactions:**
  - Fill task input and select duration → triggers `start_pomodoro` via `app.callServerTool()`
  - Open distraction modal → fill type + description → triggers `log_distraction`
  - Widget hydrates on mount via `get_today_status`
- **Data flow:** Tool result → `structuredContent` → `appInstance.ontoolresult` → React state → re-render
- **Real-time updates:** Yes — `app.callServerTool()` is called from within the widget for `start_pomodoro`, `log_distraction`, and `get_today_status`. Local countdown timer runs client-side using `ends_at` from the session payload.
- **Dark mode:** Supported — `onhostcontextchanged` applies `applyDocumentTheme`, `applyHostStyleVariables`, `applyHostFonts`; shadcn components use `.dark` class toggle
- **Widget dimensions:** Fixed `h-[500px]` (Claude inline card max); `autoResize: false`; `sendSizeChanged({ height: 500 })` on connect

---

## 5. HOW IT WORKS

- **Data flow:** User prompt → AI calls tool → Cloudflare Worker authenticates JWT → D1 query/mutation → Polish result text + structured JSON → widget re-renders timer or dashboard
- **External APIs used:** None — all data stored in and retrieved from shared Cloudflare D1 (`mcp-oauth` database). No external HTTP calls from tool handlers.
- **Business logic / formulas:**
  - Cirillo technique: focus sessions are 25 min (default), short breaks after each, long break every 4th completed focus session — `suggested_next` encodes this rule
  - Daily streak: anchored on `substr(started_at, 1, 10)` (UTC date of session start), not completion date — prevents midnight-crossing streak resets
  - Stats recompute: `complete_pomodoro` uses `env.DB.batch([updateStmt, recomputeStmt])` — atomic two-statement D1 transaction ensuring session close and stats update never diverge
  - Expired-session auto-completion: `start_pomodoro` auto-closes any session whose `ends_at` is in the past before inserting the new one, setting `completed_at = session.ends_at` (not current time) to preserve correct daily stats
  - Active-session conflict: if a non-expired active session exists, `start_pomodoro` raises an MCP Elicitation form (3 choices in Polish) before any DB mutation; falls back to descriptive error string if elicitation unsupported
- **Caching:** JWKS cached isolate-scoped via module-level lazy-init (`let jwks = null`) in `src/auth/jwt-verify.ts`. No session or stats caching — D1 reads fresh per call.
- **Practical use case scenarios:**
  1. Morning planning: user asks "Rozbij pisanie raportu na pomodory" → `/plan-focus-session` prompt estimates count → user calls `start_pomodoro("Raport Q2", 25)`
  2. Distraction capture: mid-session phone buzz → "Zanotuj rozproszenie: telefon od klienta" → `log_distraction` called without pausing the countdown
  3. End-of-day reflection: user triggers `/daily-reflection` → LLM reads history via `get_session_history`, returns Polish summary of sessions, top distractions, one change for tomorrow

---

## 6. INSTALLATION INFO

- **Server URL:** `https://pomodoro.wtyczki.ai`
- **Transports available:**
  - Streamable HTTP: `https://pomodoro.wtyczki.ai/mcp`
- **Auth flow on first connect:** The MCP client must obtain a WorkOS AuthKit JWT via the panel at `panel.wtyczki.ai` (centralized login — OAuth 2.1 / PKCE). The token is passed as `Authorization: Bearer <JWT>` on every request. No API key path exists (`wtyk_*` keys not implemented in this server). Well-known discovery at `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` (RFC 9728 / RFC 8414).
- **Requirements:** Active wtyczki.ai account; no API keys from external services required; no paid third-party subscriptions needed (all data is server-owned D1).

---

## 7. LIMITATIONS & CONSTRAINTS

- **Input value ranges:**
  - `task`: 1–200 characters
  - `duration_minutes`: only 15, 25, 45, or 50 (no other values accepted)
  - `notes`: max 500 characters
  - `description` (distraction): 1–200 characters
  - `days` (history): 1–30
- **API rate limits:** None implemented (no per-user rate protection in this version).
- **Data freshness / caching:** Session data always read fresh from D1 (no caching). Daily stats are write-through — atomically recomputed on every `complete_pomodoro`.
- **Geographic restrictions:** None — server has no geographic limitations. Data is UTC-based.
- **UTC-only "today" boundary:** Daily counts and streaks use UTC midnight. A user whose local midnight is UTC+2 will see their late-night sessions credited to the next UTC day. Documented in server instructions as a known v1.0 limitation; timezone parameter planned for v1.1.
- **What it CANNOT do:**
  - No task archiving — tasks accumulate and only the 10 most recent show in `get_today_status`
  - No API key authentication (JWT-only)
  - No rate limiting
  - No per-user timezone configuration
  - No team or shared sessions (fully per-user)
  - No export or analytics beyond the 30-day window of `get_session_history`
  - Does not pause or stop sessions on distraction — this is intentional per Cirillo technique, not a bug

---

## 8. TECH STACK

- **Runtime:** Cloudflare Workers (Streamable HTTP, `createMcpHandler` pattern)
- **State management:** Stateful per-user — all session, task, distraction, and daily stats data stored in shared Cloudflare D1 (`mcp-oauth` database, 4 project tables). No Durable Objects; stateless transport with stateful D1 backend.
- **Frontend:** React 19 + Tailwind CSS 3 + shadcn/ui (Card, Button components); bundled as single-file HTML via `vite-plugin-singlefile`; `@modelcontextprotocol/ext-apps` for host bridge (theme, resize, tool callbacks)
- **External services:** None — no external HTTP APIs called from tool handlers
- **MCP SDK version:** `@modelcontextprotocol/sdk@^1.29.0`, `@modelcontextprotocol/ext-apps@^1.7.0`, `agents@^0.11.5`
- **Key dependencies:**
  - `zod@^4.1.13` — input/output schema validation (ZodRawShapeCompat, `zod/v4` import)
  - `jose@^6.1.0` — JWKS-based JWT verification (WorkOS AuthKit)
  - `react@^19.2.0`, `react-dom@^19.2.0` — widget frontend
  - `tailwind-merge@^3.4.0`, `clsx@^2.1.1` — class utilities
  - `vite@^6.0.6`, `vite-plugin-singlefile@^2.3.0` — widget build pipeline
  - `wrangler@^4.45.3` — Cloudflare Workers deployment
  - `cross-env@^7.0.3` — cross-platform build scripts

## Changelog

- 2026-05-25: Initial generation via /describe-server from snapshot.md (source commit 091da442)
