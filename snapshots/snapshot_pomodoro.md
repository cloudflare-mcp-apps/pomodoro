# Pomodoro Focus MCP App - Infrastructure Snapshot

**Generated**: 2026-05-19
**Repository**: pomodoro
**Status**: Production
**Architecture**: MCP Apps (SEP-1865) - Stateful D1-Backed Server + Elicitation + Persistent Widget

---

## 1. Project Identity

- **Name**: Pomodoro Focus
- **Slug / Wrangler Name**: `pomodoro`
- **Description**: Focused-work tracking with per-user sessions, distraction inventory, and LLM-coached daily reflection.
- **Primary Domain**: https://pomodoro.wtyczki.ai
- **Server Icon**: ❌ Not configured (`assets/icons/server/` empty dir)
- **Tool Icons**: ❌ Not configured (`assets/icons/tools/` empty dir; no `_meta.icon` on any tool)
- **Display-Name Resolution**: ✅ All 5 tools provide `title`
- **Assets Binding**: ✅ `ASSETS` → `./web/dist/widgets` (`wrangler.jsonc:45-48`)
- **Build System**: ✅ Vite + viteSingleFile + React 19
- **UI Resource URI**: `ui://pomodoro/widget`
- **Two-Part Registration**: ✅ `src/server.ts:217-236` (Resource) + `src/server.ts:239-269` (start_pomodoro tool) + `src/server.ts:326-346` (get_today_status tool with `_meta.ui.resourceUri`)

---

## 2. Required Functionalities

### 2.1 Dual Authentication
- **OAuth/JWT Path**: ✅ AuthKit JWKS via `jose` (`src/auth/jwt-verify.ts:23-36`); D1 lookup `users WHERE workos_user_id = ? AND is_deleted = 0` (`src/auth/auth-utils.ts:14-18`).
- **API Key Path**: ❌ Not implemented — no `src/api-key-handler.ts` (platform-wide JWT-only since 2026-05-18).
- **Props Extraction**: ✅ `getMcpAuthContext()` → `auth?.props?.{ userId, email }` (`src/server.ts:49-58`).
- **D1 (mcp-oauth)**: ✅ binding `DB`, ID `eac93639-d58e-4777-82e9-f1e28113d5b2` (`wrangler.jsonc:55-61`); also holds Pomodoro tables (see §7).
- **OAUTH_KV / USER_SESSIONS**: ❌ Not bound — centralized at `panel.wtyczki.ai`.

### 2.2 Transport (canonical `createMcpHandler`)
- **`/mcp` Endpoint**: ✅ Streamable HTTP via `createMcpHandler` from `agents/mcp` (`src/index.ts:18`, `src/index.ts:89-91`).
- **Durable Object**: ❌ Not used (state lives in D1, see §3.1).
- **Agents SDK**: `agents@^0.11.5`.
- **Fresh-McpServer-per-request**: ✅ `createServer(env)` invoked inside `handleAuthenticatedMcp` (`src/index.ts:88`); GHSA-345p-7cg4-v4c7 safe.

### 2.3 Tool Implementation (SDK 1.25+)
- **MCP SDK**: `@modelcontextprotocol/sdk@^1.29.0`.
- **`registerTool()`**: ✅ 5 native registrations (`src/server.ts:239,277,306,326,349`).
- **inputSchema**: ✅ Plain ZodRawShapeCompat (`src/schemas/inputs.ts`); empty `{} as const` for `get_today_status`.
- **outputSchema**: ✅ Per-tool shapes in `src/schemas/outputs.ts` (5 schemas, all ZodRawShapeCompat).
- **structuredContent**: ✅ Returned on success via `runTool` helper (`src/server.ts:102-105`).
- **isError flag**: ✅ Used — `toolError` builds `{ content, isError: true }` (`src/server.ts:66-71`); all tools route through `runTool` and surface failures via this path.
- **Tool Naming**: ✅ snake_case (`start_pomodoro`, `complete_pomodoro`, `log_distraction`, `get_today_status`, `get_session_history`).

### 2.4 Tool Descriptions (4-Part Pattern)
- **`getToolDescription()`** concatenates `part1_purpose + part4_constraints` (`src/tools/descriptions.ts:113-116`) → ≤40 words.
- **Part 2 (Returns) + Part 3 (Use Case)**: retained in `TOOL_METADATA` as internal documentation only.
- **Vendor Hiding**: ✅ No vendor/provider names.
- **Dual-Path Consistency**: N/A — single auth path.

