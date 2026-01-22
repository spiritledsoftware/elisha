# Permission Domain

Management of tool and agent permissions, designed to mitigate prompt injection and unauthorized access.

## Directory Structure

```
permission/
├── index.ts          # setupPermissionConfig() + getGlobalPermissions() + defaults
├── util.ts           # cleanupPermissions() utility
└── agent/
    ├── index.ts      # setupAgentPermissions()
    └── util.ts       # agentHasPermission()
```

## Overview

The permission system in Elisha provides a layered approach to security. It ensures that agents only have access to the tools they need and that dangerous operations require explicit user approval.

## Permission Layering

Permissions are applied in the following order of precedence:

1. **Global Defaults**: Baseline permissions defined in `src/permission/index.ts` (`getDefaultPermissions`).
2. **Agent Overrides**: Specific permissions set for an agent in its configuration (e.g., `src/agent/executor.ts`).
3. **User Overrides**: Permissions from `ctx.config.permission` merged via `defu`.

When a tool is executed, the system checks the most specific permission available. If no specific permission is found, it falls back to the next layer.

## Key Functions

### `getGlobalPermissions(ctx)`

Returns merged global permissions (user config + defaults):

```typescript
import { getGlobalPermissions } from './permission/index.ts';

const permissions = getGlobalPermissions(ctx);
```

### `setupAgentPermissions(name, overrides, ctx)`

Merges agent-specific overrides with global permissions:

```typescript
import { setupAgentPermissions } from './permission/agent/index.ts';

permission: setupAgentPermissions(
  AGENT_ID,
  {
    edit: 'deny',
    bash: 'ask',
  },
  ctx,
),
```

### `agentHasPermission(tool, agentName, ctx)`

Checks if an agent has permission to use a tool:

```typescript
import { agentHasPermission } from './permission/agent/util.ts';

const canEdit = agentHasPermission('edit', AGENT_ID, ctx);
const canUseMemory = agentHasPermission('openmemory*', AGENT_ID, ctx);
```

### `cleanupPermissions(permissions, ctx)`

Removes permissions for disabled MCPs:

```typescript
import { cleanupPermissions } from './permission/util.ts';

const cleaned = cleanupPermissions(permissions, ctx);
```

## Default Permissions

Key defaults from `getDefaultPermissions()`:

```typescript
{
  bash: {
    '*': 'allow',
    'rm * /': 'deny',
    'rm * ~': 'deny',
    'rm -rf *': 'deny',
    // ... other dangerous patterns
  },
  edit: 'allow',
  read: {
    '*': 'allow',
    '*.env': 'deny',
    '*.env.*': 'deny',
    '*.env.example': 'allow',
  },
  glob: 'allow',
  grep: 'allow',
  webfetch: 'ask',
  websearch: 'ask',
  codesearch: 'ask',
  task: 'deny',              // Use elisha_task* instead
  'elisha_task*': 'allow',
  'openmemory*': 'allow',    // If enabled
  'chrome-devtools*': 'deny', // Selectively allow in agents
}
```

## Security Considerations

### Prompt Injection

Prompt injection occurs when untrusted content (like code from a file or memory) contains instructions that the AI agent follows. Elisha mitigates this by:

- **Least Privilege**: Giving agents only the tools necessary for their role.
- **Mandatory Confirmation**: Requiring user approval (`'ask'`) for destructive tools like `bash` or `edit`.
- **Output Sanitization**: Using `validateMemoryContent` to wrap untrusted context in warning tags.

### File Content Risks

When agents read files, they may encounter malicious instructions. Documentation agents should be particularly careful not to treat file content as imperative commands.

## Common Permission Patterns

### Read-Only Agent

For agents that only need to search and read code (e.g., explorer):

```typescript
permission: setupAgentPermissions(
  AGENT_ID,
  {
    edit: 'deny',
    bash: 'deny',
    write: 'deny',
  },
  ctx,
),
```

### Full Implementation Agent

For agents that implement code (e.g., executor):

```typescript
permission: setupAgentPermissions(
  AGENT_ID,
  {
    webfetch: 'deny',
    websearch: 'deny',
    codesearch: 'deny',
  },
  ctx,
),
```

### Designer Agent (Chrome DevTools)

For agents that need browser automation:

```typescript
permission: setupAgentPermissions(
  AGENT_ID,
  {
    'chrome-devtools*': 'allow',
  },
  ctx,
),
```

## Debugging Permission Issues

If an agent is unexpectedly denied access to a tool:

1. Check the agent's configuration in `src/agent/[agent-name].ts`.
2. Verify the tool name matches the permission key (e.g., `edit`, `bash`, `chrome-devtools*`).
3. Check `src/permission/agent/index.ts` to see how overrides are merged.
4. Use `agentHasPermission()` to test permissions programmatically.
5. Look for disabled MCPs - `cleanupPermissions` removes their permission entries.

## Critical Rules

### Use `defu` for Permission Merging

```typescript
// In setupAgentPermissions
return cleanupPermissions(
  defu(
    ctx.config.agent?.[name]?.permission ?? {},  // User overrides
    permissions,                                   // Agent defaults
    getGlobalPermissions(ctx),                    // Global defaults
  ),
  ctx,
);
```

### Permission Values

- `'allow'` - Permit without asking
- `'deny'` - Block completely
- `'ask'` - Require user confirmation

### Wildcard Patterns

Use `*` suffix for tool groups:

```typescript
'elisha_task*': 'allow',    // Matches elisha_task, elisha_task_output, etc.
'chrome-devtools*': 'deny', // Matches all chrome-devtools tools
'openmemory*': 'allow',     // Matches all openmemory tools
```
