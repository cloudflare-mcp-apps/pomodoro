/**
 * MCP App UI Resource Definitions (SEP-1865)
 *
 * Defines UI resources that can be linked to MCP tools via the
 * nested `_meta.ui.resourceUri` field (v0.4.0+ spec), enabling rich
 * interactive widgets to be displayed in MCP-capable chat clients.
 *
 * Pattern: Two-Part Registration (native SDK)
 * 1. Register Resource (UI Template) via `server.registerResource(...)`
 * 2. Register Tool with _meta linkage: `_meta: { ui: { resourceUri: resource.uri } }`
 *
 * Cloudflare divergence note: we use native SDK `server.registerResource` /
 * `server.registerTool`, not ext-apps helpers `registerAppResource` /
 * `registerAppTool`. See `.claude/rules/OVERRIDES-ext-apps.md`.
 *
 * Cross-platform note: this skeleton targets BOTH Claude and ChatGPT.
 * - resourceDomains carries fonts/assets for BOTH hosts:
 *   `assets.claude.ai` (Claude) + `*.oaistatic.com` / `persistent.oaistatic.com` (ChatGPT).
 * - `_meta.ui.domain` should be the SHA-256-derived Claude sandbox origin at
 *   build time, OR the ChatGPT-registered `<app>.web-sandbox.oaiusercontent.com`
 *   when submitting to ChatGPT directory. See `new_docs/cross_platform_mcp_apps.md`.
 *
 * @see https://github.com/modelcontextprotocol/specification/blob/main/docs/specification/extensions/sep-1865-mcp-apps.md
 */

/**
 * MIME type for MCP App UI resources
 * Uses profile parameter to indicate MCP App compliance
 *
 * Note: This value matches the SEP-1865 specification
 * Import from @modelcontextprotocol/ext-apps if available, or use this constant
 */
export const UI_MIME_TYPE = "text/html;profile=mcp-app" as const;

/**
 * Claude sandbox domain — SHA-256(MCP_PUBLIC_URL)[:32] + ".claudemcpcontent.com".
 *
 * Compute once with:
 *   printf 'https://pomodoro.wtyczki.ai/mcp' | shasum -a 256 | awk '{print substr($1,1,32)}'
 * then paste the 32-char hex below.
 *
 * For ChatGPT directory submission this constant must be replaced by the
 * registered `<app>.web-sandbox.oaiusercontent.com` value (per-build).
 */
export const CLAUDE_SANDBOX_DOMAIN = "9ba9ea0ee91c9914cbf9f9513d8f27a8.claudemcpcontent.com";

/**
 * UI Resource metadata structure per SEP-1865 specification
 *
 * IMPORTANT placement: csp / domain / permissions go on the contents[] entry
 * RETURNED by the resource read callback. Placing them on registerResource()'s
 * config object silently no-ops.
 */
export interface UIResourceMeta {
  ui?: {
    /**
     * Content Security Policy configuration.
     * Sandbox blocks ALL network if csp is omitted — declare every origin
     * the View touches, including localhost during dev.
     *
     * REDIRECT TRAP: CSP validates the FINAL URL after a 302. If foo.com
     * redirects to cdn.foo.com, only cdn.foo.com matters for resourceDomains.
     * Diagnose with `curl -sI <url>` (check Location: header).
     */
    csp?: {
      /** Origins for network requests (fetch/XHR/WebSocket) → `connect-src` */
      connectDomains?: string[];
      /** Origins for images, scripts, stylesheets, fonts → `img-src/script-src/style-src/font-src` */
      resourceDomains?: string[];
      /** Origins for nested iframes → `frame-src` */
      frameDomains?: string[];
      /** Allowed values for `<base href>` → `base-uri` */
      baseUriDomains?: string[];
    };
    /**
     * Dedicated sandbox origin for widget — needed when external API server
     * allowlists Origin header (instead of using `Access-Control-Allow-Origin: *`).
     * Claude format: SHA-256 of MCP server URL → `${hash}.claudemcpcontent.com`.
     */
    domain?: string;
    /**
     * Sensitive browser APIs (optional).
     * Declare only if widget needs: camera, microphone, geolocation, clipboardWrite.
     * Structure: { camera?: {}, microphone?: {}, geolocation?: {}, clipboardWrite?: {} }
     */
    permissions?: {
      camera?: Record<string, never>;
      microphone?: Record<string, never>;
      geolocation?: Record<string, never>;
      clipboardWrite?: Record<string, never>;
    };
    /** Visual boundary preference */
    prefersBorder?: boolean;
  };
}