### 2.5 Centralized Login (panel.wtyczki.ai)
- **USER_SESSIONS KV**: ❌ Not bound (stateless JWT bearer).
- **`is_deleted = 0`**: ✅ enforced in D1 lookup (`src/auth/auth-utils.ts:16`).
- **401 Redirect**: ✅ RFC 9728 `WWW-Authenticate` with `resource_metadata` (`src/well-known.ts:33-39`).
- **Discovery**: `/.well-known/oauth-protected-resource` (RFC 9728) + `/.well-known/oauth-authorization-server` (RFC 8414) (`src/index.ts:32-37`).

### 2.6 Prompts (SDK 1.20+)
- **Capability**: ✅ `prompts: { listChanged: true }` (`src/server.ts:209`).
- **Count**: 2.
- **`registerPrompt()`**: ✅ Individual registration (`src/server.ts:382-409`, `src/server.ts:411-443`).
- **Zod Validation**: N/A — both prompts use empty `argsSchema: {}`; `plan-focus-session` reads `task_description` ad-hoc from `args`.
- **Naming**: ✅ kebab-case.
- **`daily-reflection`** — 0 args; seeds a user-turn telling the LLM to call `get_session_history` then produce wins / distraction patterns / one tweak; ~150 words; PL.
- **`plan-focus-session`** — reads optional `task_description` arg; seeds Cirillo-rule estimator (split if >7, combine if <1); PL.

---

## 3. Optional Functionalities

- **3.1 Stateful Session**: ✅ Persisted in D1 (not DO) — `pomodoro_sessions`, `pomodoro_tasks`, `pomodoro_daily_stats`, `pomodoro_distractions` (`src/db/queries.ts`). Per-user, auto-completes expired sessions on next `start_pomodoro` (`src/db/queries.ts:165-188`).
- **3.2 Completions**: ❌ Not Implemented — prompt args use plain string input; tool enums covered by Zod literal unions.
- **3.3 Workers AI**: ❌ Not configured — host LLM via Prompts.
- **3.4 Workflows & Async**: ❌ Not Implemented — all queries are sync D1 calls (<100 ms).
- **3.5 Rate Limiting**: ❌ Not Implemented — no external API budget.
- **3.6 KV Caching**: ❌ Not Implemented — D1 is the source of truth, no cache layer.
- **3.7 R2 Storage**: ❌ Not Implemented.
- **3.8 ResourceLinks**: ❌ Not Implemented.
- **3.9 Elicitation**: ✅ Form mode for active-session conflict resolution (`src/server.ts:140-199`); 3 oneOf choices (complete/abandon/keep_current); falls back to original error throw on decline/cancel/unsupported. Capability-gated via `supportsFormElicitation()` (`src/helpers/elicitation.ts:32-39`).
- **3.10 Dynamic Tools**: ❌ Not Implemented.
- **3.11 Tasks (Experimental)**: ❌ Not Implemented — empty stubs at `src/optional/tasks/*` (SEP-2663 deferred per `OVERRIDES-spec.md`).
- **3.12 Resources (SEP-1865)**: ✅ `registerResource()` (`src/server.ts:217-236`); URI `ui://pomodoro/widget`; MIME `text/html;profile=mcp-app`; `_meta.ui.csp.resourceDomains:["https://assets.claude.ai","https://persistent.oaistatic.com","https://*.oaistatic.com"]` (cross-platform Claude + ChatGPT fonts); `_meta.ui.domain` = `9ba9ea0ee91c9914cbf9f9513d8f27a8.claudemcpcontent.com`; `prefersBorder: false`; capability `resources: { listChanged: true }` declared (`src/server.ts:209`).
- **3.13 Sampling**: ❌ Not Implemented — SEP-2577 deprecated; replaced by `/daily-reflection` + `/plan-focus-session` prompts.

---

## 4. Tool Inventory

**Total Tools**: 5.

### Tool 1: `start_pomodoro`
- **Title**: Start a Pomodoro session — **Description (27 words)**:
> "Start a focused Pomodoro session anchored to a task. Rejects if a focus session is already active — call complete_pomodoro first. Allowed durations: 15, 25, 45, 50 min (default 25)."

**Input** (`src/schemas/inputs.ts:16-27`):

| Param | Type | Req | Constraints |
|---|---|---|---|
| `task` | string | yes | 1–200 chars |
| `duration_minutes` | 15\|25\|45\|50 | no | literal union; default 25 in handler |
| `session_type` | enum | no | focus/short_break/long_break; default `focus` |
| `task_id` | uuid | no | reuse existing task |

**Output** (`src/schemas/outputs.ts:21-32`): session_id, task, task_id, started_at, ends_at, session_type, duration_minutes, today_completed, today_target, current_streak.
**Auth**: JWT-only. Handler: `src/server.ts:239-269`.
**Notes**: pre-flight `resolveActiveSessionConflict` elicitation (`src/server.ts:258`); auto-completes expired sessions (`src/db/queries.ts:226-227`); task get-or-create on `(user_id, label)` (`src/db/queries.ts:75-95`).
**Hints**: readOnly=❌ destructive=❌ idempotent=❌ openWorld=❌ (`src/server.ts:246`). **Prompt**: invoked by `/plan-focus-session`.

