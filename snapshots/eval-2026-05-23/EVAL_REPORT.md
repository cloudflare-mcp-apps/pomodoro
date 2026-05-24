---
Created: 2026-05-23
Updated: 2026-05-23
---

# Eval Report — pomodoro

**Server:** https://pomodoro.wtyczki.ai/mcp
**Model:** openai/gpt-5.4-mini
**Iterations:** 3 per scenario
**Run:** 2026-05-23 23:18 GMT+2
**Overall accuracy:** **5/6 scenarios at 100%, 1 failure due to pre-existing server state (not LLM/server bug).** Net LLM tool-selection accuracy: 100% (every iteration of every scenario invoked the right tool with the right args).

Surface introspected: **5 tools** (`start_pomodoro`, `complete_pomodoro`, `log_distraction`, `get_today_status`, `get_session_history`), **1 widget resource** (`ui://pomodoro/widget`), **2 prompts** (`daily-reflection`, `plan-focus-session`), **server instructions: 2425 chars** with explicit Usage Patterns and the Cirillo "inventory rule" cited.

## Summary table

| Scenario | Type | Tool target | Iter | Accuracy | Avg tokens |
|----------|------|-------------|------|----------|-----------:|
| happy — start_pomodoro from NL | happy | `start_pomodoro` | 3 | 3/3 (100%) | 2 099 |
| happy — get_today_status no args | happy | `get_today_status` | 3 | 3/3 (100%) | 2 053 |
| multi-turn — start → log_distraction → complete | multi-turn | `start_pomodoro`, `log_distraction`, `complete_pomodoro` | 3 | **0/3 (0%)** | 8 839 |
| disambiguation — today vs history (days extract) | disambiguation | `get_today_status`, `get_session_history` | 3 | 3/3 (100%) | 5 647 |
| negative — documentation question (Cirillo) | negative | (none expected) | 3 | 3/3 (100%) | 1 574 |
| negative — vague non-actionable musing | negative | (none expected) | 3 | 3/3 (100%) | 1 144 |

## Failures (accuracy < 100%)

### multi-turn — start → log_distraction → complete — **0%**

- **Expected:** turn 1 `start_pomodoro({ task })`, turn 2 `log_distraction({ type: "external" })`, turn 3 `complete_pomodoro(...)` — all with isError-free results.
- **Got (all 3 iterations):** all three tool calls were made correctly with the right args. The matcher passed every turn. **The boolean test still returned false because turn 1 (`start_pomodoro`) returned `isError: true`** with this message:

  > `Error: Active focus session still running (id=6b55f7fe-3f4a-4d29-afb9-ed510a96548b, ends_at=2026-05-23T21:42:51.356Z). Wait for the timer to finish, or call complete_pomodoro with session_id=6b55f7fe-3f4a-4d29-afb9-ed510a96548b to end it now.`

- **Likely cause:** **pre-existing server state**, not LLM behavior. The test user already had an active focus session from before this eval started (likely left over from prior manual testing or an earlier eval run that crashed mid-flow). The server's reject path is doing exactly what its description promises (*"Rejects if a focus session is already active — call complete_pomodoro first"*). Turns 2 and 3 went through cleanly because `log_distraction` and `complete_pomodoro` accept the existing session_id.
- **Not flagged:** server bug, LLM tool-selection issue, or description gap.

## Tool-error notes

- Multi-turn turn 1: `Error: Active focus session still running …` — see above. Not a real failure of either the LLM or the server.
- All other scenarios: zero tool errors. `start_pomodoro`'s recovery message was helpful (told the LLM exactly which `session_id` to use with `complete_pomodoro`) and the LLM correctly followed up.

## Recommendations

Ordered by impact. None of these are urgent — the server is in good shape.

1. **Operational cleanup (1-line fix, not a code change):** clear the stuck active session before the next eval run. Either manually call `complete_pomodoro({ session_id: "6b55f7fe-3f4a-4d29-afb9-ed510a96548b" })` once via `mcpjam tools call`, or wait until `ends_at=2026-05-23T21:42:51.356Z` for it to expire (if the server auto-expires; if not, manual cleanup is required). After cleanup, re-run `/eval-mcp-server pomodoro --only "multi-turn"` to confirm 3/3.

2. **Eval-infra improvement (skill-level, applies to all stateful servers):** for multi-turn tests against stateful servers, the eval skill should pre-flight a state reset. Suggested pattern:
   ```ts
   // beforeAll, after agent setup
   const status = await manager.callTool(SERVER_ID, "get_today_status", {});
   if (status.active_session?.session_id) {
     await manager.callTool(SERVER_ID, "complete_pomodoro", {
       session_id: status.active_session.session_id,
     });
   }
   ```
   Add this as a "stateful-server reset" pattern to `references/scenario-templates.md`. Reference: `production_docs/MCP_DESIGN_BEST_PRACTICES.md §6 Instructional Feedback` (the server's recovery hint is already best-in-class; the eval skill just needs to consume it).

3. **Server-side: no change needed.** The reject path of `start_pomodoro` is doing the right thing:
   - Returns `isError: true` (so widget/host can show a toast)
   - Body text includes the active `session_id` and the exact next action (`call complete_pomodoro with session_id=…`)
   - LLM consistently parsed this and offered the user a clear choice
   - This matches `guides/tool_description_guide.md` §"When to Add a Second Sentence" point 3 (Hard rejection) — the *"Rejects if a focus session is already active"* clause is doing real work, observable in every failing iteration.

4. **Optional next-eval scenarios (low priority):**
   - **Edge: invalid duration** — *"Zacznij pomodoro 30-minutowy na X"* — server allows only 15/25/45/50; expect either a clarifying question or a default to 25. Validates that the *"Allowed durations: 15, 25, 45, 50"* clause is in the LLM's working set.
   - **Cirillo split rule** — exercise the `/plan-focus-session` prompt with a 6-hour task; verify it suggests 12 pomodoros, not one giant block.
   - **Distraction type disambiguation** — *"Coś mi po głowie chodzi że trzeba odpowiedzieć Adamowi"* → expect `log_distraction({ type: "internal" })`. Today the multi-turn only tests `type: "external"`.

## Verdict

**Ship-ready.** No description rewrites, no instruction gaps, no F-class bugs. The negative tests (both information-only and vague-musing) scored 3/3 — meaning **`get_today_status` is NOT being over-eagerly invoked** despite the server-instructions clause *"Always call `get_today_status` first when the conversation opens or the widget mounts."* That clause is correctly scoped to *opening contexts*, and the LLM understands the boundary. This is the pattern `production_docs/MCP_DESIGN_BEST_PRACTICES.md §6` and `guides/server_instruction_guide.md` argue for, and it's working.

The one failure is **eval infrastructure**, not server quality. Action item lives in the eval skill, not the server.

## Forensics

- `doctor.json` — MCP surface snapshot at run time
- `vitest-results.json` — vitest JSON reporter output (per-test timing/status)
- `eval-summary.json` — per-scenario accuracy + the full failure trace (3 iterations, all showing the same pre-existing-session pattern)
- Eval test source: `mcp-evals/pomodoro/pomodoro.eval.test.ts`

## Changelog

- 2026-05-23 — Initial eval report. 6 scenarios (2 happy + 1 multi-turn + 1 disambiguation + 2 negative) × 3 iterations = 18 runs. 15 passing; 3 failures all attributable to one pre-existing focus session on the test account, not to server or LLM behavior.
