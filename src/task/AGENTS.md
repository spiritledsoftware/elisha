# Task Domain

Task tools for multi-agent orchestration and context injection after session compaction.

## Directory Structure

```
task/
├── index.ts          # Barrel export (setupTaskTools, setupTaskHooks, TOOL_TASK_ID)
├── tool.ts           # Task tool definitions (elisha_task, _output, _cancel)
├── hook.ts           # Task context injection hook
├── util.ts           # Task utilities (fetchTaskText, isTaskComplete, waitForTask)
└── types.ts          # TaskResult type
```

## Key Exports

### setupTaskTools

Returns the task tools object for the plugin:

```typescript
import { setupTaskTools } from './task/index.ts';

const tools = await setupTaskTools(ctx);
// Returns: { elisha_task, elisha_task_output, elisha_task_cancel }
```

### setupTaskHooks

Returns hooks for task context injection:

```typescript
import { setupTaskHooks } from './task/index.ts';

const hooks = setupTaskHooks(input);
```

The task hook injects `<task-context>` guidance after session compaction to remind agents about active tasks.

### Tool Constants

```typescript
import { TOOL_TASK_ID } from './task/index.ts';
// TOOL_TASK_ID = 'elisha_task'
```

## Task Tools

| Tool                   | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `elisha_task`          | Create a new task for an agent             |
| `elisha_task_output`   | Get output from a running/completed task   |
| `elisha_task_cancel`   | Cancel a running task                      |

### Task Tool Parameters

```typescript
// elisha_task
{
  title: string,      // Short description of the task
  agent: string,      // Agent name to use (e.g., 'Baruch (executor)')
  prompt: string,     // The prompt to give to the agent
  async: boolean,     // Run in background (default: false)
}

// elisha_task_output
{
  task_id: string,    // The session ID of the task
  wait: boolean,      // Wait for completion (default: false)
  timeout?: number,   // Max wait time in ms (only if wait=true)
}

// elisha_task_cancel
{
  task_id: string,    // The session ID to cancel
}
```

### TaskResult Type

```typescript
type TaskResult = {
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  task_id?: string;
  agent?: string;
  title?: string;
  result?: string;
  error?: string;
  code?: 'AGENT_NOT_FOUND' | 'SESSION_ERROR' | 'TIMEOUT';
};
```

## Adding Task Functionality

### Modifying Tools

Edit `tool.ts` to modify tool behavior. Each tool follows this pattern:

```typescript
import { tool } from '@opencode-ai/plugin';

const z = tool.schema;

export const myTool = tool({
  description: 'What this tool does',
  args: {
    param1: z.string().describe('Description'),
    param2: z.boolean().default(false).describe('Optional param'),
  },
  execute: async (args, context) => {
    // Implementation
    return JSON.stringify({ status: 'completed', ... });
  },
});
```

### Modifying Hooks

Edit `hook.ts` to change when/how task context is injected. The hook listens for `session.compacted` events.

## Task Utilities

```typescript
import { fetchTaskText, isTaskComplete, waitForTask } from './task/util.ts';

// Get the text result from a completed task
const text = await fetchTaskText(sessionId, ctx);

// Check if a task has completed
const done = await isTaskComplete(sessionId, ctx);

// Wait for a task to complete with optional timeout
const completed = await waitForTask(sessionId, timeout, ctx);
```

## Critical Rules

### Include `.ts` Extensions

```typescript
// Correct
import { setupTaskTools } from './task/index.ts';

// Wrong - will fail at runtime
import { setupTaskTools } from './task';
```

### Mark Synthetic Messages

When injecting messages in hooks:

```typescript
return {
  role: 'user',
  content: injectedContent,
  synthetic: true, // Required
};
```

### Return JSON Strings from Tools

Tools should return `JSON.stringify(result)` with a `TaskResult` type:

```typescript
return JSON.stringify({
  status: 'completed',
  task_id: session.id,
  agent: args.agent,
  title: args.title,
  result: outputText,
} satisfies TaskResult);
```

### Validate Agent Exists

Before creating a task, verify the agent is active:

```typescript
const activeAgents = await getActiveAgents(ctx);
if (!activeAgents?.find((agent) => agent.name === args.agent)) {
  return JSON.stringify({
    status: 'failed',
    error: `Agent(${args.agent}) not found or not active.`,
    code: 'AGENT_NOT_FOUND',
  } satisfies TaskResult);
}
```