---

### Tool 2: `complete_pomodoro`
- **Title**: Complete the active Pomodoro — **Description (28 words)**:
> "Mark a Pomodoro session as completed and roll the streak forward. Idempotent on session_id — calling twice does not double-count. Long break is suggested every 4th completed focus session."

**Input** (`src/schemas/inputs.ts:40-47`): `session_id` (uuid, required), `distractions_count` (int ≥0, optional), `notes` (≤500 chars, optional).
**Output** (`src/schemas/outputs.ts:38-45`): session_id, today_completed, today_target, current_streak, suggested_next, streak_milestone.
**Auth**: JWT-only. Handler: `src/server.ts:277-300`.
**Notes**: atomic D1 batch [UPDATE + UPSERT stats] (`src/db/queries.ts:636-653`); stats anchored on `started_at` date (`src/db/queries.ts:302,592-617`); long break every 4th completed focus (`src/db/queries.ts:325`); no `_meta.ui.resourceUri` (side-effect — widget refreshes via host broadcast, `src/server.ts:272-276`).
**Hints**: readOnly=❌ destructive=❌ idempotent=✅ openWorld=❌. **Prompt**: widget auto-calls at zero (`widget.tsx:451-472`).

---

### Tool 3: `log_distraction`
- **Title**: Log a distraction without breaking focus — **Description (31 words)**:
> "Log a distraction (internal thought or external event) during the active session. Does NOT pause or stop the session — that defeats Cirillo's 'inventory' rule. Description capped at 200 chars; keep it short."

**Input** (`src/schemas/inputs.ts:59-66`): `session_id` (uuid), `type` (internal\|external), `description` (1–200 chars).
**Output** (`src/schemas/outputs.ts:60-64`): distraction_id, session_distraction_count, parked_items[] (oldest-first).
**Auth**: JWT-only. Handler: `src/server.ts:306-323`. **Notes**: pre-checks session ownership (`src/db/queries.ts:359-363`); no `_meta.ui.resourceUri`.
**Hints**: readOnly=❌ destructive=❌ idempotent=❌ openWorld=❌. **Prompt**: none.

---

### Tool 4: `get_today_status`
- **Title**: Get today's Pomodoro dashboard — **Description (22 words)**:
> "Get today's Pomodoro dashboard: active session, completed count, streak, and per-task progress. No parameters. UTC-based 'today' in v1.0 — flag if the user's local midnight differs."

**Input**: explicit empty `{} as const` (`src/schemas/inputs.ts:78`).
**Output** (`src/schemas/outputs.ts:87-94`): active_session (nullable), today_completed, today_target, current_streak, tasks[] (top 10), distractions_today.
**Auth**: JWT-only. Handler: `src/server.ts:326-346`. **Notes**: 2nd widget-render path (`_meta.ui.resourceUri`, `src/server.ts:334`); tasks joined to sessions for `completed_pomodoros` (`src/db/queries.ts:434-447`).
**Hints**: readOnly=✅ destructive=❌ idempotent=✅ openWorld=❌. **Prompt**: pulled by `/plan-focus-session` (and indirectly via `/daily-reflection`).

---

### Tool 5: `get_session_history`
- **Title**: List recent Pomodoro sessions — **Description (36 words)**:
> "List Pomodoro sessions from the last N days (1-30) for pattern analysis. For end-of-day reflection, prefer the `daily-reflection` prompt — it pulls the data automatically and frames the LLM's analysis."

**Input** (`src/schemas/inputs.ts:86-91`): `days` (int 1–30, default 1), `include_distractions` (bool, default true).
**Output** (`src/schemas/outputs.ts:117-120`): sessions[] (started_at DESC, inline distractions) + totals (focus_minutes, completed_sessions, abandoned_sessions, distraction_count).
**Auth**: JWT-only. Handler: `src/server.ts:349-374`. **Notes**: batched `WHERE session_id IN (?,?,...)` distractions query (`src/db/queries.ts:518-531`); window cutoff `today - days + 1` at UTC 00:00 (`src/db/queries.ts:496-499`).
**Hints**: readOnly=✅ destructive=❌ idempotent=✅ openWorld=❌. **Prompt**: invoked by `/daily-reflection` (1 day).

---

## 5. UX & Frontend Quality

### Pillar I: Identity & First Impression
- Unique server name ✅; server/tool icons ❌ (empty `assets/icons/*` dirs).
- All 5 tools provide `title` ✅. Descriptions ≤40 words ✅ (22 / 27 / 28 / 31 / 36).
- Centralized via `src/tools/descriptions.ts`.

