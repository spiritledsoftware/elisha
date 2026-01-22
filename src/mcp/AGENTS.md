# MCP Domain

MCP (Model Context Protocol) server configurations and memory context injection.

## Directory Structure

```
mcp/
├── index.ts              # Barrel export + MCP ID constants
├── config.ts             # setupMcpConfig() - registers all servers
├── hook.ts               # setupMcpHooks() - memory context injection
├── util.ts               # MCP utilities (isMcpEnabled, getEnabledMcps)
├── types.ts              # MCP-related types
├── chrome-devtools.ts    # Chrome DevTools MCP server
├── context7.ts           # Context7 library docs server
├── exa.ts                # Exa web search server
├── grep-app.ts           # Grep.app GitHub code search
└── openmemory/           # OpenMemory (has subdirectory for config + hook)
    ├── index.ts          # Config and MCP ID export
    └── hook.ts           # Memory-specific hooks
```

## Key Exports

### setupMcpConfig

Configures all MCP servers:

```typescript
import { setupMcpConfig } from './mcp/index.ts';

setupMcpConfig(ctx);
```

### setupMcpHooks

Returns hooks for memory context injection:

```typescript
import { setupMcpHooks } from './mcp/index.ts';

const hooks = setupMcpHooks(input);
```

The memory hook injects `<memory-context>` guidance into the first message and after session compaction.

### MCP Server IDs

Each server exports its ID constant from the barrel:

```typescript
import {
  MCP_OPENMEMORY_ID,
  MCP_EXA_ID,
  MCP_CONTEXT7_ID,
  MCP_GREP_APP_ID,
  MCP_CHROME_DEVTOOLS_ID,
} from './mcp/index.ts';
```

## Adding a New MCP Server

### For Simple Servers (Flat File)

Create a flat file in `mcp/`:

```typescript
// mcp/my-server.ts
import type { McpServer } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import type { ElishaConfigContext } from '../types.ts';

export const MCP_MY_SERVER_ID = 'my-server';

const getDefaultConfig = (): McpServer => ({
  command: 'npx',
  args: ['-y', 'my-server-package'],
  env: {
    MY_API_KEY: process.env.MY_API_KEY ?? '',
  },
});

export const setupMyServerMcpConfig = (ctx: ElishaConfigContext) => {
  ctx.config.mcp ??= {};
  ctx.config.mcp[MCP_MY_SERVER_ID] = defu(
    ctx.config.mcp?.[MCP_MY_SERVER_ID] ?? {},
    getDefaultConfig(),
  );
};
```

### For Complex Servers (Subdirectory)

If the server needs hooks or multiple files, use a subdirectory:

```
mcp/
└── my-server/
    ├── index.ts    # Config and ID export
    └── hook.ts     # Server-specific hooks
```

### Register in `config.ts`

```typescript
import { setupMyServerMcpConfig } from './my-server.ts';

export const setupMcpConfig = (ctx: ElishaConfigContext) => {
  // ... existing servers
  setupMyServerMcpConfig(ctx);
};
```

### Export ID from `index.ts`

```typescript
export { MCP_MY_SERVER_ID } from './my-server.ts';
```

## Memory Hook

The memory hook (`hook.ts`) injects guidance for using OpenMemory:

- **Query**: When to search memories (session start, user references past work)
- **Store**: When to persist memories (user preferences, project context)
- **Reinforce**: When to boost memory salience

The hook only activates if OpenMemory is enabled in the config.

## MCP Utilities

```typescript
import { isMcpEnabled, getEnabledMcps } from './mcp/util.ts';

// Check if a specific MCP is enabled
const hasMemory = isMcpEnabled(MCP_OPENMEMORY_ID, ctx);

// Get all enabled MCPs
const enabledMcps = getEnabledMcps(ctx);
```

## Critical Rules

### Use Flat Files for Simple Servers

```
# Correct - simple server
mcp/exa.ts

# Only use subdirectory when needed (hooks, multiple files)
mcp/openmemory/
├── index.ts
└── hook.ts
```

### Export Server ID Constants

Always export the server ID for use in permission setup:

```typescript
export const MCP_MY_SERVER_ID = 'my-server';
```

### Check Server Enabled Status

Before using server-specific features in hooks:

```typescript
const isEnabled = ctx.config.mcp?.[MCP_OPENMEMORY_ID]?.enabled !== false;
if (!isEnabled) return;
```

### Include `.ts` Extensions

```typescript
// Correct
import { MCP_OPENMEMORY_ID } from './mcp/index.ts';

// Wrong - will fail at runtime
import { MCP_OPENMEMORY_ID } from './mcp';
```

### Use `defu` for Config Merging

```typescript
ctx.config.mcp[MCP_MY_SERVER_ID] = defu(
  ctx.config.mcp?.[MCP_MY_SERVER_ID] ?? {},
  getDefaultConfig(),
);
```
