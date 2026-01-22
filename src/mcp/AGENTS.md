# MCP Domain

MCP (Model Context Protocol) server configurations and memory context injection.

## Directory Structure

```
mcp/
├── index.ts              # setupMcpConfig() + setupMcpHooks() exports
├── config.ts             # MCP server configuration setup
├── hooks.ts              # Memory context injection hook (includes inline prompt)
├── types.ts              # MCP-related types
├── chrome-devtools/      # Chrome DevTools MCP server
├── context7/             # Context7 library docs server
├── exa/                  # Exa web search server
├── grep-app/             # Grep.app GitHub code search
└── openmemory/           # OpenMemory persistent storage
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

Each server exports its ID constant:

```typescript
import { MCP_OPENMEMORY_ID } from './mcp/openmemory/index.ts';
import { MCP_EXA_ID } from './mcp/exa/index.ts';
import { MCP_CONTEXT7_ID } from './mcp/context7/index.ts';
import { MCP_GREP_APP_ID } from './mcp/grep-app/index.ts';
import { MCP_CHROME_DEVTOOLS_ID } from './mcp/chrome-devtools/index.ts';
```

## Adding a New MCP Server

### 1. Create Server Directory

```
mcp/
└── my-server/
    └── index.ts
```

### 2. Write the Configuration

```typescript
import type { McpServer } from '@opencode-ai/sdk/v2';
import type { ElishaConfigContext } from '../../util/index.ts';

export const MCP_MY_SERVER_ID = 'my-server';

export const getMyServerConfig = (ctx: ElishaConfigContext): McpServer => ({
  command: 'npx',
  args: ['-y', 'my-server-package'],
  env: {
    MY_API_KEY: process.env.MY_API_KEY ?? '',
  },
});
```

### 3. Register in `config.ts`

```typescript
import { getMyServerConfig, MCP_MY_SERVER_ID } from './my-server/index.ts';

// In setupMcpServers():
ctx.config.mcp[MCP_MY_SERVER_ID] = defu(
  ctx.config.mcp?.[MCP_MY_SERVER_ID] ?? {},
  getMyServerConfig(ctx),
);
```

## Memory Hook

The memory hook (`hooks.ts`) injects guidance for using OpenMemory:

- **Query**: When to search memories (session start, user references past work)
- **Store**: When to persist memories (user preferences, project context)
- **Reinforce**: When to boost memory salience

The hook only activates if OpenMemory is enabled in the config.

## Critical Rules

### Export Server ID Constants

Always export the server ID for use in permission setup:

```typescript
export const MCP_MY_SERVER_ID = 'my-server';
```

### Check Server Enabled Status

Before using server-specific features in hooks:

```typescript
const isEnabled = input.config.mcp?.[MCP_OPENMEMORY_ID]?.enabled !== false;
if (!isEnabled) return;
```

### Include `.ts` Extensions

```typescript
// Correct
import { MCP_OPENMEMORY_ID } from '../mcp/openmemory/index.ts';

// Wrong - will fail at runtime
import { MCP_OPENMEMORY_ID } from '../mcp/openmemory';
```