### Pillar II: Model Control & Quality
- `server-instructions.ts`: **54 lines / ~406 words / ~530 tokens** — slightly over 500-token target; trim by ~10% if possible (§18.4).
- Coverage: tool selection rules, slash-command usage, distraction-without-pause rule, 4th-pomodoro long-break rule, PL language directive, UTC caveat.
- `inputs.ts` fields all have `.meta({ description })` with ranges + examples ✅.
- Per-tool `outputSchema` ✅.
- Cross-tool routing in description Part-1 + server-instructions §Usage Patterns ✅.

### Pillar III: Interactivity & Agency
- Completions ❌; Elicitation (Form) ✅; Sampling ❌ (deprecated); Prompts ✅ (2); Multi-modal ❌ (text only).

### Pillar IV: Context & Data Management
- Resource URI predeclared ✅; `_meta.ui.csp.resourceDomains` (Claude + ChatGPT) ✅; `_meta.ui.domain` (Claude sandbox SHA-256) ✅; `_meta.ui.prefersBorder: false` ✅; `_meta.ui.icon` / `priority` / `permissions` ❌.
- ResourceLinks / subscriptions ❌; Roots ❌ (deprecated SEP-2577).

### Pillar V: Media & Content Handling
- MIME `text/html;profile=mcp-app` ✅; audio/image/data-URI/audience annotations ❌ N/A.

### Pillar VI: Operations & Transparency
- `tool_started` + `tool_completed` + `tool_failed` structured logs with `duration_ms` (Date.now delta) (`src/server.ts:85-113`).
- `transport_request`, `server_error` events emitted (`src/index.ts:74,49`).
- `isError` flag ✅ — all handler failures route through `toolError()` (`src/server.ts:66-71`).

---

## 6. Deployment Status

### 6.1 Consistency Tests
- **Command**: `bash scripts/audit/audit-server-patterns.sh pomodoro`
- **Result**: ✅ "All checks passed! Server matches reference patterns."

### 6.2 TypeScript Compilation
- **Command**: `npx tsc --noEmit`
- **Result**: ✅ Exit code 0 — no errors.

### 6.3 Production URL
- **Primary Domain**: https://pomodoro.wtyczki.ai (`wrangler.jsonc:100-105`, `custom_domain: true`).
- **`workers_dev`**: ❌ Disabled (`wrangler.jsonc:110`).

---

## 7. Infrastructure Components

- **Cloudflare Assets**: `ASSETS` → `./web/dist/widgets`; build `npm install && npm run build:widgets && npx tsc --noEmit` (`wrangler.jsonc:38-40`).
- **Durable Objects**: ❌ None (state in D1).
- **KV Namespaces**: ❌ None bound on this resource server.
- **D1**: binding `DB`, name `mcp-oauth`, ID `eac93639-d58e-4777-82e9-f1e28113d5b2`. Tables used: shared `users`; per-project `pomodoro_tasks`, `pomodoro_sessions`, `pomodoro_daily_stats`, `pomodoro_distractions` (`migrations/0001_pomodoro_tables.sql`, `migrations/0002_abandoned_at.sql`).
- **R2 / Workers AI / AI Gateway / Workflows**: ❌ Not configured.
- **Public Vars**: `AUTHKIT_DOMAIN = "exciting-domain-65.authkit.app"` (`wrangler.jsonc:94`).
- **Required Secrets (shared)**: ❌ None — `WORKOS_*` MUST NOT be set on resource servers (`lesson_workos_secrets.md`).
- **Server-Specific Secrets**: ❌ None.

---

## 8. Architecture Patterns

### Authentication Architecture
- JWT-only (AuthKit bearer). Flow: `POST /mcp` → `verifyJwt` (issuer-bound, JWKS-cached) → `getUserByWorkosId` (D1, `is_deleted = 0`) → `createMcpHandler(server, { authContext: { props } })`.
- 401 carries RFC 9728 `WWW-Authenticate: Bearer error="unauthorized", resource_metadata="…"`.

### Caching Strategy
- No server-layer cache (per-request fresh `McpServer`). JWKS implicitly cached by `jose.createRemoteJWKSet` for isolate lifetime.

### Concurrency Control
- Single active session per user enforced via `getActiveSession` precheck + `WHERE completed_at IS NULL AND abandoned_at IS NULL` clauses (`src/db/queries.ts:127-135`, `:316`).

### Storage Architecture
- D1 normalized 4-table schema: tasks (1:N) sessions (1:N) distractions; daily_stats is a write-through projection rebuilt atomically by D1 batch on each focus completion (`src/db/queries.ts:629-653`).

