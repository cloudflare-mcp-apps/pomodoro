---
generator: /audit-design
generated: 2026-05-19
source_commit: 7bd56dc5
depends_on: [snapshot.md]
---

# Server Audit Report: pomodoro

**Generated:** 2026-05-19 21:40:47 UTC
**Audit Script:** scripts/audit-server-patterns.sh

## Summary

| Metric | Count |
|--------|-------|
| Checks Passed | 14 |
| Drift Detected | 0 |

## Reference Versions (from skeleton)

| Package | Reference Version |
|---------|-------------------|
| @modelcontextprotocol/ext-apps | ^1.7.0 |
| @modelcontextprotocol/sdk | ^1.29.0 |
| zod | ^4.1.13 |

## Status: No Drift Detected

This server matches current reference patterns.

## Reference Sources

Pattern comparisons based on:
1. `mcp-apps/patterns/EXTRACTED/` - Auto-generated from official SDK examples
2. `mcp-server-skeleton-ideal/` - Production-ready skeleton
3. `.claude/rules/` - Actionable rules for Claude

To update references: `./scripts/sync-upstream-full.sh`
