# {{SERVER_NAME}} MCP Server Documentation

## Overview

{{SERVER_NAME}} is an MCP (Model Context Protocol) server providing:
- TODO: List main capabilities

## Tools

### example_tool

**Description:** TODO: Add tool description

**Input Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| query | string | Yes | The search query |
| format | "concise" \| "detailed" | No | Response format (default: concise) |

**Output:**
```json
{
  "message": "Result message",
  "data": { ... },
  "widget_uri": "ui://{{SERVER_ID}}/widget"
}
```

**Example:**
```json
{
  "name": "example_tool",
  "arguments": {
    "query": "test query",
    "format": "detailed"
  }
}
```

## Widget

The server provides an interactive widget via SEP-1865 MCP Apps protocol.

**Features:**
- Dark mode support
- Auto-refresh capability
- TODO: List widget features

**Usage:**
The widget is automatically loaded when the tool returns with `widget_uri`.

## Authentication

### OAuth 2.1 (Recommended)
For OAuth-capable MCP clients.

1. Client redirects to `/authorize`
2. User authenticates via panel.wtyczki.ai
3. Callback completes OAuth flow
4. Tools become available

## Error Handling

| Error Code | Description | Resolution |
|------------|-------------|------------|
| 401 | Missing or invalid JWT | Re-authenticate at panel.wtyczki.ai |
| 403 | User not registered | Register at panel.wtyczki.ai |
| 500 | Internal server error | Check Cloudflare Workers logs |

## Rate Limits

- TODO: Document rate limits if applicable
- AI Gateway: 60 requests/hour per user (if using AI)

## V0.4.1 Features (Optional)

This server supports ext-apps SDK v1.0.0+ features (stable release) for enhanced widget capabilities.

### Model Context Updates with YAML Frontmatter

Widgets can update the AI model's context with structured YAML:

```typescript
await app.updateModelContext({
  content: [{
    type: "text",
    text: `---
tool: my_tool
page: ${currentPage}
---
Currently viewing page ${currentPage}.`
  }]
});
```

### Fullscreen Mode

Request fullscreen when supported by the host:

```typescript
// Check capability first
if (app.hostContext?.availableDisplayModes?.includes("fullscreen")) {
  await app.requestDisplayMode({ mode: "fullscreen" });
}
```

### Widget State Persistence

Use `widgetUUID` for reliable state persistence across sessions:

```typescript
// In ontoolresult handler
const uuid = result._meta?.widgetUUID;
if (uuid) {
  localStorage.setItem(`widget-${uuid}`, JSON.stringify(state));
}

// To restore state later
const savedState = localStorage.getItem(`widget-${uuid}`);
if (savedState) restoreState(JSON.parse(savedState));
```

## Support

- Issues: https://github.com/your-org/{{SERVER_ID}}-mcp/issues
- Documentation: https://docs.wtyczki.ai/{{SERVER_ID}}
