/**
 * Pomodoro Focus — focused-work tracking with per-user sessions, distraction inventory, and LLM-coached daily reflection — Cloudflare canonical pattern (createMcpHandler)
 *
 * Architecture:
 * - JWT pre-handler verifies WorkOS AuthKit tokens via JWKS, then looks up the
 *   user in shared D1 (`mcp-oauth`) by `workos_user_id`.
 * - createMcpHandler from agents/mcp wraps a fresh McpServer per request,
 *   handles Streamable HTTP transport, GHSA-345p-7cg4-v4c7 safe.
 * - Auth context (userId, email) flows to tool handlers via authContext option
 *   → tools call getMcpAuthContext() to retrieve.
 */

import type { Env } from "./types";
import { verifyJwt } from "./auth/jwt-verify";
import { getUserByWorkosId } from "./auth/auth-utils";
import { handleProtectedResource, handleAuthorizationServer, buildWWWAuthenticateHeader } from "./well-known";
import { logger } from "./shared/logger";
import { createMcpHandler } from "agents/mcp";
import { applyFreeQuota } from "./auth/free-quota";
import { createServer } from "./server";
import { recordToolUsage } from "./shared/usage";

// Worker name — must match the X-MCP-Server / FREE_SERVERS registry key in mcp-oauth.
const FREE_SERVER_NAME = "pomodoro";

export { RateLimiterDO } from "./rate-limiter-do";

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    try {
      // -- Well-Known Discovery Endpoints (public, no auth) --
      if (url.pathname === '/.well-known/oauth-protected-resource') {
        return handleProtectedResource(baseUrl, env.AUTHKIT_DOMAIN);
      }

      if (url.pathname === '/.well-known/oauth-authorization-server') {
        return handleAuthorizationServer(env.AUTHKIT_DOMAIN);
      }

      // -- MCP Endpoint — full Streamable HTTP surface (POST/GET/DELETE/OPTIONS) --
      if (url.pathname === '/mcp') {
        // Preflight carries no Authorization header — must bypass auth.
        if (request.method === 'OPTIONS') {
          return createMcpHandler(createServer(env), {})(request, env, ctx);
        }
        if (request.method === 'POST' || request.method === 'GET' || request.method === 'DELETE') {
          return await handleAuthenticatedMcp(request, env, ctx, baseUrl);
        }
      }

      // Everything else -> 404
      return new Response('Not found', { status: 404 });

    } catch (error) {
      logger.error({ event: 'server_error', error: String(error), context: 'fetch handler' });
      return Response.json(
        { error: "Internal server error", message: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
};

/**
 * Authenticate request, then dispatch via createMcpHandler with auth context.
 */
async function handleAuthenticatedMcp(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  baseUrl: string
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1];

  if (!token) {
    return unauthorizedResponse(baseUrl);
  }

  logger.info({ event: 'transport_request', transport: 'http', method: 'oauth', user_email: '' });
  const jwtResult = await verifyJwt(token, env.AUTHKIT_DOMAIN);
  if (!jwtResult) {
    return unauthorizedResponse(baseUrl);
  }

  // Per-user request-tempo gate (all methods) — runs BEFORE the D1 lookup it
  // would otherwise hammer. Keyed by stable WorkOS identity, not IP. Fail-open:
  // a DO hiccup must not 429 legit users (auth is the real boundary).
  let withinRate = true;
  try {
    const limiter = env.RATE_LIMITER_DO.get(env.RATE_LIMITER_DO.idFromName(jwtResult.workosUserId));
    withinRate = await limiter.check();
  } catch (err) {
    console.warn(JSON.stringify({ event: 'rate_limiter_error', error: String(err) }));
  }
  if (!withinRate) {
    console.log(JSON.stringify({ event: 'rate_limited', sub: jwtResult.workosUserId, path: '/mcp' }));
    return new Response(JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Keep your MCP session open instead of reconnecting; retry after 60 seconds.',
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const dbUser = await getUserByWorkosId(env.DB, jwtResult.workosUserId);
  if (!dbUser) {
    return unauthorizedResponse(baseUrl);
  }
  const userId = dbUser.user_id;
  const email = dbUser.email ?? '';

  // Fresh McpServer per request — wrapped by createMcpHandler (canonical)
  // Layer-2 per-user daily quota gate (only tools/call consumes a slot).
  // GET (SSE stream) / DELETE (session teardown) carry no JSON-RPC body — skip
  // the body-reading quota gate (meters tools/call only) and usage logging, and
  // hand the request straight to the transport. Rebuilding a bodyless GET would
  // throw ("Request with GET method cannot have body").
  if (request.method !== 'POST') {
    return createMcpHandler(createServer(env), {
      authContext: { props: { userId, email, token } }
    })(request, env, ctx);
  }

  const { block: quotaBlock, request: gatedRequest } = await applyFreeQuota(request, env, FREE_SERVER_NAME, token);
  if (quotaBlock) return quotaBlock;

  // Fleet usage analytics → shared `mcp_usage` dataset. Best-effort, non-blocking:
  // logs one point per tools/call (server, userId, email, tool). See shared/usage.ts.
  ctx.waitUntil(recordToolUsage(env, gatedRequest, { server: FREE_SERVER_NAME, userId, email }));

  const server = createServer(env);
  return createMcpHandler(server, {
    authContext: { props: { userId, email, token } }
  })(gatedRequest, env, ctx);
}

function unauthorizedResponse(baseUrl: string): Response {
  return Response.json(
    { error: 'Unauthorized' },
    {
      status: 401,
      headers: { 'WWW-Authenticate': buildWWWAuthenticateHeader(baseUrl) },
    }
  );
}
