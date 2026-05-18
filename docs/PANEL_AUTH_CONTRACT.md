# Panel Authentication Contract

This document defines the relationship between MCP servers and `panel.wtyczki.ai` for centralized authentication.

## Architecture

```
Client (Claude Desktop, ChatGPT)
    │
    ├── discovers /.well-known/oauth-protected-resource
    │   └── learns AuthKit is the authorization server
    │
    ├── authenticates with AuthKit (Standalone Connect + Magic Auth)
    │   └── receives JWT access token
    │
    └── sends JWT to MCP server (POST /mcp, Authorization: Bearer <jwt>)
        └── MCP server verifies JWT via AuthKit JWKS
```

## How It Works

### 1. Discovery (RFC 9728 + RFC 8414)

MCP clients discover the authorization server via well-known endpoints:

- `GET /.well-known/oauth-protected-resource` - Points to AuthKit as the authorization server
- `GET /.well-known/oauth-authorization-server` - Returns AuthKit's OAuth endpoints

### 2. Authentication

AuthKit handles all OAuth 2.1 flows:
- Authorization endpoint (`/oauth2/authorize`)
- Token endpoint (`/oauth2/token`)
- Dynamic Client Registration (`/oauth2/register`)
- PKCE (S256 code challenge)

Panel provides Standalone Connect + Magic Auth via WorkOS AuthKit.

### 3. JWT Verification

MCP servers verify JWTs using:
- **JWKS endpoint**: `https://{AUTHKIT_DOMAIN}/oauth2/jwks`
- **Issuer validation**: `https://{AUTHKIT_DOMAIN}`
- **User lookup**: JWT `sub` claim -> D1 `users.workos_user_id`

## Shared Resources

| Resource | Binding | Purpose |
|----------|---------|---------|
| D1 Database | `DB` (mcp-oauth) | User lookup by `workos_user_id` |
| AuthKit Domain | `AUTHKIT_DOMAIN` (var) | JWT verification and well-known endpoints |

## Key Differences from Old Architecture

| Aspect | Old (McpAgent + OAuthProvider) | New (JWT + AuthKit) |
|--------|-------------------------------|---------------------|
| OAuth handling | Each server ran OAuthProvider | AuthKit handles everything |
| Session storage | KV (USER_SESSIONS, OAUTH_KV) | Stateless (JWT) |
| Server runtime | Durable Objects (McpAgent) | Plain Worker (fetch handler) |
| Secrets needed | WORKOS_CLIENT_ID, WORKOS_API_KEY | None (AUTHKIT_DOMAIN is a var) |
| Dependencies | agents, hono, @workos-inc/node | jose only |

## Testing Checklist

- [ ] Well-known endpoints return correct AuthKit URLs
- [ ] JWT authentication works (test in AI Playground)
- [ ] Invalid JWT returns 401 with WWW-Authenticate header
- [ ] User not in D1 returns 401
