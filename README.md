# {{SERVER_NAME}} MCP Server

MCP Apps server with SEP-1865 interactive widget support, dual authentication (OAuth + API Key), and Cloudflare Workers deployment.

## Quick Start

### 1. Replace Placeholders

Search and replace these placeholders in all files:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{SERVER_NAME}}` | Human-readable name | "Currency Converter" |
| `{{SERVER_ID}}` | kebab-case identifier | "currency-converter" |
| `{{SERVER_DESCRIPTION}}` | Brief description | "Convert currencies using real-time exchange rates" |
| `{{WIDGET_TITLE}}` | Widget HTML title | "Currency Converter Widget" |
| `{{GITHUB_ORG}}` | GitHub organization | "your-org" |

### 2. Update wrangler.jsonc

1. Replace `{{SERVER_ID}}` with your server ID
2. Update the custom domain pattern

### 3. Install and Build

```bash
npm install
npm run build:widgets
```

### 4. Deploy

Deployment is automatic via Cloudflare Workers Builds when you push to GitHub.

For manual deployment (not recommended):
```bash
npm run deploy
```

## Project Structure

```
src/
  index.ts              # Entry point (auth pre-handler + createMcpHandler dispatch)
  server.ts             # McpServer factory (fresh per request — Cloudflare canonical)
  types.ts              # Environment bindings (ASSETS, DB, AUTHKIT_DOMAIN)
  server-instructions.ts # LLM system prompt instructions
  well-known.ts         # OAuth discovery endpoints (RFC 9728 + RFC 8414)

  auth/
    jwt-verify.ts       # JWT verification via AuthKit JWKS
    auth-utils.ts       # User lookup by workos_user_id

  helpers/
    assets.ts           # loadHtml() for widget loading

  resources/
    ui-resources.ts     # SEP-1865 UI resource definitions

  tools/
    descriptions.ts     # Tool metadata (4-part pattern)

  schemas/
    inputs.ts           # Zod 4 input schemas (ZodRawShapeCompat)
    outputs.ts          # Zod output schemas

  shared/
    logger.ts           # Structured logging
    constants.ts        # Server config

web/
  widgets/
    widget.html         # Widget entry point
    widget.tsx          # React widget component
  components/           # shadcn/ui components
  lib/                  # Utilities (cn, types)
  styles/               # Tailwind CSS
  dist/widgets/         # Built output (gitignored)
```

## Server Architecture (Cloudflare canonical)

This skeleton uses Cloudflare's canonical MCP pattern — `createMcpHandler` from `agents/mcp` wraps a fresh `McpServer` per request:

```
┌─ src/index.ts ──────────────────────────────────────────┐
│  fetch() → JWT pre-handler (WorkOS AuthKit JWKS)        │
│    ↓ extracts { userId, email }                         │
│  createMcpHandler(createServer(env), { authContext })   │
│    ↓ Streamable HTTP transport (March 2025 spec)        │
│  src/server.ts → createServer(env) → McpServer          │
│    ↓ server.registerResource(...)  // widget UI          │
│    ↓ server.registerTool(...)      // tool handler       │
│    ↓                                                     │
│  Tool handler: getMcpAuthContext() → { userId, email }  │
└──────────────────────────────────────────────────────────┘
```

**Why fresh server per request:** prevents GHSA-345p-7cg4-v4c7 (cross-client data leak via shared transport).

**Auth pre-handler is intentional divergence** from cf-mcp canonical (`OAuthProvider` only) — keeps full control over D1 user lookup and structured logging on auth failure. See `.claude/rules/OVERRIDES-cf-mcp.md`.

## Adding New Tools

When adding a tool, update these locations:

### 1. Tool Metadata (`src/tools/descriptions.ts`)
```typescript
"your-tool": {
  title: "Your Tool",
  description: {
    part1_purpose: "What it does...",
    part2_returns: "Returns X, Y, Z...",
    part3_useCase: "Use when...",
    part4_constraints: "Note: limitations..."
  },
  examples: [...]
}
```

### 2. Input Schema (`src/schemas/inputs.ts`)
```typescript
export const YourToolInput = {
  query: z.string().min(1).meta({ description: "..." }),
};
```

### 3. Server Registration (`src/server.ts`)

Add inside `createServer(env)`, alongside the existing `server.registerTool("example-tool", ...)`:

```typescript
server.registerTool(
  "your-tool",
  {
    title: TOOL_METADATA["your-tool"].title,
    description: getToolDescription("your-tool"),
    inputSchema: YourToolInput,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: widgetResource.uri } }
  },
  async (args) => {
    const auth = getMcpAuthContext();
    const userId = (auth?.props?.userId as string | undefined) ?? "anonymous";
    // ... implementation ...
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      _meta: { viewUUID: crypto.randomUUID() }
    };
  }
);
```

Tool handlers retrieve auth via `getMcpAuthContext()` — the `authContext` passed in `src/index.ts` flows through the SDK transport.

## SEP-1865 MCP Apps Pattern

This skeleton uses the Two-Part Registration pattern:

1. **PART 1: Register Resource** - UI HTML template from Assets
2. **PART 2: Register Tool** - Links to resource via `_meta[RESOURCE_URI_META_KEY]`

Data flows:
```
Tool Result -> structuredContent -> postMessage -> Widget State
```

## Authentication

Authentication is **centralized** at `panel.wtyczki.ai`. Individual MCP servers are thin resource servers with zero secrets.

### OAuth 2.1 via WorkOS AuthKit (Primary)
- AuthKit is the authorization server (PKCE, DCR, Standalone Connect)
- MCP clients discover AuthKit via `/.well-known/oauth-protected-resource`
- Server verifies JWTs via AuthKit JWKS endpoint
- No per-server secrets needed — `AUTHKIT_DOMAIN` is a plaintext var
- Example clients: Claude Desktop, ChatGPT

## Widget Development

### Key Concepts

- React 19 with **manual `new App({ autoResize: false })`** instantiation (NOT `useApp` hook — does not expose `autoResize`)
- Tailwind CSS with automatic dark mode (via `onhostcontextchanged` toggling `.dark` class)
- Fixed `h-[600px]` height container (mandatory — `h-screen`/`100vh` causes infinite resize loops)
- viteSingleFile inlines all JS/CSS into single HTML
- All lifecycle handlers registered BEFORE `connect()` — `ontoolinput`, `ontoolresult`, `ontoolcancelled`, `onhostcontextchanged`, `onerror`, `onteardown`

### Mobile Compatibility (Tier 1)

Widgets must work on mobile hosts:
- Min 320px width — no horizontal scroll
- Touch targets ≥ 44pt (use `h-11 min-w-11` on Tailwind buttons)
- Honour `ctx.safeAreaInsets` (notched devices)
- No menus / popovers / context menus (clipped by container) — use visible controls

### CSP & Browser Permissions

Resource registration declares `_meta.ui.csp` on the **`contents[]` returned by the handler** (NOT on the registration config — silently no-ops). Four CSP fields cover all needs:

| Field | Purpose |
|-------|---------|
| `connectDomains` | `fetch` / `XHR` / `WebSocket` origins |
| `resourceDomains` | `<img>` / `<script>` / `<style>` / `<font>` origins (INCLUDE redirect targets — CSP validates final URL after 302) |
| `frameDomains` | nested iframe origins |
| `baseUriDomains` | `<base href>` allowed values |

For sensitive APIs (camera, microphone, geolocation, clipboard) declare `_meta.ui.permissions: ["..."]` — sandbox blocks them by default.

For external API servers that allowlist Origin header, set `_meta.ui.domain` (Claude format: SHA-256 of MCP URL → `*.claudemcpcontent.com`).

### Performance: Pause Offscreen

Widgets with `setInterval` / animations / video / WebGL must pause when scrolled offscreen (battery on mobile). Skeleton ships with an `IntersectionObserver` template in `web/widgets/widget.tsx` — uncomment the polling `useEffect` once you wire it up.

### State Persistence (`viewUUID`)

Server returns `_meta.viewUUID` on every tool result. Widget reads/writes `localStorage` keyed by `view-state-${uuid}` to survive iframe reloads (host crashes, theme toggles, fullscreen transitions). Persist UI-only state (page index, scroll, sort order, draft form values) — never tokens or PII.

### Development

```bash
# Build widget
npm run build:widgets

