---
generator: /snapshot-server
generated: 2026-05-25
source_commit: 091da442
depends_on: []
---

# Pomodoro Focus MCP App - Infrastructure Snapshot

**Generated**: 2026-05-25
**Repository**: pomodoro
**Status**: Production
**Architecture**: MCP Apps (SEP-1865) - Stateful D1 Session Tracking

---

## 1. Project Identity Metrics

| Field | Value |
|-------|-------|
| **Human Name** | Pomodoro Focus |
| **Slug** | `pomodoro` |
| **Wrangler name** | `pomodoro` |
| **Server description** | Focused-work tracking with per-user sessions, distraction inventory, and LLM-coached daily reflection |
| **Primary domain** | `pomodoro.wtyczki.ai` |
| **Version** | `1.0.0` |
| **Protocol** | MCP 2024-11-05 / `createMcpHandler` → Streamable HTTP |

### Visual Identity

| Element | Value |
|---------|-------|
| **Server icon** | N/A (not declared in server config) |
| **Tool icon** | N/A |
| **Display name** | `Pomodoro Focus` (from `SERVER_CONFIG.NAME`) |

### MCP Apps (SEP-1865) Configuration

| Field | Value |
|-------|-------|
| **Assets binding** | `ASSETS` |
| **Assets directory** | `./web/dist/widgets` |
| **Build system** | Vite + `vite-plugin-singlefile` + `@vitejs/plugin-react` |
| **UI resource URI** | `ui://pomodoro/widget` |
| **Widget file** | `web/widgets/widget.html` |
| **Built output** | `web/dist/widgets/widget.html` |
| **Two-part registration** | ✅ `registerResource` + `registerTool` with `_meta.ui.resourceUri` |

---

## 2. Required Functionalities Status

### 2.1 Dual Authentication (WorkOS + API Keys)

| Path | Status | Notes |
|------|--------|-------|
| **WorkOS AuthKit JWT** | ✅ Implemented | `src/auth/jwt-verify.ts` — JWKS via `jose`, `issuer` validated, no audience check (per security pattern) |
| **API Key path** | ❌ Not Implemented | No `src/api-key-handler.ts`; `src/index.ts` has no `wtyk_` key routing — JWT-only |
| **D1 user lookup** | ✅ Implemented | `src/auth/auth-utils.ts:13` — `SELECT user_id, email, is_deleted FROM users WHERE workos_user_id = ? AND is_deleted = 0` |
| **OAUTH_KV** | ❌ Not Bound | Not declared in `wrangler.jsonc` |
| **USER_SESSIONS** | ❌ Not Bound | Not declared |

### 2.2 Transport Protocol

| Field | Value |
|-------|-------|
| **Pattern** | `createMcpHandler` (Cloudflare canonical, Apr-2025+) |
| **Endpoint** | `POST /mcp` |
| **DO class** | ❌ None — Streamable HTTP; D1 handles session persistence |
| **WebSocket hibernation** | ❌ Not applicable |
| **agents SDK version** | `agents@^0.11.5` |
| **GHSA-345p-7cg4-v4c7** | ✅ Safe — fresh `McpServer` per request via `createServer(env)` |

### 2.3 Tool Implementation (SDK 1.25+)

| Check | Status |
|-------|--------|
| `registerTool` native SDK | ✅ |
| `inputSchema` plain object (ZodRawShapeCompat) | ✅ |
| `outputSchema` declared | ✅ All 5 tools |
| `structuredContent` returned | ✅ via `runTool` wrapper (`src/server.ts:103-105`) |
| `isError: true` on errors | ✅ `toolError()` helper (`src/server.ts:66-70`) |
| Tool descriptions | ✅ 4-part pattern via `getToolDescription()` |
| Tool naming convention (snake_case) | ✅ |
| Tool `title` declared | ✅ All 5 tools |
| `annotations` block | ✅ All 5 tools |

### 2.4 Tool Descriptions (4-Part Pattern)

All descriptions follow the 4-part internal structure (`part1_purpose` / `part2_returns` / `part3_useCase` / `part4_constraints`). `getToolDescription()` concatenates only `part1_purpose` + `part4_constraints`. `part2_returns` intentionally dropped (covered by `outputSchema`); `part3_useCase` dropped (covered by `serverInfo.instructions` Usage Patterns). Vendor hiding: ✅ (no external API; all data via D1).

### 2.5 Centralized Login (panel.wtyczki.ai)

| Check | Status |
|-------|--------|
| `USER_SESSIONS` binding | ❌ Not bound |
| Session cookie flow | ❌ N/A — JWT Bearer token only |
| `is_deleted` check | ✅ `src/auth/auth-utils.ts:13` — `AND is_deleted = 0` |
| Redirect flow | ❌ N/A — AuthKit JWT direct |
| Well-known discovery | ✅ `src/well-known.ts` — RFC 9728 + RFC 8414 |

### 2.6 Prompts (SDK 1.20+)

