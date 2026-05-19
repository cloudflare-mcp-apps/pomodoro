/**
 * Elicitation helper for the Pomodoro server.
 *
 * Wraps the SDK's low-level `server.server.elicitInput(...)` with:
 *  - Client capability detection (per-spec form/url negotiation)
 *  - Three-action outcome handling (accept | decline | cancel | unsupported)
 *
 * Form mode only for now — URL mode requires a separate authenticated
 * endpoint with session-cookie identity binding (see server-instructions
 * and the elicitation spec §URL Mode phishing protection). No pomodoro
 * use case currently warrants the URL flow.
 *
 * @module helpers/elicitation
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ElicitRequestFormParams, ElicitResult, RequestId } from "@modelcontextprotocol/sdk/types.js";

export type ElicitOutcome<T> =
  | { kind: "accept"; content: T }
  | { kind: "decline" }
  | { kind: "cancel" }
  | { kind: "unsupported" };

/**
 * True when the connected client declared form-mode elicitation support.
 *
 * Per spec backwards-compat rule, an empty `elicitation: {}` object is
 * equivalent to `{ form: {} }`. A client that only declares `{ url: {} }`
 * (without `form`) does NOT support form mode.
 */
export function supportsFormElicitation(server: McpServer): boolean {
  const caps = server.server.getClientCapabilities();
  const e = caps?.elicitation;
  if (!e) return false;
  const keys = Object.keys(e as Record<string, unknown>);
  if (keys.length === 0) return true; // empty {} === form mode
  return "form" in (e as Record<string, unknown>);
}

/**
 * Request form-mode elicitation from the user.
 *
 * Returns a discriminated union so callers handle every spec action
 * explicitly. `unsupported` is non-spec but allows graceful fallback to
 * the pre-elicitation flow (typically: throw the original error).
 *
 * @template T - shape of the expected `content` on accept; the caller
 *   knows it from the `requestedSchema` they passed in.
 */
export async function requestElicitation<T extends Record<string, unknown>>(
  server: McpServer,
  params: Omit<ElicitRequestFormParams, "mode"> & { mode?: "form" },
  options: { relatedRequestId: RequestId },
): Promise<ElicitOutcome<T>> {
  if (!supportsFormElicitation(server)) return { kind: "unsupported" };

  let result: ElicitResult;
  try {
    result = await server.server.elicitInput({ mode: "form", ...params }, options);
  } catch {
    // Transport error or client rejected the elicitation request entirely.
    // Treat as unsupported so callers fall back to the non-interactive path.
    return { kind: "unsupported" };
  }

  switch (result.action) {
    case "accept":
      return { kind: "accept", content: (result.content ?? {}) as T };
    case "decline":
      return { kind: "decline" };
    case "cancel":
      return { kind: "cancel" };
  }
}
