/**
 * Cloudflare Workers environment bindings for Pomodoro Focus.
 */
export interface Env {
  /** Static assets — serves built HTML widgets from web/dist/widgets (SEP-1865). */
  ASSETS: Fetcher;
  /** Shared mcp-oauth D1 — `users` table + project-local `pomodoro_*` tables. */
  DB: D1Database;
  /** WorkOS AuthKit domain, e.g. "exciting-domain-65.authkit.app". */
  AUTHKIT_DOMAIN: string;
  OAUTH_BASE_URL: string;
}
