# Deployment Checklist for {{SERVER_NAME}}

## Pre-Deployment

### 1. Configuration
- [ ] All `{{PLACEHOLDER}}` values replaced in `wrangler.jsonc`, `package.json`, source files
- [ ] `wrangler.jsonc` `name` set to your server's kebab-case name
- [ ] Custom domain configured in `routes`

### 2. Build Verification
- [ ] `npx tsc --noEmit` passes without errors
- [ ] `npm run build:widgets` succeeds
- [ ] Widget HTML generated in `web/dist/widgets/`
- [ ] `npx wrangler deploy --dry-run` succeeds (verify bindings: `DB`, `ASSETS`, `AUTHKIT_DOMAIN` only)

### 3. Tool Registration
- [ ] All tools registered in `src/mcp-handler.ts` (single source of truth)
- [ ] Tool JSON schemas in `TOOL_JSON_SCHEMAS`
- [ ] Tool execution in `validateAndExecuteTool()`
- [ ] Tool metadata in `src/tools/descriptions.ts`

### 4. Widget
- [ ] Fixed 600px height implemented
- [ ] Dark mode support via onhostcontextchanged
- [ ] All event handlers registered before connect()

## Deployment

Push to GitHub. Workers Builds deploys automatically.

```bash
git push origin main
```

**FORBIDDEN:** Do not use `wrangler deploy` locally. Use Workers Builds (GitHub).

## Post-Deployment

### 1. Verification
- [ ] Custom domain accessible
- [ ] OAuth flow works (test in AI Playground)
- [ ] Widget loads correctly

### 2. Post-Migration Cleanup (if migrating from old OAuth)
If migrating an existing server, delete old secrets that are no longer needed:

```bash
wrangler secret delete WORKOS_CLIENT_ID
wrangler secret delete WORKOS_API_KEY
```

### 3. Monitoring
- [ ] Cloudflare Workers logs enabled (`observability.enabled: true`)

## Rollback

If issues occur:
```bash
# List deployments
wrangler deployments list

# Rollback to previous
wrangler rollback
```