---

## 9. Code Quality

### Type Safety
- TS strict ✅; Zod 4 via `zod/v4` subpath ✅; widget mirrors output types via `web/lib/types.ts`.
- D1 row interfaces (`SessionRow`, `TaskRow`, `DistractionRow`) exported from `db/queries.ts`.

### Error Handling
- D1 user lookup wraps `try/catch` returning `null` (`src/auth/auth-utils.ts:14-23`).
- JWT verify wraps `try/catch` returning `null` on any failure (`src/auth/jwt-verify.ts:27-35`) — see §18.3.
- Tool wrapper `runTool` converts thrown errors to `{ content, isError: true }` (`src/server.ts:106-114`).
- Elicitation transport error → `unsupported` fallback (`src/helpers/elicitation.ts:60-65`).
- Top-level fetch catch logs `server_error` + JSON 500 (`src/index.ts:48-54`).
- Active-session conflict: per-action message via `ACTIVE_SESSION_ERROR_HINT` (`src/server.ts:129-131`).

### Observability
- Cloudflare Observability enabled (`wrangler.jsonc:115-117`).
- Log events: `transport_request`, `tool_started`, `tool_completed` (with `user_id`, `user_email`, `action_id`, `duration_ms`), `tool_failed`, `server_error`.
- `auth_attempt` type declared in `shared/logger.ts:78-84` but ✅ NOT emitted on JWT failure (§18.3).

---

## 10. Technical Specifications

### Performance
- D1 query latency: ~5–30 ms per call (user-scoped indexes); whole tool call <100 ms typical.
- JWT verify: ~10–50 ms (JWKS cached after first call).
- Widget polling: 30 s server resync + 1 Hz local tick (gated on visibility).
- Widget bundle: single-file HTML (Vite + viteSingleFile).
- Tool response payload: ~1–4 KB; history can grow with `days` × sessions.

### Dependencies — Common
```json
{
  "@modelcontextprotocol/ext-apps": "^1.7.0",
  "@modelcontextprotocol/sdk": "^1.29.0",
  "agents": "^0.11.5",
  "jose": "^6.1.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "zod": "^4.1.13"
}
```

### Dependencies — Widget-Specific
```json
{
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.4.0"
}
```

### Dependencies — Development
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
- MCP SDK `^1.29.0` · ext-apps `^1.7.0` · agents `^0.11.5` · jose `^6.1.0` · zod `^4.1.13` (via `zod/v4`).
- React `^19.2.0` · Vite `^6.0.6` (skeleton-current uses `^7.3.0`, see §18.2).

---

## 11. Compliance Summary

| Check | Status | Notes |
|---|---|---|
| Vendor Hiding | ✅ | No vendor names in descriptions |
| Dual Auth Parity | N/A | JWT-only by design |
| 4-Part Descriptions | ✅ | Part1+Part4 concatenated, ≤40 words |
| Custom Domain | ✅ | pomodoro.wtyczki.ai |
| Workers.dev Disabled | ✅ | `workers_dev: false` |
| Consistency Tests | ✅ | audit-server-patterns.sh clean |
| TypeScript Compilation | ✅ | `tsc --noEmit` exit 0 |
| Prompts Implemented | ✅ | 2 prompts |
| Zod Schema Shape | ✅ | Plain object (ZodRawShapeCompat) |
| Tool Naming | ✅ | snake_case (spec-compliant) |
| Error Handling | ✅ | `isError: true` + structured `tool_failed` log |
| Color-scheme Meta | ✅ | `web/widgets/widget.html:6` |
| Cross-env Build | ✅ | `cross-env INPUT=…` |
| Fresh-McpServer Pattern | ✅ | `createServer(env)` per request |
| `_meta.ui.resourceUri` (v0.4.0+) | ✅ | nested form on start + status tools |
| Sampling Removed (SEP-2577) | ✅ | No `createMessage` in source |
| Widget `h-[500px]` + `sendSizeChanged` | ✅ | `widget.tsx:571`, `widget.tsx:378` |
| `applyHostStyleVariables` + `applyHostFonts` | ✅ | `widget.tsx:359-360` |
| `server-instructions.ts` ≤500 tokens | ⚠️ | ~530 tokens — trim (§18.4) |
| JWT `audience` claim validation | N/A | Intentionally not asserted (security-patterns.md §2) |
| Structured `auth_attempt` log on failure | ❌ | Bare `catch {}` swallows reason (§18.3) |

---

## 12. Unique Architectural Features

### Elicitation-Driven Conflict Resolution
- `start_pomodoro` runs an inline `oneOf` elicitation when an active session exists, with 3 explicit choices (`src/server.ts:140-199`).
- Capability-gated; declines fall back to the same error the LLM would have seen, so the agent recovery path stays valid.

