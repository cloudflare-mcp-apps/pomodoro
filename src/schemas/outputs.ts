/**
 * Output Schemas for Pomodoro Focus MCP Tools
 *
 * Zod validation schemas for tool output responses.
 * These are RAW shapes (not wrapped in z.object) for SDK compatibility.
 *
 * @module schemas/outputs
 */

import * as z from "zod/v4";

/**
 * Output schema for example_tool
 *
 * TODO: Replace with your tool's output structure
 */
export const ExampleToolOutputSchema = z.object({
  message: z.string().meta({
    description: "Result message"
  }),
  data: z.any().meta({
    description: "Result data payload"
  }),
  widget_uri: z.string().optional().meta({
    description: "UI resource URI for widget rendering (if applicable)"
  })
});

/**
 * Type inference from schema
 */
export type ExampleToolOutput = z.infer<typeof ExampleToolOutputSchema>;

// TODO: Add more output schemas for your tools
// export const MyToolOutputSchema = z.object({...});
// export type MyToolOutput = z.infer<typeof MyToolOutputSchema>;
