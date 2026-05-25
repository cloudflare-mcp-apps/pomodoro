---
Created: 2026-05-24
Updated: 2026-05-24
---

# Eval Report — pomodoro

**Server:** https://pomodoro.wtyczki.ai/mcp
**Model:** openai/gpt-5.4-mini
**Iterations:** 3
**Run:** 2026-05-24 22:56 CET
**Overall accuracy:** 5/6 scenarios passed at 100%; avg accuracy 0.89 across all 6.

## Summary table

| Scenario | Type | Tool target | Iter | Accuracy | Avg tokens |
|----------|------|-------------|------|----------|-----------:|
| happy — start_pomodoro from NL | happy | start_pomodoro | 3 | 1/3 (33%) | 2238 |
| happy — get_today_status no args | happy | get_today_status | 3 | 3/3 (100%) | 2113 |
| multi-turn — start → log_distraction → complete | multi-turn | start_pomodoro, log_distraction, complete_pomodoro | 3 | 3/3 (100%) | 8259 |
| disambiguation — today_status vs session_history | disambiguation | get_today_status / get_session_history | 3 | 3/3 (100%) | 8621 |
| negative — documentation question | negative | (none) | 3 | 3/3 (100%) | 1503 |
| negative — vague non-actionable musing | negative | (none) | 3 | 3/3 (100%) | 1176 |

## Failures (accuracy < 100%)

### happy — start_pomodoro from NL — 33%
- **Expected:** `start_pomodoro({ task, duration_minutes: 25, session_type: "focus" })`
- **Got:** Tool selection was **correct on all 3 iterations** — the LLM extracted `task="Napisanie raportu kwartalnego"`, `duration_minutes=25`, `session_type="focus"` every time. Iterations 2 and 3 failed `captureToolErrors`, not the matcher.
- **Tool error (iter 2–3):** `Active focus session still running (id=…, ends_at=…). Wait for the timer to finish, or call complete_pomodoro with session_id=… to end it now.`
- **Root cause:** Not an LLM tool-selection problem and not a tool-description problem. The server is stateful (one active focus session per user). Iteration 1 opens a 25-minute session; iterations 2–3 hit the single-session guard and the tool returns `isError: true`. The eval harness runs 3 iterations without cleaning up the session between them.
- **Note:** The tool's error message is well-designed — it states the conflict and gives a concrete recovery path (`complete_pomodoro`). This is correct product behavior, not a bug.

## Recommendations

1. **Fix the eval harness, not the server.** Add a cleanup step to the `start_pomodoro` scenario so each iteration ends its session before the next begins — call `complete_pomodoro` (or a reset) in the test's per-iteration teardown, or set `iterations: 1` for stateful "start" scenarios. This is a test-harness limitation; the deployed tool behaves correctly. (No canonical guide — eval-skeleton concern.)
2. **Optional product consideration:** if a smoother UX is wanted, `start_pomodoro` could accept a `replace_active: true` arg, or the server instructions could tell the LLM to call `complete_pomodoro` first when a session is already running. Reference: `guides/server_instruction_guide.md` §"Usage Patterns". Low priority — current guard + recovery message is acceptable.
3. **No tool-description changes needed.** All 5 non-stateful scenarios passed at 100%, including both negatives and the disambiguation test — tool descriptions and `initInfo.instructions` (2425 chars) are doing their job.

## Changelog

- 2026-05-24 — Initial eval report (6 scenarios, 3 iterations each). 5/6 at 100%; the single failure is a harness state-cleanup artifact, not a tool-selection or description defect.