### Atomic D1 Batch for Stats Write-Through
- Completion + daily_stats recompute share one D1 `batch([UPDATE, UPSERT])` transaction (`src/db/queries.ts:629-653`); rolls back together if either fails — no risk of closed session with stale stats.

### Started-At Date Anchoring for Streaks
- Daily_stats key on `substr(started_at, 1, 10)`, not `completed_at` (`src/db/queries.ts:302`, `:592-617`). A 23:51→00:16 session credits the day it began — invariant across midnight, no cron-rollover race.

### Persistent Widget State via `window.openai.setWidgetState`
- Widget snapshots `active_session_id` + `active_ends_at` on `onteardown` and re-reads on connect (`widget.tsx:48-64`, `:363-371`); survives remount even before server resync arrives.

---

## 13. Known Issues & Limitations

1. UTC-only "today" — flagged in tool description + server-instructions; users in PL get a daily-boundary mismatch around 00:00–02:00 local.
2. No tool/server icons; empty `assets/icons/` dirs.
3. JWT verify uses bare `catch {}` — no structured `auth_attempt` log on failure (§18.3).
4. `resources: { listChanged: true }` advertised but no list-changed notification is ever emitted.
5. Widget pause is local-only — server `ends_at` keeps ticking; long pauses cause negative-time flash before auto-complete (§18.5).
6. `server-instructions.ts` ~530 tokens, slightly over the 500-token target.
7. No unit/integration tests; manual checklist only.
8. Skeleton TODO/placeholder strings still present in `types.ts:8`, `ui-resources.ts:121,128,143` (§18.6).

---

## 14. Future Roadmap

### Planned Components
- Tool/server icons once repo-wide convention emerges.
- User timezone column on `users` for non-UTC "today" (v1.1).
- Replace `catch {}` in `verifyJwt` with structured `auth_attempt` log event (per `security-patterns.md` §2).
- Server-side pause primitive (separate `pause_pomodoro` tool storing `paused_at` + accumulated pause ms).

### Planned Use Cases
- Weekly/monthly aggregates (`get_focus_summary` tool over multi-week window).
- Distraction-pattern clustering by hour-of-day for the LLM.
- Per-task `planned_pomodoros` user override (currently auto-bumped only).

---

## 15. Testing Status

### Unit Tests
❌ Not implemented.

### Integration Tests
❌ Not implemented.

### Manual Testing Checklist
- [x] JWT flow (AuthKit-issued bearer)
- [x] `start_pomodoro` happy path + auto-complete-on-expired
- [x] Active-session conflict via elicitation (3 branches)
- [x] `complete_pomodoro` idempotency (same session_id twice)
- [x] `log_distraction` does not pause widget timer
- [x] Widget light + dark themes
- [ ] Cross-midnight session — stats anchor on start date
- [ ] Account-deleted user (D1 `is_deleted = 1`)

---

## 16. Documentation Status

- README: ❌ Absent (repo `private: true`).
- `server-instructions.ts`: ⚠️ Complete; slightly over 500-token target.
- Setup Guide: ❌ Absent.
- Troubleshooting Guide: ❌ Absent.
- Deployment Guide: ✅ `docs/DEPLOYMENT_CHECKLIST.md`.
- Auth Contract: ✅ `docs/PANEL_AUTH_CONTRACT.md`.
- Server Docs: ✅ `docs/server-docs.md`.
- Improvement Ideas: ❌ Absent (no `IMPROVEMENT_IDEAS.md`).
- Audit Report: ✅ `SERVER_AUDIT_REPORT.md` (auto-generated, clean).

---

## 17. File Structure

### `src/`
```
src/
├── index.ts                    # Fetch entry + JWT pre-handler + createMcpHandler dispatch
├── server.ts                   # createServer factory; 5 tools, 1 resource, 2 prompts
├── server-instructions.ts      # System prompt (~530 tokens)
├── well-known.ts               # RFC 9728 + RFC 8414 + WWW-Authenticate builder
├── types.ts                    # Env (ASSETS, DB, AUTHKIT_DOMAIN) + ResponseFormat enum (unused)
├── auth/{jwt-verify,auth-utils}.ts          # AuthKit JWKS + D1 user lookup
├── db/queries.ts                            # 4-table D1 layer (sessions/tasks/distractions/stats)
├── helpers/{assets,elicitation}.ts          # loadHtml + form-mode elicitation helper
├── resources/ui-resources.ts                # UI_RESOURCES registry + CSP + Claude sandbox domain
├── schemas/{inputs,outputs}.ts              # ZodRawShapeCompat for 5 tools
├── shared/{constants,logger}.ts             # SERVER_CONFIG + structured logger
├── tools/{descriptions,index}.ts            # TOOL_METADATA + getToolDescription
└── optional/                                # 9 EMPTY 0-byte stubs (delete candidates — completions, elicitation, prompts, resources, tasks, ui)
```

