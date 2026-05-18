/**
 * Asset Loading Utilities for MCP Apps
 *
 * Provides helper functions to load built widget HTML from
 * Cloudflare Assets binding. Widgets are pre-built by Vite
 * as single-file HTML bundles during deployment.
 *
 * @see https://developers.cloudflare.com/workers/static-assets/binding/
 */

/**
 * Type alias for the Cloudflare Assets binding (Fetcher interface)
 */
export type AssetsBinding = Fetcher;

/**
 * Load HTML content from Cloudflare Assets binding
 *
 * @param assets - The ASSETS binding from Cloudflare Workers environment
 * @param htmlPath - Path to the HTML file relative to web/dist/widgets
 *                   (e.g., "/widget.html")
 * @returns The HTML content as a string
 * @throws Error if assets binding is not available or file not found
 *
 * @example
 * ```typescript
 * // Widget built from web/widgets/widget.html outputs to:
 * // web/dist/widgets/widget.html
 * // wrangler.jsonc assets.directory = "./web/dist/widgets"
 * const html = await loadHtml(env.ASSETS, "/widget.html");
 * ```
 */
export async function loadHtml(
  assets: AssetsBinding | undefined,
  htmlPath: string
): Promise<string> {
  if (!assets) {
    throw new Error(
      "ASSETS binding not available. Ensure wrangler.jsonc has assets.binding configured."
    );
  }

  // Cloudflare Assets fetcher expects an absolute URL
  // Use a placeholder origin since only the path matters
  const buildRequest = (path: string) =>
    new Request(new URL(path, "https://assets.invalid").toString());

  const htmlResponse = await assets.fetch(buildRequest(htmlPath));

  if (!htmlResponse.ok) {
    throw new Error(
      `Failed to fetch HTML from assets: ${htmlPath} (status: ${htmlResponse.status})`
    );
  }

  return await htmlResponse.text();
}

/**
 * Widget configuration for MCP Apps registration
 */
export interface WidgetConfig {
  /** Widget name for resource registration */
  name: string;
  /** UI resource URI (must start with "ui://") */
  resourceUri: string;
  /** Path to built HTML in assets (e.g., "/widget.html") */
  htmlPath: string;
  /** Widget description for documentation */
  description?: string;
  /** CSP: Origins allowed for fetch/XHR/WebSocket connections */
  connectDomains?: string[];
  /** CSP: Origins allowed for images, scripts, fonts */
  resourceDomains?: string[];
  /** Custom sandbox domain (optional) */
  domain?: string;
  /** Request visible border from host */
  prefersBorder?: boolean;
}

/**
 * Create UI metadata for MCP resource response
 *
 * @param config - Widget configuration
 * @returns _meta object for MCP resource response
 */
export function createUiMeta(config: WidgetConfig) {
  return {
    ui: {
      csp: {
        connectDomains: config.connectDomains ?? [],
        resourceDomains: config.resourceDomains ?? [],
      },
      domain: config.domain,
      prefersBorder: config.prefersBorder ?? true,
    },
  };
}