| Check | Value |
|-------|-------|
| **Capability declared** | ✅ `capabilities: { tools: {}, prompts: {}, resources: {} }` (`src/server.ts:208-211`) |
| **Count** | 2 |
| `registerPrompt` | ✅ |
| Zod `argsSchema` | ⚠️ Partial — `daily-reflection` uses `argsSchema: {}`; `plan-focus-session` reads `task_description` at runtime without formal Zod schema |
| Naming convention | ✅ kebab-case |

**Registered Prompts:**

| Name | Title (Polish) | Description |
|------|----------------|-------------|
| `daily-reflection` | "Refleksja na koniec dnia" | "Wygeneruj podsumowanie dzisiejszych sesji Pomodoro. LLM użytkownika czyta historię sesji (przez get_session_history) i zwraca: co zostało zrobione, powtarzające się rozproszenia, jedną zmianę na jutro." |
| `plan-focus-session` | "Rozbij zadanie na pomodora" | "Pomóż użytkownikowi oszacować, ile 25-minutowych pomodora potrzebuje dane zadanie. Wymusza regułę Cirillo (podziel jeśli > 7, połącz jeśli < 1)." |

---

## 3. Optional Functionalities Status

| Feature | Status | Notes |
|---------|--------|-------|
| **3.1 Stateful Session** | ✅ Implemented | D1-backed per-user session rows; active-session conflict resolution via elicitation |
| **3.2 Completions** | ❌ Not Implemented | |
| **3.3 Workers AI** | ❌ Not Implemented | Binding commented out in `wrangler.jsonc` |
| **3.4 Workflows & Async** | ❌ Not Implemented | |
| **3.5 Rate Limiting** | ❌ Not Implemented | |
| **3.6 KV Caching** | ❌ Not Implemented | JWKS cached isolate-scoped via `jose` module-level var |
| **3.7 R2 Storage** | ❌ Not Implemented | Binding commented out in `wrangler.jsonc` |
| **3.8 ResourceLinks** | ❌ Not Implemented | |
| **3.9 Elicitation** | ✅ Implemented | `src/helpers/elicitation.ts` — form-mode only; active-session conflict in `start_pomodoro` |
| **3.10 Dynamic Tools** | ❌ Not Implemented | |
| **3.11 Tasks Protocol** | ❌ Not Adopted | Per-repo decision (SEP-2663 not yet in `agents/mcp`) |
| **3.12 Resources (SEP-1865)** | ✅ Implemented | See below |
| **3.13 Sampling** | ❌ Deprecated | SEP-2577 Final; not adopted |

### 3.12 Resources (MCP Apps - SEP-1865)

```typescript
// src/server.ts:217-235
server.registerResource(
  "widget",
  widgetResource.uri,                // "ui://pomodoro/widget"
  {
    mimeType: RESOURCE_MIME_TYPE,    // "text/html;profile=mcp-app"
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
        _meta: widgetResource._meta as Record<string, unknown>,  // CSP on contents[], not config
      }],
    };
  },
);
```

CSP placement: ✅ on `contents[]` entry (correct per spec).

---

## 4. Detailed Tool Audit (Tool Inventory)

### Tool 1: `start_pomodoro`

| Field | Value |
|-------|-------|
| **Technical name** | `start_pomodoro` |
| **Display title** | "Start a Pomodoro session" |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Widget link** | ✅ `_meta: { ui: { resourceUri: "ui://pomodoro/widget" } }` |
| **Auth parity** | JWT: `src/index.ts:88-91` → `src/server.ts:239-269` |

**Description (Verbatim):**
> Start a focused Pomodoro session anchored to a task. Rejects if a focus session is already active — call complete_pomodoro first. Allowed durations: 15, 25, 45, 50 min (default 25).

**Input Schema:**

| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| `task` | `string` | ✅ | min 1, max 200 chars |
| `duration_minutes` | `15 \| 25 \| 45 \| 50` | ❌ | literal union; default 25 in handler |
| `session_type` | `"focus" \| "short_break" \| "long_break"` | ❌ | default "focus" in handler |
| `task_id` | `string` (UUID) | ❌ | UUID format |

**Output Schema fields:** `session_id`, `task`, `task_id`, `started_at`, `ends_at`, `session_type`, `duration_minutes`, `today_completed`, `today_target`, `current_streak`

**Implementation Details:** Pre-flight `resolveActiveSessionConflict()` via elicitation (form mode, 3 choices). Auto-completes expired sessions. Task lookup/create via `getOrCreateTask()`. D1 INSERT into `pomodoro_sessions`.

**Output Format:** `content[].text` — Polish result string. `structuredContent` — full schema object.

---

### Tool 2: `complete_pomodoro`

| Field | Value |
|-------|-------|
| **Technical name** | `complete_pomodoro` |
| **Display title** | "Complete the active Pomodoro" |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Widget link** | ❌ No `_meta.ui.resourceUri` (intentional — side-effect tool, no widget stack) |
| **Auth parity** | JWT: `src/index.ts:88-91` → `src/server.ts:277-300` |

**Description (Verbatim):**
> Mark a Pomodoro session as completed and roll the streak forward. Idempotent on session_id — calling twice does not double-count. Long break is suggested every 4th completed focus session.

**Input Schema:**

| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| `session_id` | UUID | ✅ | UUID format |
| `distractions_count` | int | ❌ | min 0 |
| `notes` | string | ❌ | max 500 chars |

**Output Schema fields:** `session_id`, `today_completed`, `today_target`, `current_streak`, `suggested_next`, `streak_milestone`

**Implementation Details:** Atomic D1 batch (`env.DB.batch([updateStmt, recomputeStmt])`). Stats anchor on `started_at` date. Idempotent: re-reads if already completed. Non-focus sessions: single UPDATE (no stats impact).

---

### Tool 3: `log_distraction`

| Field | Value |
|-------|-------|
| **Technical name** | `log_distraction` |
| **Display title** | "Log a distraction without breaking focus" |
| **Annotations** | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false` |
| **Widget link** | ❌ No `_meta.ui.resourceUri` (intentional — text confirmation only) |
| **Auth parity** | JWT: `src/index.ts:88-91` → `src/server.ts:303-323` |

**Description (Verbatim):**
> Log a distraction (internal thought or external event) during the active session. Does NOT pause or stop the session — that defeats Cirillo's 'inventory' rule. Description capped at 200 chars; keep it short.

**Input Schema:**

| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| `session_id` | UUID | ✅ | UUID format |
| `type` | `"internal" \| "external"` | ✅ | enum |
| `description` | string | ✅ | min 1, max 200 chars |

**Output Schema fields:** `distraction_id`, `session_distraction_count`, `parked_items` (DistractionRecord[])

**Implementation Details:** Validates session ownership before INSERT. Returns full ordered distraction inventory for the session.

---

### Tool 4: `get_today_status`

| Field | Value |
|-------|-------|
| **Technical name** | `get_today_status` |
| **Display title** | "Get today's Pomodoro dashboard" |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Widget link** | ✅ `_meta: { ui: { resourceUri: "ui://pomodoro/widget" } }` |
| **Auth parity** | JWT: `src/index.ts:88-91` → `src/server.ts:325-348` |

**Description (Verbatim):**
> Get today's Pomodoro dashboard: active session, completed count, streak, and per-task progress. No parameters. UTC-based 'today' in v1.0 — flag if the user's local midnight differs.

**Input Schema:** `{}` (no parameters)

**Output Schema fields:** `active_session` (nullable), `today_completed`, `today_target`, `current_streak`, `tasks` (up to 10), `distractions_today`

**Implementation Details:** Widget hydration call. 4 D1 queries: daily_stats, active_session, tasks (top 10 by `created_at DESC`), distraction count for today.

---

### Tool 5: `get_session_history`

| Field | Value |
|-------|-------|
| **Technical name** | `get_session_history` |
| **Display title** | "List recent Pomodoro sessions" |
| **Annotations** | `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false` |
| **Widget link** | ❌ No `_meta.ui.resourceUri` (analytical data for LLM summarization) |
| **Auth parity** | JWT: `src/index.ts:88-91` → `src/server.ts:351-376` |

**Description (Verbatim):**
> List Pomodoro sessions from the last N days (1-30) for pattern analysis. For end-of-day reflection, prefer the `daily-reflection` prompt — it pulls the data automatically and frames the LLM's analysis.

**Input Schema:**

| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| `days` | int | ❌ | min 1, max 30; default 1 in handler |
| `include_distractions` | bool | ❌ | default true in handler |

**Output Schema fields:** `sessions` (HistorySession[]), `totals` (focus_minutes, completed_sessions, abandoned_sessions, distraction_count)

**Implementation Details:** 2 D1 calls (sessions LEFT JOIN tasks, distractions IN batch). Dynamic IN placeholder list. Defaults applied in handler.

**Prompt Integration:** Called by `daily-reflection` prompt step 1.

---

## 5. UX & Frontend Quality Assessment (6 Pillars)

### Pillar I: Identity & First Impression

- ✅ Server name "Pomodoro Focus" — clear, task-specific
- ✅ Server instructions present (~230 words, trimmed)
- ✅ Widget description detailed (timer ring, task progress dots, distraction modal, start form)
- ❌ No server icon declared

### Pillar II: Model Control & Quality

**Server instructions word count**: ~230 words (within <300 recommendation)

**Coverage sections:**
- ✅ Capabilities (4 bullet points)
- ✅ Usage Patterns (5 workflow rules with tool names)
- ✅ Prompts (2 prompts described with trigger scenarios)
- ✅ Limits (allowed durations, UTC caveat)
- ✅ Language directive (`Respond in Polish` + pass-through note)
- ✅ Notes (auth automatic, widget is the surface)

### Pillar III: Interactivity & Agency

- ✅ Elicitation form for active-session conflict resolution (3 choices, Polish labels)
- ✅ 2 registered prompts for user-initiated templates
- ✅ Widget countdown timer, task form, distraction logging modal
- ✅ `suggested_next` from `complete_pomodoro` drives next-action guidance
- ✅ `streak_milestone` flag for celebratory UX

### Pillar IV: Context & Data Management

- ✅ Per-user D1 storage (sessions, tasks, distractions, daily stats)
- ✅ Streak computation with atomic batch recompute
- ✅ Task reuse by UUID or label (idempotent creation)
- ✅ Expired-session auto-completion on next `start_pomodoro`
- ⚠️ UTC-only "today" boundary — known limitation, documented in instructions

### Pillar V: Media & Content Handling

- ✅ Single-file HTML widget (`vite-plugin-singlefile`)
- ✅ CSP `resourceDomains`: Claude (`assets.claude.ai`) and ChatGPT (`persistent.oaistatic.com`, `*.oaistatic.com`) CDNs
- ✅ `connectDomains: []` — correct (all data via MCP protocol, no external fetch)
- ✅ `prefersBorder: false` (blended widget — recommended)
- ✅ `domain` set to SHA-256 derived sandbox origin (`9ba9ea0ee91c9914cbf9f9513d8f27a8.claudemcpcontent.com`)

### Pillar VI: Operations & Transparency

- ✅ Cloudflare Observability enabled (`wrangler.jsonc`)
- ✅ Structured JSON logger with typed events and `action_id` correlation
- ✅ `tool_started`, `tool_completed`, `tool_failed` events
- ✅ `auth_attempt` logged on JWT failure with reason code
- ✅ `server_error` logged in fetch handler catch

---

## 6. Deployment Status

### 6.1 Consistency Tests

`verify-consistency.sh` not found in `scripts/` directory. ❌ N/A — script absent.

### 6.2 TypeScript Compilation

**Command:** `cd projects/pomodoro && npx tsc --noEmit`

**Result:** ✅ CLEAN — exit code 0, no errors, no output.

### 6.3 Production URL

| Field | Value |
|-------|-------|
| **Primary domain** | `pomodoro.wtyczki.ai` |
| **workers.dev disabled** | ✅ `"workers_dev": false` |
| **Custom domain** | ✅ `routes: [{ pattern: "pomodoro.wtyczki.ai", custom_domain: true }]` |

---

## 7. Infrastructure Components

### Cloudflare Assets (MCP Apps)

| Field | Value |
|-------|-------|
| **Binding** | `ASSETS` |
| **Directory** | `./web/dist/widgets` |
| **Build command** | `npm install && npm run build:widgets && npx tsc --noEmit` |
| **Widget source** | `web/widgets/widget.html`, `web/widgets/widget.tsx` |
| **Built output** | `web/dist/widgets/widget.html` |

### Durable Objects

❌ None — Streamable HTTP via `createMcpHandler`; no DO class.

### KV Namespaces

| Binding | Status |
|---------|--------|
| `OAUTH_KV` | ❌ Not bound |
| `USER_SESSIONS` | ❌ Not bound |

> JWKS caching: isolate-scoped module-level `let jwks = null` in `src/auth/jwt-verify.ts`.

### D1 Database

| Field | Value |
|-------|-------|
| **Binding** | `DB` |
| **Database name** | `mcp-oauth` |
| **Database ID** | `eac93639-d58e-4777-82e9-f1e28113d5b2` |
| **Shared tables** | `users` (auth lookup, `is_deleted` check) |
| **Project tables** | `pomodoro_tasks`, `pomodoro_sessions`, `pomodoro_distractions`, `pomodoro_daily_stats` |
| **Migrations** | 2 files (`0001_pomodoro_tables.sql`, `0002_abandoned_at.sql`) |

**D1 Table Summary:**

| Table | Primary Key | Key Columns |
|-------|-------------|-------------|
| `pomodoro_tasks` | `id` | user_id, label, planned_pomodoros, archived_at |
| `pomodoro_sessions` | `id` | user_id, task_id, session_type, duration_minutes, started_at, ends_at, completed_at, abandoned_at |
| `pomodoro_distractions` | `id` | session_id, user_id, type, description, logged_at |
| `pomodoro_daily_stats` | `(user_id, date)` | completed_count, streak_day |

### R2 Storage

❌ Not implemented (binding commented out in `wrangler.jsonc`).

### Workers AI

❌ Not implemented (binding commented out in `wrangler.jsonc`).

### AI Gateway

❌ Not implemented.

### Workflows

❌ Not implemented.

### Secrets (Wrangler)

| Name | Type | Value |
|------|------|-------|
| `AUTHKIT_DOMAIN` | `vars` (not secret — public) | `exciting-domain-65.authkit.app` |

> No per-server WorkOS secrets. Centralized auth — zero `WORKOS_*` per `lesson_workos_secrets.md`.

---

## 8. Architecture Patterns

### Authentication Architecture (Single Transport)

```
Client → POST /mcp  Authorization: Bearer <JWT>
  → verifyJwt(token, AUTHKIT_DOMAIN)           [src/auth/jwt-verify.ts]
       → JWKS from https://<authkitDomain>/oauth2/jwks (jose, isolate-cached)
       → jwtVerify: issuer + expiry; extracts sub (workosUserId)
  → getUserByWorkosId(DB, workosUserId)          [src/auth/auth-utils.ts]
       → SELECT user_id, email, is_deleted FROM users WHERE workos_user_id = ? AND is_deleted = 0
  → createServer(env) + createMcpHandler(server, { authContext: { props: { userId, email } } })
  → tools: getMcpAuthContext().props.userId