### `web/`
```
web/
├── widgets/{widget.html,widget.tsx}        # color-scheme meta + React widget (timer ring + Chart-less)
├── components/ui/{button,card,badge}.tsx   # shadcn primitives
├── lib/{types,utils}.ts                    # mirrored output types + cn helper
└── styles/globals.css                      # MCP host vars + shadcn HSL vars
```

### Configuration Files
- `wrangler.jsonc` — ASSETS, D1, AUTHKIT_DOMAIN, pomodoro.wtyczki.ai route.
- `package.json` — SDK ^1.29.0, ext-apps ^1.7.0, agents ^0.11.5, zod ^4.1.13.
- `tsconfig.json` — server TS config.
- `vite.config.ts` — root=`web/`, viteSingleFile, `emptyOutDir: false`.
- `tailwind.config.js`, `postcss.config.js`.
- `migrations/000{1,2}_*.sql` — D1 schema + abandoned_at column.

### Common Scripts
```json
{
  "dev": "wrangler dev",
  "dev:widget": "cross-env INPUT=widgets/widget.html vite build --watch",
  "dev:full": "concurrently \"npm run dev\" \"npm run dev:widget\"",
  "build:widget": "cross-env INPUT=widgets/widget.html vite build",
  "build:widgets": "npm run build:widget",
  "watch": "cross-env INPUT=widgets/widget.html vite build --watch",
  "deploy": "npm run build:widgets && wrangler deploy",
  "type-check": "tsc --noEmit",
  "pre-commit": "npm run type-check && npm run build:widgets",
  "verify-deploy": "npm ci && npx wrangler deploy --dry-run --outdir /tmp/wrangler-dry-run",
  "cf-typegen": "wrangler types"
}
```

---

**End of Snapshot**

---

## Appendix A: Two-Part Registration Snippet

**Part 1 — Register Resource** (`src/server.ts:217-236`):
```typescript
server.registerResource(
  "widget",
  widgetResource.uri,                      // "ui://pomodoro/widget"
  {
    mimeType: RESOURCE_MIME_TYPE,
    description: widgetResource.description,
    _meta: { ui: widgetResource._meta.ui! },
  },
  async () => {
    const templateHTML = await loadHtml(env.ASSETS, "/widget.html");
    return { contents: [{
      uri: widgetResource.uri,
      mimeType: RESOURCE_MIME_TYPE,
      text: templateHTML,
      _meta: widgetResource._meta as Record<string, unknown>,
    }] };
  },
);
```

**Part 2 — Register Tool** (`src/server.ts:239-269`, abbreviated):
```typescript
server.registerTool("start_pomodoro", {
  title: TOOL_METADATA.start_pomodoro.title,
  description: getToolDescription("start_pomodoro"),
  inputSchema: StartPomodoroInput,
  outputSchema: StartPomodoroOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  _meta: { ui: { resourceUri: widgetResource.uri } },   // nested v0.4.0+
}, async (rawParams, extra) => { /* ... runTool wrapper + elicitation pre-flight */ });
```

---

## Appendix B: AnythingLLM Configuration

```json
{
  "mcpServers": {
    "pomodoro": {
      "url": "https://pomodoro.wtyczki.ai/mcp",
      "transport": "http",
      "headers": { "Authorization": "Bearer <AUTHKIT_JWT>" }
    }
  }
}
```
JWT-only since 2026-05-18. Obtain bearer via OAuth 2.1 flow against `https://exciting-domain-65.authkit.app`.

---

## Appendix C: Architecture Pattern Match

Hybrid of **Stateful D1-Backed Server** + **Elicitation** + **Persistent Widget**: state lives in 4 user-scoped D1 tables (no DO); widget polls server every 30 s and ticks locally at 1 Hz; elicitation negotiates active-session conflicts inline; 2 prompts seed end-of-day reflection and task-decomposition flows.

---

## Appendix D: Quick Commands

### Development
```bash
cd projects/pomodoro
npm run dev           # wrangler dev (server only)
npm run dev:widget    # vite --watch on widget.html
npm run dev:full      # both in parallel
npm run type-check    # tsc --noEmit
```

### Build & Deploy
```bash
npm run build:widgets
git push              # Workers Builds deploys (per CLAUDE.md rule #1)
```

### Secrets
❌ None. `AUTHKIT_DOMAIN` is a public var. `WORKOS_*` MUST NOT be set here.

