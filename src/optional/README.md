# Optional Modules

This directory contains optional MCP features that are NOT used in typical MCP Apps servers.
These modules are provided as references for advanced use cases.

## Current Contents

| Directory | Purpose | Use When |
|-----------|---------|----------|
| `prompts/` | MCP Prompt templates | You need predefined prompts for common workflows |
| `resources/` | Additional MCP Resources | You need non-UI resources (templates, data) |
| `completions/` | Dynamic enum completions | You need autocomplete for tool arguments |
| `elicitation/` | User input collection | You need to ask users for additional information |
| `tasks/` | Async task execution | You have long-running background operations |
| `ui/` | Component generation | You dynamically generate UI components |

## Recommendation

For most MCP Apps servers, you should:

1. **DELETE** directories you do not need
2. **KEEP** only the modules relevant to your use case
3. Each module adds complexity - prefer simpler solutions

## Usage

To use an optional module:

1. Review the module files and understand the pattern
2. Import the relevant functions/types into your server.ts
3. Register the handlers in your McpAgent.init() method

## Production Servers Reference

Looking at the production servers (opensky, nbp-exchange, sustainability-auditor):

- **None** use completions, elicitation, or tasks
- **All** use prompts (but defined inline, not as separate modules)
- **All** use resources (UI resources for SEP-1865)

This suggests most modules here are over-engineering for typical MCP Apps use cases.