/**
 * Fleet usage analytics — SHARED FLEET HELPER (keep byte-identical across servers).
 *
 * Writes one data point per `tools/call` into the shared `mcp_usage` Analytics
 * Engine dataset. Layout is the fleet standard — it matches mcp-oauth's central
 * writer (userinfoFree.ts) AND the reader in the monitoring repo
 * (src/collectors/mcp_usage.py), so per-user / per-server / per-tool analytics
 * work without any per-server special-casing:
 *
 *   indexes = [server]                          // sampling/index key
 *   blobs   = [server, userId, email, tool]     // blob1..blob4
 *   doubles = [1]                               // one call
 *
 * Runs under `ctx.waitUntil` on a request CLONE — it must never block or fail the
 * MCP request (analytics is best-effort; the request path is sacred). The body is
 * a one-shot stream, so callers pass the rebuilt request from applyFreeQuota()
 * (whose body is re-readable), and we clone it here before reading.
 */

import type { Env } from "../types";

export async function recordToolUsage(
  env: Env,
  request: Request,
  who: { server: string; userId: string; email: string },
): Promise<void> {
  if (!env.USAGE) return;
  try {
    const msg = (await request.clone().json()) as {
      method?: string;
      params?: { name?: string };
    };
    // Only billable tool invocations are logged; initialize / tools/list /
    // resources/read pass through unrecorded (same gate as applyFreeQuota).
    if (msg?.method !== "tools/call" || !msg.params?.name) return;
    env.USAGE.writeDataPoint({
      indexes: [who.server],
      blobs: [who.server, who.userId, who.email, msg.params.name],
      doubles: [1],
    });
  } catch {
    // analytics must never break the request path
  }
}