### Testing
```bash
bash scripts/audit/audit-server-patterns.sh pomodoro
cd projects/pomodoro && npx tsc --noEmit
npm run probe:protocol -- https://pomodoro.wtyczki.ai/mcp <jwt>
```

---

## 18. Recommendations

### 18.1 Likely Bugs
- **[MED]** Widget "pause" is purely cosmetic — `paused` gates the local tick + auto-complete useEffect, but the server's `ends_at` keeps advancing. A 5-minute pause silently consumes 5 min of session time; the next 30 s server resync surfaces a negative remaining (`widget.tsx:431-435,445-449`). Either add a server-side `pause_pomodoro` tool or relabel the button as "ignore countdown" / remove it.
- **[LOW]** `progressDots` in widget passes `Math.max(planned, completed)` as `planned` (`widget.tsx:613`), masking the case where `completed > planned` — defeats the auto-bump signal from `bumpTaskPlannedIfNeeded` (`src/db/queries.ts:105-121`). Render the raw values.
- **[LOW]** `getTodayStatus` reads `distractions_today` with `WHERE logged_at >= '${today}T00:00:00.000Z'` (`src/db/queries.ts:449-451`) but never an upper bound — if `logged_at` somehow lands in the future (clock skew on legacy rows) it counts toward today. Add `AND logged_at < '${tomorrow}T00:00:00.000Z'` for safety.

### 18.2 Spec / Convention Drift
- **[MED]** `helpers/assets.ts:62-98` defines an unused `WidgetConfig` interface + `createUiMeta` helper. `UI_RESOURCES` already builds its own `_meta` — drift between the two is a footgun. Delete the unused exports.
- **[LOW]** `resources: { listChanged: true }` capability declared (`src/server.ts:209`) but the server never emits `notifications/resources/list_changed`. Either drop the capability or implement the notification path.
- **[LOW]** `package.json` pins `vite@^6.0.6` while skeleton-canonical is `^7.3.0` (per ads-roi). Bump in next maintenance pass; no breaking changes expected on `viteSingleFile`.
- **[LOW]** `types.ts:21` ResponseFormat enum is exported but never imported anywhere — dead code from skeleton; delete.

### 18.3 Security & Auth Concerns
- **[MED]** `verifyJwt` silently swallows all errors via bare `catch {}` (`src/auth/jwt-verify.ts:33-35`). `security-patterns.md` §2 prescribes emitting `logger.warn({ event: 'auth_attempt', method: 'oauth', success: false, reason })`. The `auth_attempt` type is already declared in `shared/logger.ts:78-84` — just wire it up. Without it, expiry / signature / unknown-issuer cases are invisible in `wrangler tail`.
- **[LOW]** `wrangler.jsonc:52-53` comment "Contains: users, api_keys tables" — `api_keys` table is unused since 2026-05-18 platform-wide. Update the comment to avoid implying API-key auth still exists.

### 18.4 Performance & Cost
- **[LOW]** `server-instructions.ts` is ~530 tokens (54 lines / 406 words) — over the 500-token target. Trim "Example queries" block (5 PL lines) or fold "Performance & Limits" into single-sentence form to land under 500.
- **[LOW]** `getTodayStatus` issues 4 sequential D1 calls (stats, active, optional task-by-id, tasks, distractions count) — could batch via `env.DB.batch()` to cut RTT on the widget mount path (`src/db/queries.ts:413-466`).

### 18.5 UX / Frontend
- **[LOW]** Widget renders "Łączenie…" (`widget.tsx:562`) only until `connect()` resolves; if `connect()` hangs (host issue) there's no timeout / retry signal. Consider a 10 s fallback message.
- **[LOW]** Distraction modal `<input>` has no `name` / `id` and no `aria-label` (`widget.tsx:118-126`) — screen readers announce nothing. Add `aria-label="Opis rozproszenia"`.

### 18.6 Dead Code / Stale Stubs
- **[LOW]** Seven 0-byte skeleton stubs under `src/optional/*` (completions/dynamic-enums, elicitation/{forms,url-input}, prompts/{index,workflows}, resources/{index,templates}, tasks/{async-executor,task-store}, ui/component-generator). None are imported. `git rm` to reduce tree noise.
- **[LOW]** Skeleton placeholders remain in JSDoc / strings: `types.ts:8` ("TODO: Replace pomodoro placeholders"), `ui-resources.ts:121` ("TODO: Replace pomodoro with your actual server ID"), `ui-resources.ts:128` ("TODO: Replace with your actual widget configuration"), `ui-resources.ts:143` ("TODO: Replace with a detailed description"). Replace or remove.
- **[LOW]** `wrangler.jsonc:9-13` "CUSTOMIZATION CHECKLIST" header is leftover skeleton scaffolding — server is now production. Trim or rephrase.