```

JWT-only. No API key path.

### Caching Strategy

| Layer | Strategy |
|-------|----------|
| JWKS | Isolate-scope lazy-init (module-level `let jwks = null`) |
| Session data | No cache — D1 reads fresh per call |
| Daily stats | Write-through: atomic recompute on `complete_pomodoro` |

### Concurrency Control

- D1 batch transactions (`env.DB.batch(...)`) for atomic session close + stats recompute.
- Active session guard in `startSession()` (`getActiveSession()` before INSERT).
- Elicitation-based conflict resolution: user prompt before state mutation.

### Storage Architecture

All per-user state in shared D1 (`mcp-oauth`). No KV, R2, or DO. UTC-anchored daily stats keyed on `(user_id, date)` with `started_at` as stats anchor column.

---

## 9. Code Quality

### Type Safety

| Check | Status |
|-------|--------|
| `import * as z from "zod/v4"` | ✅ |
| ZodRawShapeCompat (plain objects, no `.shape`) | ✅ |
| `.meta({ description })` not `.describe()` | ✅ |
| No `.default()` in schemas | ✅ — defaults in handler code |
| Typed params cast (`as TypedParams`) | ✅ all tools |
| TypeScript compilation | ✅ Clean |

### Error Handling

| Scenario | Handling |
|----------|----------|
| Active session conflict | Elicitation → 3 choices → DB mutation or descriptive `Error` |
| Session not found | `throw new Error("Session not found: ${id}")` |
| Session already abandoned | `throw new Error("Session already abandoned: ${id}")` |
| Task not found | `throw new Error("Task not found: ${id}")` |
| JWT verification failure | `null` → 401 `unauthorizedResponse` |
| D1 user not found / deleted | `null` → 401 |
| Tool errors | `toolError()` → `{ content: [{ type: "text", text: "Error: ..." }], isError: true }` |
| Unauthenticated request | `throw new Error("Unauthenticated request — userId missing")` |
| Cross-user distraction write | Session ownership check before INSERT |

### Observability

| Check | Status |
|-------|--------|
| Cloudflare Observability flag | ✅ `"observability": { "enabled": true }` |
| Structured JSON logging | ✅ `JSON.stringify` in `shared/logger.ts` |
| `tool_started` / `tool_completed` / `tool_failed` | ✅ with `action_id` correlation |
| `auth_attempt` failure logging | ✅ with `reason` field |
| `server_error` logging | ✅ in fetch handler catch |

---

## 10. Technical Specifications

### Performance

| Metric | Value |
|--------|-------|
| **External API** | None — D1 only |
| **D1 queries / `get_today_status`** | 4 (daily_stats, active_session, tasks, distractions count) |
| **D1 queries / `start_pomodoro`** | 3-4 (active_session, task lookup/create, INSERT, read stats) |
| **D1 queries / `complete_pomodoro`** | 3 (session read, D1 batch [2 stmts], task bump if needed) |
| **D1 queries / `log_distraction`** | 3 (ownership check, INSERT, SELECT all for session) |
| **D1 queries / `get_session_history`** | 2 (sessions+tasks JOIN, distractions IN) |
| **Expected latency** | 50–200ms |

### Dependencies

**Common Across MCP Apps:**
```json
{
  "@modelcontextprotocol/ext-apps": "^1.7.0",
  "@modelcontextprotocol/sdk": "^1.29.0",
  "agents": "^0.11.5",
  "zod": "^4.1.13"
}
```

**Widget-Specific:**
```json
{
  "clsx": "^2.1.1",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "tailwind-merge": "^3.4.0"
}
```

**Authentication:**
```json
{
  "jose": "^6.1.0"
}
```

**Development:**
```json
{
  "@cloudflare/workers-types": "^4.20250101.0",
  "@types/react": "^19.2.2",
  "@types/react-dom": "^19.2.2",
  "@vitejs/plugin-react": "^4.3.4",
  "autoprefixer": "^10.4.20",
  "concurrently": "^9.2.1",
  "cross-env": "^7.0.3",
  "postcss": "^8.4.49",
  "tailwindcss": "^3.4.17",
  "typescript": "^5.9.3",
  "vite": "^6.0.6",
  "vite-plugin-singlefile": "^2.3.0",
  "wrangler": "^4.45.3"
}
```

### SDK Versions

| Package | Version |
|---------|---------|
| `@modelcontextprotocol/sdk` | `^1.29.0` |
| `@modelcontextprotocol/ext-apps` | `^1.7.0` |
| `agents` | `^0.11.5` |
| `zod` | `^4.1.13` |
| `wrangler` | `^4.45.3` |

---

## 11. Compliance Summary

| Check | Status | Notes |
|-------|--------|-------|
| Vendor Hiding | ✅ | No external API; no service names in descriptions |
| Dual Auth Parity | ⚠️ | JWT-only (no API key path) |
| 4-Part Descriptions | ✅ | Full structure in `src/tools/descriptions.ts`; `getToolDescription()` emits purpose + constraints |
| Custom Domain | ✅ | `pomodoro.wtyczki.ai` |
| workers.dev Disabled | ✅ | `"workers_dev": false` |
| Consistency Tests | ❌ | `verify-consistency.sh` not present |
| TypeScript Compilation | ✅ | Clean — exit code 0 |
| Prompts Implemented | ✅ | 2 prompts registered |
| Zod Schema Shape | ✅ | ZodRawShapeCompat (plain objects, no `.shape`) |
| Tool Naming (snake_case) | ✅ | All 5 tools |
| Error Handling | ✅ | `toolError()` + `isError: true` |
| Color-scheme Meta | ⚠️ | Not verified (widget.html not fully inspected) |
| Cross-env Build | ✅ | `cross-env` in all `build:widget*` scripts |

---

## 12. Unique Architectural Features

### Feature 1: Elicitation-Based Active Session Conflict Resolution

`start_pomodoro` uses MCP spec §Elicitation Form Mode mid-tool-call. When an active session exists, the server raises a Polish-language form prompt before any DB mutation:

```typescript
// src/server.ts:155-176
const outcome = await requestElicitation<{ resolution: string }>(
  server,
  {
    message: `Masz aktywną sesję (zostało ${remaining}). Co robimy?`,
    requestedSchema: {
      type: "object",
      properties: {
        resolution: {
          type: "string",
          title: "Co zrobić z aktywną sesją?",
          oneOf: [
            { const: "complete_and_start", title: "Zamknij obecną i zacznij nową" },
            { const: "abandon_and_start",  title: "Porzuć obecną i zacznij nową" },
            { const: "keep_current",       title: "Zostaw obecną sesję" },
          ],
        },
      },
      required: ["resolution"],
    },
  },
  { relatedRequestId },
);
```

When elicitation is unsupported, falls back to a descriptive error string the model can act on.

### Feature 2: Stats Anchored to `started_at`

Daily stats use `substr(started_at, 1, 10)` as the anchor — not `completed_at`. A 23:51→00:16 session belongs to its start day, preventing midnight-crossing streak resets. Stats are computed by an UPSERT SQL that derives both `completed_count` and `streak_day` inline from `pomodoro_sessions` in a single pass.

### Feature 3: Atomic D1 Batch for Session Completion

`completeSession()` uses `env.DB.batch([updateStmt, recomputeStmt])` — two statements in one D1 transaction. Either both succeed or both roll back, ensuring no session can be closed with stale stats.

### Feature 4: Selective `_meta.ui.resourceUri` Placement

Only 2 of 5 tools carry `_meta.ui.resourceUri` (`start_pomodoro`, `get_today_status`). The other 3 deliberately omit it to prevent widget stacking when the model chains `complete → start`, and because `log_distraction` and `get_session_history` are text-only or analytical tools.

### Feature 5: Expired Session Auto-Completion

`startSession()` auto-completes any session whose `ends_at` is in the past before inserting the new one. Sets `completed_at = session.ends_at` (not `isoNow()`) to preserve correct daily-stats grouping. No blocking error — single-call recovery for host-closed sessions.

---

## 13. Known Issues & Limitations

1. **UTC-only "today" boundary**: daily counts and streaks use UTC midnight; flagged in server instructions. Planned: timezone parameter in v1.1.
2. **No API key path**: JWT-only authentication; no `wtyk_` fallback.
3. **No `OAUTH_KV` / `USER_SESSIONS`**: no centralized login panel redirect flow.
4. **`plan-focus-session` `argsSchema`**: reads `task_description` at runtime without formal Zod schema; field is not validated or rendered in the prompt form UI.
5. **No rate limiting**: no per-user call rate protection.
6. **4 D1 calls in `get_today_status`**: no query batching optimization.
7. **No task archiving UI**: tasks accumulate in the `LIMIT 10` list.

---

## 14. Future Roadmap

### Implemented (Latest)

- Elicitation-based active-session conflict resolution (form mode, 3 choices)
- `abandoned_at` column migration — semantic distinction from completion
- Atomic D1 batch for `complete_pomodoro` (session + stats recompute)
- Stats anchor on `started_at` (midnight-crossing robustness)
- 2 prompts: `daily-reflection`, `plan-focus-session`
- Selective `_meta.ui.resourceUri` placement (3 tools without widget link)

### Planned Components

- Timezone-aware "today" boundary (v1.1)
- API key authentication path
- Task archiving UI
- Rate limiting

### Planned Use Cases

- Weekly focus report prompt
- Distraction pattern analysis
- Per-task time-to-completion estimates

---

## 15. Testing Status

- [ ] Unit tests — ❌ Not implemented
- [ ] Integration tests — ❌ Not implemented
- [x] TypeScript compilation — ✅ Clean
- [ ] Manual Testing Checklist:
  - [ ] Start pomodoro → widget renders countdown timer
  - [ ] Complete pomodoro → streak increments, `suggested_next` correct
  - [ ] Log distraction mid-session → count increments, session continues
  - [ ] Start with active session → elicitation form appears with remaining time
  - [ ] Elicitation "Zamknij obecną" → old session closed, new started
  - [ ] Elicitation "Porzuć obecną" → old session abandoned (no stats), new started
  - [ ] `get_today_status` widget hydration on mount
  - [ ] `daily-reflection` prompt → calls `get_session_history`, Polish summary
  - [ ] `plan-focus-session` prompt → calls `get_today_status`, pomodoro breakdown
  - [ ] JWT expiry → 401 returned
  - [ ] Deleted user (`is_deleted = 1`) → 401 returned

---

## 16. Documentation Status

| Document | Status | Notes |
|----------|--------|-------|
| README | ❌ Not found | No `README.md` in project root |
| API docs | ❌ Not found | |
| Setup guide | ❌ Not found | |
| Troubleshooting | ❌ Not found | |
| Deployment | ⚠️ Partial | `wrangler.jsonc` build command inline; no separate guide |
| Migration SQL | ✅ | 2 migration files with inline rationale comments |
| Design audit | ✅ | `reports/design-audit.md` |
| Eval reports | ✅ | `reports/eval/` directory |

---

## 17. File Structure (MCP Apps Standard)

### Source Files (`src/`)

```
src/
├── index.ts                    # Entry: well-known discovery + auth + createMcpHandler dispatch
├── server.ts                   # McpServer factory: 5 tools, 1 resource, 2 prompts
├── server-instructions.ts      # SERVER_INSTRUCTIONS (~230 words)
├── types.ts                    # Env interface (ASSETS, DB, AUTHKIT_DOMAIN)
├── well-known.ts               # RFC 9728 + RFC 8414 discovery handlers
├── auth/
│   ├── auth-utils.ts           # getUserByWorkosId (D1 user lookup + is_deleted check)
│   └── jwt-verify.ts           # JWKS verification via jose (isolate-cached)
├── db/
│   └── queries.ts              # All D1 query functions (sessions, tasks, distractions, stats)
├── helpers/
│   ├── assets.ts               # loadHtml() — fetch widget HTML from ASSETS binding
│   └── elicitation.ts          # requestElicitation() — form-mode elicitation wrapper
├── resources/
│   └── ui-resources.ts         # UI_RESOURCES registry, CLAUDE_SANDBOX_DOMAIN, CSP config
├── schemas/
│   ├── inputs.ts               # Zod input schemas (ZodRawShapeCompat)
│   └── outputs.ts              # Zod output schemas (ZodRawShapeCompat)
├── shared/
│   ├── constants.ts            # SERVER_CONFIG (name, version)
│   └── logger.ts               # Structured JSON logger with typed event types
└── tools/
    └── descriptions.ts         # TOOL_METADATA, getToolDescription(), ToolName type
