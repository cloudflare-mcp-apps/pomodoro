/**
 * Tool Registry
 *
 * Central export point for all Pomodoro Focus MCP tools.
 * Provides clean imports for server.ts
 *
 * @module tools
 */

// Tool metadata
export { TOOL_METADATA, getToolDescription, getToolExamples } from './descriptions';
export type { ToolMetadata, ToolName } from './descriptions';

// TODO: Add your tool executor exports here
// Example:
// export { executeYourTool } from './your-tool';