/**
 * Predeclared UI resource definition
 */
export interface UIResourceDefinition {
  /** Unique URI using ui:// scheme (e.g., "ui://server-name/widget-name") */
  uri: string;
  /** Human-readable name for the resource */
  name: string;
  /** Description of the resource's purpose */
  description: string;
  /** MIME type - must be "text/html;profile=mcp-app" for SEP-1865 */
  mimeType: typeof UI_MIME_TYPE;
  /** Resource metadata including CSP and display preferences */
  _meta: UIResourceMeta;
}

/**
 * UI Resources registry for Pomodoro Focus.
 */
export const UI_RESOURCES = {
  widget: {
    uri: "ui://pomodoro/widget",
    name: "main_widget",
    description:
      "Pomodoro Focus dashboard widget: live countdown timer ring for the active session, " +
      "today's completed-vs-target counter and streak, per-task progress dots, distraction-logging modal, " +
      "and a start form (task input + 15/25/45/50-min duration toggle).",

    /** MIME type indicating this is an MCP App */
    mimeType: UI_MIME_TYPE,

    /** SEP-1865 UI metadata — set on contents[] returned by handler, NOT on registerResource config */
    _meta: {
      ui: {
        csp: {
          // connectDomains: empty — all data flows via MCP protocol (no external fetch from widget).
          // Add origins (e.g. "https://api.example.com") when widget calls external APIs directly.
          connectDomains: [] as string[],
          // resourceDomains: include BOTH hosts' font/asset CDNs for cross-platform support.
          // viteSingleFile inlines all React/CSS/JS into one HTML — only fonts/external <img>
          // need declaration. INCLUDE redirect targets: if `images.example.com/foo.jpg`
          // returns 302 → `cdn.example.com/foo.jpg`, BOTH origins must be listed
          // (CSP validates final URL after redirect).
          resourceDomains: [
            "https://assets.claude.ai",         // Claude host fonts
            "https://persistent.oaistatic.com", // ChatGPT CDN
            "https://*.oaistatic.com",          // ChatGPT fonts
          ] as string[],
          // frameDomains: empty — widget does not nest iframes by default.
          // (Both hosts discourage frameDomains; ChatGPT submission scrutinises it heavily.)
          // baseUriDomains: empty — only needed if widget uses <base href>.
          baseUriDomains: [] as string[],
        },
        /**
         * Stable sandbox origin. Required for ChatGPT directory submission.
         * Recommended for Claude when widget calls an API with Origin-based CORS.
         */
        domain: CLAUDE_SANDBOX_DOMAIN,
        // permissions: optional — omit unless widget needs special browser APIs.
        // If needed: { camera: {}, microphone: {}, geolocation: {}, clipboardWrite: {} }
        /**
         * Visual boundary preference. Set `false` for blended widgets
         * (recommended per cross-platform docs §11 anti-patterns).
         * Set `true` only when the widget genuinely wants a card-style boundary.
         */
        prefersBorder: false,
      },
    },
  },
} as const;

/**
 * Type helper for UI resource URIs
 */
export type UiResourceUri = typeof UI_RESOURCES[keyof typeof UI_RESOURCES]["uri"];

/**
 * Extension identifier for capability negotiation
 * Hosts advertise support via extensions["io.modelcontextprotocol/ui"]
 */
export const UI_EXTENSION_ID = "io.modelcontextprotocol/ui";

/**
 * Check if client capabilities include MCP Apps UI support
 *
 * @param clientCapabilities - Client capabilities from initialize response
 * @returns true if client supports MCP Apps UI
 */
export function hasUISupport(clientCapabilities: unknown): boolean {
  if (!clientCapabilities || typeof clientCapabilities !== "object") {
    return false;
  }

  const caps = clientCapabilities as Record<string, unknown>;
  const extensions = caps.extensions as Record<string, unknown> | undefined;

  if (!extensions) {
    return false;
  }

  const uiExtension = extensions[UI_EXTENSION_ID] as
    | Record<string, unknown>
    | undefined;

  if (!uiExtension) {
    return false;
  }

  const mimeTypes = uiExtension.mimeTypes as string[] | undefined;

  if (!Array.isArray(mimeTypes)) {
    return false;
  }

  return mimeTypes.includes(UI_MIME_TYPE);
}