# Watch mode
npm run dev:widget

# Full dev (server + widget watch)
npm run dev:full
```

### Widget Lifecycle

```typescript
const { app } = useApp({
  onAppCreated: (app) => {
    app.ontoolinput = (params) => { /* tool called */ };
    app.ontoolresult = (result) => { /* display result */ };
    app.onhostcontextchanged = (ctx) => { /* theme change */ };
    app.onteardown = async () => { /* cleanup */ };
  }
});
```

## Configuration Files

| File | Purpose |
|------|---------|
| `wrangler.jsonc` | Cloudflare Workers config (bindings, routes) |
| `vite.config.ts` | Widget build config |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript config (server) |
| `web/tsconfig.json` | TypeScript config (widget) |

## Environment Variables

**No secrets needed for standard MCP servers.** Auth is centralized at panel.wtyczki.ai.

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `AUTHKIT_DOMAIN` | `vars` (plaintext) | Yes | AuthKit domain for JWT verification (e.g., `exciting-domain-65.authkit.app`) |
| `DB` | D1 binding | Yes | Shared `mcp-oauth` database (user lookup by `workos_user_id`) |
| `ASSETS` | Assets binding | Yes | Built widget HTML files |
| `AI_GATEWAY_TOKEN` | Secret | No | AI Gateway token (if using Workers AI) |

## Common Issues

### Widget not loading
1. Check `npm run build:widgets` completed successfully
2. Verify `web/dist/widgets/widget.html` exists
3. Check ASSETS binding in wrangler.jsonc

### Authentication failures
1. Verify `AUTHKIT_DOMAIN` is set in `vars` in wrangler.jsonc
2. Verify D1 binding `DB` points to shared `mcp-oauth` database
3. Ensure custom domain is set up in Cloudflare
4. Check JWT issuer matches AUTHKIT_DOMAIN (test with `curl -I`)

### Tool not appearing
1. Check tool is registered in `src/server.ts` via `server.registerTool(...)`
2. Verify tool name matches exactly in `src/tools/descriptions.ts`
3. Re-deploy and re-test — `tools/list` is generated by SDK from registrations

## Production Checklist

- [ ] All `{{PLACEHOLDER}}` values replaced
- [ ] wrangler.jsonc configured with correct IDs and `AUTHKIT_DOMAIN` var
- [ ] Custom domain configured in Cloudflare
- [ ] GitHub repository connected to Cloudflare Workers Builds
- [ ] Widget builds successfully (`npm run build:widgets`)
- [ ] Type checking passes (`npx tsc --noEmit`)