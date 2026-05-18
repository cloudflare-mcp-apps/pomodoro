/**
 * Structured Logger for MCP Server
 *
 * Provides type-safe structured logging following Cloudflare Workers best practices.
 * Logs are emitted as JSON objects that are automatically indexed by Cloudflare Workers Logs.
 *
 * Benefits:
 * - Queryable fields in Cloudflare dashboard (SQL-like filtering)
 * - Automatic indexing for unlimited cardinality
 * - Performance monitoring and alerting
 * - Correlation via action_id across distributed operations
 *
 * Based on:
 * - Cloudflare Workers Logs best practices: https://developers.cloudflare.com/workers/observability/logs/
 * - MCP LoggingLevel specification (RFC-5424)
 */

/**
 * MCP-compliant log levels (RFC-5424)
 */
export type LogLevel =
  | 'debug'      // Detailed debug information
  | 'info'       // Informational messages
  | 'notice'     // Normal but significant conditions
  | 'warning'    // Warning conditions
  | 'error'      // Error conditions
  | 'critical'   // Critical conditions
  | 'alert'      // Action must be taken immediately
  | 'emergency'; // System is unusable

/**
 * Base metadata included in all log events
 */
interface BaseLogEvent {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Log level */
  level: LogLevel;
  /** Event type for categorization */
  event: string;
}

/**
 * Tool execution events
 */
export type ToolEvent =
  | {
      event: 'tool_started';
      tool: string;
      user_email: string;
      user_id: string;
      action_id: string;
      args: Record<string, unknown>;
    }
  | {
      event: 'tool_completed';
      tool: string;
      user_email: string;
      user_id: string;
      action_id: string;
      duration_ms: number;
    }
  | {
      event: 'tool_failed';
      tool: string;
      user_email?: string;
      user_id?: string;
      action_id?: string;
      error: string;
      error_code?: string;
    };

/**
 * Authentication events
 */
export type AuthEvent =
  | {
      event: 'auth_attempt';
      method: 'oauth';
      user_email?: string;
      user_id?: string;
      success: boolean;
      reason?: string;
    }
  | {
      event: 'session_check';
      session_id: string;
      valid: boolean;
      reason?: string;
    }
  | {
      event: 'user_lookup';
      lookup_by: 'email' | 'id';
      user_email?: string;
      user_id?: string;
      found: boolean;
      is_deleted?: boolean;
    };

/**
 * API call events
 */
export type APIEvent =
  | {
      event: 'api_call';
      service: string;
      method: string;
      url?: string;
      status: number;
      duration_ms: number;
      success: boolean;
      error?: string;
    }
  | {
      event: 'oauth_token_refresh';
      service: string;
      success: boolean;
      expires_in?: number;
      error?: string;
    }
  | {
      event: 'cache_operation';
      operation: 'hit' | 'miss' | 'set' | 'evict';
      key: string;
      ttl_seconds?: number;
    };

/**
 * Transport events
 */
export type TransportEvent =
  | {
      event: 'transport_request';
      transport: 'sse' | 'http';
      method: string;
      user_id?: string;
      user_email: string;
    }
  | {
      event: 'sse_connection';
      status: 'established' | 'closed' | 'error';
      user_email: string;
      error?: string;
    };

/**
 * Security events
 */
export type SecurityEvent =
  | {
      event: 'pii_redacted';
      tool: string;
      pii_types: string[];
      count: number;
    }
  | {
      event: 'origin_blocked';
      origin: string;
      reason: string;
    };

/**
 * System events
 */
export type SystemEvent =
  | {
      event: 'server_started';
      auth_mode: 'oauth';
    }
  | {
      event: 'lru_cache_eviction';
      evicted_user_id: string;
      cache_size: number;
    }
  | {
      event: 'server_error';
      error: string;
      context?: string;
      pathname?: string;
    };

/**
 * SEP-1865 MCP Apps UI events
 */
export type UIEvent =
  | {
      event: 'ui_capability_check';
      host_supports_ui: boolean;
      extension_id: string;
    }
  | {
      event: 'ui_resource_registered';
      uri: string;
      name: string;
    };

/**
 * Union of all possible log events
 */
export type LogEvent =
  | ToolEvent
  | AuthEvent
  | APIEvent
  | TransportEvent
  | SecurityEvent
  | SystemEvent
  | UIEvent;

/**
 * Complete log entry structure
 */
type LogEntry = BaseLogEvent & LogEvent;

/**
 * Structured logger class
 */
class Logger {
  /**
   * Log at debug level (detailed debugging information)
   */
  debug(event: LogEvent): void {
    this.log('debug', event);
  }

  /**
   * Log at info level (informational messages)
   */
  info(event: LogEvent): void {
    this.log('info', event);
  }

  /**
   * Log at notice level (normal but significant conditions)
   */
  notice(event: LogEvent): void {
    this.log('notice', event);
  }

  /**
   * Log at warning level (warning conditions)
   */
  warn(event: LogEvent): void {
    this.log('warning', event);
  }

  /**
   * Log at error level (error conditions)
   */
  error(event: LogEvent): void {
    this.log('error', event);
  }

  /**
   * Log at critical level (critical conditions requiring immediate attention)
   */
  critical(event: LogEvent): void {
    this.log('critical', event);
  }

  /**
   * Internal logging function that adds base metadata
   */
  private log(level: LogLevel, event: LogEvent): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      ...event,
    };

    // Emit as structured JSON to console
    // Cloudflare Workers Logs will automatically index all fields
    // JSON.stringify ensures Cloudflare parses it as a structured object
    console.log(JSON.stringify(entry));
  }
}

/**
 * Performance timing helper for measuring operation duration
 *
 * Usage:
 * ```typescript
 * const timer = startTimer();
 * await someAsyncOperation();
 * const duration_ms = timer();
 *
 * logger.info({
 *   event: 'tool_completed',
 *   tool: 'my_tool',
 *   duration_ms
 * });
 * ```
 */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();

/**
 * Default export for convenient imports
 */
export default logger;