```

### Widget Files (`web/widgets/`)

```
web/
├── tsconfig.json
├── styles/
│   └── globals.css
├── lib/
│   ├── types.ts
│   └── utils.ts
└── widgets/
    ├── widget.html             # Vite entry point
    └── widget.tsx              # React widget component
```

### Build Output (`web/dist/widgets/`)

```
web/dist/widgets/
└── widget.html                 # Single-file inlined bundle (viteSingleFile)
```

### Configuration Files

```
wrangler.jsonc                  # Workers config: bindings, routes, observability
vite.config.ts                  # Vite: react + viteSingleFile, emptyOutDir: false, root: "web/"
tsconfig.json
tailwind.config.js
postcss.config.js
package.json
migrations/
├── 0001_pomodoro_tables.sql    # Initial schema: 4 tables + indexes
└── 0002_abandoned_at.sql       # ALTER TABLE: add abandoned_at + index
```

### Common Scripts (`package.json`)

```json
{
  "scripts": {
    "dev": "wrangler dev",
    "dev:widget": "cross-env INPUT=widgets/widget.html vite build --watch",
    "dev:full": "concurrently \"npm run dev\" \"npm run dev:widget\"",
    "build:widget": "cross-env INPUT=widgets/widget.html vite build",
    "build:widgets": "npm run build:widget",
    "watch": "cross-env INPUT=widgets/widget.html vite build --watch",
    "watch:widgets": "npm run watch",
    "deploy": "npm run build:widgets && wrangler deploy",
    "type-check": "tsc --noEmit",
    "pre-commit": "npm run type-check && npm run build:widgets",
    "verify-all": "npm run pre-commit",
    "verify-deploy": "npm ci && npx wrangler deploy --dry-run --outdir /tmp/wrangler-dry-run",
    "cf-typegen": "wrangler types"
  }
}
```

---

**End of Snapshot**

---

## Appendix A: MCP Apps (SEP-1865) Quick Reference

### Two-Part Registration Pattern

**Part 1 — Resource (UI content):**
```typescript
// src/server.ts:217-235
server.registerResource(
  "widget",
  "ui://pomodoro/widget",
  {
    mimeType: RESOURCE_MIME_TYPE,   // "text/html;profile=mcp-app"
    description: widgetResource.description,
    _meta: { ui: widgetResource._meta.ui! },
  },
  async () => {
    const templateHTML = await loadHtml(env.ASSETS, "/widget.html");
    return {
      contents: [{
        uri: "ui://pomodoro/widget",
        mimeType: RESOURCE_MIME_TYPE,
        text: templateHTML,
        _meta: widgetResource._meta as Record<string, unknown>,  // CSP here, not on config
      }],
    };
  },
);
```

**Part 2 — Tool with `_meta` linkage (selective — 2 of 5 tools):**
```typescript
// start_pomodoro + get_today_status only
server.registerTool(
  "start_pomodoro",
  {
    // ...
    _meta: { ui: { resourceUri: "ui://pomodoro/widget" } },
  },
  handler,
);
// complete_pomodoro, log_distraction, get_session_history — NO _meta.ui.resourceUri
```

### Widget Build Configuration (`vite.config.ts`)

```typescript
export default defineConfig({
  root: "web/",
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: { input: path.resolve(__dirname, "web", INPUT) },
    outDir: "dist",           // → web/dist/ (relative to root)
    emptyOutDir: false,       // CRITICAL: multi-widget safety
  },
});
```

---

## Appendix B: AnythingLLM Configuration Example

```json
{
  "mcpServers": {
    "pomodoro": {
      "type": "sse",
      "url": "https://pomodoro.wtyczki.ai/mcp",
      "authorizationToken": "Bearer <WorkOS_AuthKit_JWT>"
    }
  }
}
```

> Authentication: WorkOS AuthKit Bearer JWT only. No `wtyk_` API key support.

---

## Appendix C: Common Architecture Patterns

| Pattern | Reference Server | Match |
|---------|-----------------|-------|
| Pattern 1: Stateless External API Server | nbp-exchange | ❌ |
| Pattern 2: Stateful OAuth Token Caching | opensky | ❌ |
| Pattern 3: Pure Widget Server | quiz | ❌ |

**This server's pattern: Stateful D1 Session Tracking (4th pattern)**

Pomodoro introduces a distinct pattern: all user data is owned and persisted in shared D1, with no external API. Transport is stateless Streamable HTTP (no DO), but business state is fully stateful per-user via D1 rows. Distinguishing features:

- D1 replaces both the "external API" (data source) and the "caching layer"
- Atomic write-through batching for stats integrity
- Elicitation for mid-tool user prompting
- Selective `_meta.ui.resourceUri` (2 of 5 tools render the widget)
- `abandoned_at` vs `completed_at` semantic distinction per Cirillo technique

---

## Appendix D: Checklist References

- `features/CHECKLIST_BACKEND.md`
- `features/CHECKLIST_FRONTEND.md`
- `features/OPTIONAL_FEATURES.md`
- `features/SERVER_REQUIREMENTS_CHECKLIST.md`
- `features/UX_IMPLEMENTATION_CHECKLIST.md`

> Checklist files not verified in project directory.

---

## Appendix E: Quick Commands

### Development

```bash
npm run dev           # wrangler dev
npm run dev:full      # wrangler dev + vite watch concurrently
npm run dev:widget    # vite build --watch only
```

### Building & Deployment

```bash
npm run build:widgets          # Build widget.html single-file bundle
npm run type-check             # tsc --noEmit
npm run pre-commit             # type-check + build:widgets
npm run verify-deploy          # Dry-run deploy check
# Production: git push — Workers Builds handles deploy
```

### Secrets Management

```bash
# No per-server secrets needed.
# AUTHKIT_DOMAIN is a wrangler.jsonc var (public).
# DB uses shared mcp-oauth D1 (configured in wrangler.jsonc).
```

### Migrations

```bash
wrangler d1 migrations apply mcp-oauth --local   # Local dev
wrangler d1 migrations apply mcp-oauth           # Production
```

---

## Appendix F: D1 Schema and Stats Computation

### Tables

**`pomodoro_sessions`** — core session rows. State machine:
- `completed_at IS NOT NULL` → session completed (counts toward daily_stats)
- `abandoned_at IS NOT NULL` → user explicitly abandoned (no stats credit per Cirillo's rule)
- Both null → session is currently active

**`pomodoro_daily_stats`** — denormalized daily aggregate. `(user_id, date)` PK. Recomputed atomically on every `complete_pomodoro`. Streak algorithm:

```sql
INSERT INTO pomodoro_daily_stats (user_id, date, completed_count, streak_day)
VALUES (
  ?1, ?2,
  (SELECT COUNT(*) FROM pomodoro_sessions
    WHERE user_id = ?1 AND session_type = 'focus'
      AND completed_at IS NOT NULL
      AND substr(started_at, 1, 10) = ?2),
  CASE WHEN (SELECT COUNT(*) ...) > 0
       THEN COALESCE((SELECT streak_day FROM pomodoro_daily_stats
                        WHERE user_id = ?1 AND date = ?3), 0) + 1
       ELSE 0
  END
)
ON CONFLICT(user_id, date) DO UPDATE SET
  completed_count = excluded.completed_count,
  streak_day = excluded.streak_day
```

Stats anchor: `substr(started_at, 1, 10)` — sessions credit to their start date, not completion date. This makes streaks invariant across midnight crossings.
