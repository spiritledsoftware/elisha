# Task Domain

Task tools for multi-agent orchestration and context injection after session compaction.

## Directory Structure

```
task/
├── index.ts          # setupTaskTools() + setupTaskHooks() exports
├── tools.ts          # Task tool definitions
├── hooks.ts          # Task context injection hook
└── prompt.md         # Task context prompt template
```

## Key Exports

### setupTaskTools

Returns the task tools object for the plugin:

```typescript
import { setupTaskTools } from './task/index.ts';

const tools = setupTaskTools(input);
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

### Helper Functions

```typescript
import { getActiveAgents } from './task/tools.ts';

// Returns list of agents available for task delegation
const agents = getActiveAgents(config);
```

## Task Tools

| Tool | Purpose |
|------|---------|
| `elisha_task` | Create a new task for an agent |
| `elisha_task_output` | Get output from a running/completed task |
| `elisha_task_cancel` | Cancel a running task |

## Adding Task Functionality

### Modifying Tools

Edit `tools.ts` to modify tool behavior. Each tool follows this pattern:

```typescript
export const myTool: Tool = {
  name: 'elisha_my_tool',
  description: 'What this tool does',
  parameters: z.object({
    // Zod schema for parameters
  }),
  execute: async (args, context) => {
    // Implementation
  },
};
```

### Modifying Hooks

Edit `hooks.ts` to change when/how task context is injected. The hook listens for `session.compacted` events.

## Critical Rules

### Include `.ts` Extensions

```typescript
// Correct
import { setupTaskTools } from '../task/index.ts';

// Wrong - will fail at runtime
import { setupTaskTools } from '../task';
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

### Check for Active Tasks

Before injecting task context, verify there are active tasks to report on.
