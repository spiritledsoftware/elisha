# Permission Domain

Management of tool and agent permissions, designed to mitigate prompt injection and unauthorized access.

## Overview

The permission system in Elisha provides a layered approach to security. It ensures that agents only have access to the tools they need and that dangerous operations require explicit user approval.

## Permission Layering

Permissions are applied in the following order of precedence:

1. **Global Defaults**: Baseline permissions defined in `src/permission/defaults.ts`.
2. **Agent Overrides**: Specific permissions set for an agent in its configuration (e.g., `src/agent/executor/index.ts`).
3. **Tool Overrides**: Explicit permissions for individual tools.

When a tool is executed, the system checks the most specific permission available. If no specific permission is found, it falls back to the next layer.

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

For agents that only need to search and read code (e.g., `explorer`):

```typescript
permission: setupAgentPermissions(
  AGENT_ID,
  {
    edit: 'deny',
    bash: 'deny',
    webfetch: 'allow',
  },
  ctx,
),
```

### Full Implementation Agent

For agents that implement code (e.g., `executor`):

```typescript
permission: setupAgentPermissions(
  AGENT_ID,
  {
    edit: 'ask', // User must approve file changes
    bash: 'ask', // User must approve command execution
  },
  ctx,
),
```

## Debugging Permission Issues

If an agent is unexpectedly denied access to a tool:

1. Check the agent's configuration in `src/agent/[agent-name]/index.ts`.
2. Verify the tool name matches the permission key (e.g., `edit`, `bash`, `chrome-devtools*`).
3. Check `src/permission/agent.ts` to see how overrides are merged.
4. Look for "Permission denied" warnings in the console.
