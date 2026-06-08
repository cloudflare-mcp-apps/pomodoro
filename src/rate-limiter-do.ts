/**
 * Per-user request-tempo limiter for authenticated MCP servers — SHARED FLEET HELPER.
 * Byte-identical across every server; rolled out via scripts/rollout-rate-limiter.mjs.
 *
 * Keyed by workos_user_id (JWT `sub`) — a stable identity that is immune to
 * shared-egress NAT and IP rotation (claude.ai / Claude Code egress pools), so
 * legit users sharing an egress IP never collide. One DO instance per user.
 *
 * Scope: gates ALL JSON-RPC methods (initialize / tools/list / tools/call),
 * unlike the daily quota (free-quota.ts) which only meters tools/call. This is
 * the layer that stops a wired-in agent looping the handshake 24/7 — the abuse
 * pattern the daily quota structurally cannot see. The two are complementary:
 *   - rate-limiter-do.ts → request tempo, all methods, per minute + per hour
 *   - free-quota.ts       → cost budget, tools/call only, per day
 *
 * Limits are deliberately LOOSE: a legit interactive session does <60 requests
 * a day; these thresholds only bite a runaway loop. Minimising false positives
 * beats tightness for a soft abuse cap (auth itself is the security boundary).
 *
 * Design (proven in PUBLIC_SERVER_PROTECTION_PLAYBOOK.md §3.1):
 *   - hourly window is STORAGE-BACKED — abuse loops idle 1-3 min between
 *     iterations, long enough for DO eviction to reset an in-memory Map, so an
 *     in-memory-only hourly counter never accumulates (verified negative result).
 *   - burst window stays in-memory — a burst keeps the DO alive within its own
 *     60s window; eviction slack is acceptable there.
 *   - storage writes stop at limit+1 per window → a rejected user writes nothing.
 */

import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";

const LIMITS = {
  burst:  { limit: 30,  periodMs: 60_000 },     // handshake / protocol storms
  hourly: { limit: 300, periodMs: 3_600_000 },  // sustained 24/7-loop budget
} as const;

const PERSISTED = new Set<keyof typeof LIMITS>(["hourly"]); // survive eviction

interface Window { window: number; count: number; }

export class RateLimiterDO extends DurableObject<Env> {
  private windows = new Map<keyof typeof LIMITS, Window>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      for (const kind of PERSISTED) {
        const w = await ctx.storage.get<Window>(kind);
        if (w) this.windows.set(kind, w);
      }
    });
  }

  private hit(kind: keyof typeof LIMITS): boolean {
    const { limit, periodMs } = LIMITS[kind];
    const window = Math.floor(Date.now() / periodMs);
    const cur = this.windows.get(kind);
    const next: Window = cur && cur.window === window
      ? { window, count: cur.count + 1 }
      : { window, count: 1 };
    this.windows.set(kind, next);
    if (PERSISTED.has(kind) && next.count <= limit + 1) {
      void this.ctx.storage.put(kind, next);
    }
    return next.count <= limit;
  }

  async check(): Promise<boolean> {
    const burstOk = this.hit("burst");
    const hourlyOk = this.hit("hourly");
    return burstOk && hourlyOk;
  }
}
