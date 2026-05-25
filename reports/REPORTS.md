---
generator: scripts/ops/reports-status.mjs
generated: 2026-05-25
kind: manifest
---

# Reports Manifest — pomodoro

**AI workflow: read this first.** Single entry-point to every generated report for this server, with freshness vs current source. Auto-generated — do not hand-edit. Contract: `production_docs/REPORTS_CONVENTION.md`.

Source fingerprint: `091da442` · package version: `1.0.0` · refreshed: 2026-05-25

## Canonical reports (`reports/`)

| Report | Generator | Generated | source@ | Status |
|--------|-----------|-----------|---------|--------|
| `snapshot.md` | `/snapshot-server` | 2026-05-25 | `091da442` | ✅ FRESH |
| `description.md` | `/describe-server` | 2026-05-25 | `091da442` | ✅ FRESH |
| `design-audit.md` | `/audit-design` | 2026-05-19 | `7bd56dc5` | ⚠️ STALE |
| `ui-audit.md` | `/improve-ui-with-shadcn` | — | `—` | ⬜ MISSING |
| `ideas.md` | `/improve` | — | `—` | ⬜ MISSING |

## Runtime captures (dated)

- eval: 1 capture(s) — reports/eval/2026-05-24
- probe: 0 capture(s)

## DAG (regeneration order)

```
snapshot.md → { description.md, design-audit.md, ui-audit.md, ideas.md }
deployed worker → eval/, probe/  (runtime, parallel track)
```

STALE derivative → regenerate `snapshot.md` first if it is STALE, then the derivative.
Regenerate this manifest: `node scripts/ops/reports-status.mjs pomodoro`
