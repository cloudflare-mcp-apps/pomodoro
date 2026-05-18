/**
 * Cloudflare Workers Environment Bindings
 *
 * This interface defines all the bindings available to your MCP server.
 * Authentication is handled via JWT verification (WorkOS AuthKit JWKS),
 * with user lookup in shared D1.
 *
 * TODO: Replace pomodoro placeholders and add your custom bindings
 */
export interface Env {
  // ========================================================================
  // REQUIRED: Core Bindings
  // ========================================================================

  /**
   * Cloudflare Assets Binding for MCP Apps
   *
   * Used to serve built HTML widgets from web/dist/widgets directory.
   * Required for SEP-1865 MCP Apps protocol support.
   *
   * @see https://developers.cloudflare.com/workers/static-assets/binding/
   */
  ASSETS: Fetcher;

  /**
   * D1 Database - Shared mcp-oauth database
   *
   * Contains: users table.
   * Same database as panel.wtyczki.ai for centralized auth.
   * Used for user lookup by workos_user_id after JWT verification.
   */
  DB: D1Database;

  /**
   * WorkOS AuthKit domain for JWT verification and well-known endpoints.
   * Example: "exciting-domain-65.authkit.app"
   */
  AUTHKIT_DOMAIN: string;

  // ========================================================================
  // OPTIONAL: Common Cloudflare Bindings
  // ========================================================================
  // Uncomment and configure these as needed for your server

  /**
   * Workers AI for LLM inference
   * Uncomment in wrangler.jsonc: "ai": { "binding": "AI" }
   */
  // AI?: Ai;

  /**
   * R2 storage bucket for file storage
   * Uncomment in wrangler.jsonc: "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "..." }]
   */
  // BUCKET?: R2Bucket;

  /**
   * Cache KV for API response caching
   */
  // CACHE_KV?: KVNamespace;

  /**
   * Browser Rendering for headless browser operations
   * Uncomment in wrangler.jsonc: "browser": { "binding": "BROWSER" }
   */
  // BROWSER?: BrowserWorker;

  /**
   * AI Gateway configuration for rate limiting and logging AI calls
   */
  AI_GATEWAY_ID?: string;

  // ========================================================================
  // TODO: Add Your Custom Bindings
  // ========================================================================
  // Examples:
  // EXTERNAL_API_KEY?: string;        // Third-party API credentials
  // CUSTOM_KV?: KVNamespace;          // Additional KV namespace
  // ADDITIONAL_DB?: D1Database;       // Additional D1 database
}

// ========================================================================
// Response Format Types
// ========================================================================

/**
 * Response format options for tools that return large datasets
 *
 * Use this enum when you want to offer users a choice between
 * concise and detailed output formats.
 */
export enum ResponseFormat {
  /**
   * Concise format: Essential data only, ~1/3 tokens
   * Best for: Quick summaries, cost-sensitive use cases
   */
  CONCISE = "concise",

  /**
   * Detailed format: Full data including IDs for programmatic use
   * Best for: Data export, debugging, integration with other tools
   */
  DETAILED = "detailed"
}

// ========================================================================
// State Types (Optional)
// ========================================================================
// If your server needs to maintain state between tool calls, define
// your State interface here.
//
// Example:
// export interface State {
//   lastQuery?: string;
//   cachedResults?: Record<string, unknown>;
//   userPreferences?: Record<string, unknown>;
// }
