# Agent Configuration Directory

This directory contains the agent swarm definitions. Each agent has its own subdirectory.

## Directory Structure

```
agent/
├── index.ts              # Agent registration and setup
├── util/
│   ├── index.ts          # Permission helpers (canAgentDelegate, formatAgentsList, etc.)
│   └── prompt/
│       └── index.ts      # Prompt.template, Prompt.when utilities
└── [agent-name]/
    └── index.ts          # Agent config + inline prompt
```

## Creating a New Agent

### 1. Create Agent Directory

```
agent/
└── my-agent/
    └── index.ts
```

### 2. Write the Configuration (`index.ts`)

```typescript
import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import type { ElishaConfigContext } from '../../types.ts';
import { setupAgentPermissions } from '../../permission/agent.ts';
import {
  canAgentDelegate,
  formatAgentsList,
  isMcpAvailableForAgent,
} from '../util/index.ts';
import { Prompt } from '../util/prompt/index.ts';
import { MCP_OPENMEMORY_ID } from '../../mcp/openmemory/index.ts';

export const AGENT_MY_AGENT_ID = 'my-agent';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => {
  const canDelegate = canAgentDelegate(AGENT_MY_AGENT_ID, ctx);
  const hasMemory = isMcpAvailableForAgent(MCP_OPENMEMORY_ID, AGENT_MY_AGENT_ID, ctx);

  return {
    hidden: false,
    mode: 'subagent',
    model: ctx.config.model,
    temperature: 0.5,
    permission: setupAgentPermissions(
      AGENT_MY_AGENT_ID,
      {
        // Agent-specific permission overrides
        edit: 'deny',
        webfetch: 'ask',
      },
      ctx,
    ),
    description: 'Brief description for Task tool selection...',
    prompt: Prompt.template`
      <role>
        You are a specialized agent that does X.
      </role>

      <capabilities>
        - Capability one
        - Capability two
      </capabilities>

      ${Prompt.when(
        canDelegate,
        `
        <teammates>
          ${formatAgentsList(ctx)}
        </teammates>
        `,
      )}

      ${Prompt.when(
        hasMemory,
        `
        <memory>
          Query OpenMemory for relevant context at session start.
        </memory>
        `,
      )}

      <instructions>
        1. Step one
        2. Step two
      </instructions>
    `,
  };
};

export const setupMyAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_MY_AGENT_ID] = defu(
    ctx.config.agent?.[AGENT_MY_AGENT_ID] ?? {},
    getDefaults(ctx),
  );
};
```

### 3. Register in `index.ts`

```typescript
import { setupMyAgentConfig } from './my-agent/index.ts';

export const setupAgentConfig = (ctx: ElishaConfigContext) => {
  // ... existing agents
  setupMyAgentConfig(ctx);
};
```

## Agent Modes

| Mode       | Usage                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| `primary`  | Main agent (orchestrator). Set as `default_agent`.                                  |
| `all`      | Core agents (planner, executor, reviewer) available via Task tool.                  |
| `subagent` | Helper agents (explorer, researcher, consultant, documenter) with specialized roles. |

## Prompt Utilities

Prompts are defined inline using the `Prompt` namespace from `util/prompt/index.ts`.

### `Prompt.template`

Tagged template literal for composing prompts:

```typescript
import { Prompt } from '../util/prompt/index.ts';

const prompt = Prompt.template`
  <role>
    You are a helpful assistant.
  </role>

  <instructions>
    ${instructionList}
  </instructions>
`;
```

Features:

- Filters out `null`, `undefined`, and empty string values
- Preserves indentation for multi-line interpolated values
- Removes common leading indentation (dedent)
- Collapses 3+ consecutive newlines into 2
- Trims leading/trailing whitespace

### `Prompt.when`

Conditional content helper for clean optional sections:

```typescript
${Prompt.when(condition, `
<optional-section>
  This only appears if condition is true.
</optional-section>
`)}
```

### `Prompt.code`

Formats a code block with optional language:

```typescript
${Prompt.code('console.log("Hello");', 'typescript')}
```

## Permission-Aware Prompts

Prompts dynamically adjust based on what tools and MCPs are available to the agent.

### `canAgentDelegate(agentId, ctx)`

Checks if an agent can delegate to other agents. Returns `true` if:

- There are agents with descriptions available for delegation
- The agent has permission to use task tools

```typescript
const canDelegate = canAgentDelegate(AGENT_MY_AGENT_ID, ctx);

${Prompt.when(canDelegate, `
<teammates>
  ${formatAgentsList(ctx)}
</teammates>
`)}
```

### `formatAgentsList(ctx)`

Formats the list of delegatable agents as markdown:

```typescript
const teammates = formatAgentsList(ctx);
// Returns:
// - **explorer**: Searches and navigates the codebase...
// - **executor**: Implements code changes...
```

### `isMcpAvailableForAgent(mcpId, agentId, ctx)`

Checks if an MCP is both enabled and allowed for a specific agent:

```typescript
import { MCP_OPENMEMORY_ID } from '../../mcp/openmemory/index.ts';

const hasMemory = isMcpAvailableForAgent(MCP_OPENMEMORY_ID, AGENT_MY_AGENT_ID, ctx);

${Prompt.when(hasMemory, `
<memory-guidelines>
  Query OpenMemory at session start for relevant context.
</memory-guidelines>
`)}
```

### Other Utility Functions

| Function                              | Purpose                                          |
| ------------------------------------- | ------------------------------------------------ |
| `isToolAllowedForAgent(tool, id, ctx)` | Check if a tool pattern is allowed for an agent |
| `getEnabledAgents(ctx)`               | Get all non-disabled agents                      |
| `getDelegatableAgents(ctx)`           | Get agents with descriptions (for delegation)    |
| `hasAgentsForDelegation(ctx)`         | Check if any agents are available for delegation |
| `isAgentEnabled(name, ctx)`           | Check if a specific agent is enabled             |

## Permission Setup

Use `setupAgentPermissions()` to merge agent-specific overrides with global defaults:

```typescript
permission: setupAgentPermissions(
  AGENT_ID,
  {
    edit: 'deny',           // This agent cannot edit
    webfetch: 'ask',        // Ask before web fetches
    websearch: 'deny',
    codesearch: 'deny',
    'chrome-devtools*': 'deny',
  },
  ctx,
),
```

Permission values: `'allow'`, `'deny'`, `'ask'`

## Existing Agents

| Agent          | Mode       | Purpose                                               |
| -------------- | ---------- | ----------------------------------------------------- |
| `orchestrator` | `primary`  | Task coordinator, delegates all work                  |
| `planner`      | `all`      | Creates implementation plans                          |
| `executor`     | `all`      | Implements plan tasks                                 |
| `reviewer`     | `all`      | Code review (read-only)                               |
| `brainstormer` | `all`      | Creative ideation                                     |
| `designer`     | `all`      | Frontend/UX design specialist                         |
| `explorer`     | `subagent` | Codebase search (read-only)                           |
| `researcher`   | `subagent` | External research                                     |
| `architect`    | `subagent` | Writes architectural specs to .agent/specs/           |
| `consultant`   | `subagent` | Expert helper for debugging blockers (advisory-only)  |
| `documenter`   | `subagent` | Documentation writing                                 |
| `compaction`   | `subagent` | Session compaction                                    |

## Disabling Built-in Agents

The `index.ts` disables some default OpenCode agents to avoid conflicts:

```typescript
disableAgent('build', ctx);
disableAgent('plan', ctx);
disableAgent('explore', ctx);
disableAgent('general', ctx);
```

## Critical Rules

### Always Use `defu` for Config Merging

```typescript
// Correct - preserves user overrides
ctx.config.agent[AGENT_ID] = defu(
  ctx.config.agent?.[AGENT_ID] ?? {},
  getDefaults(ctx),
);

// Wrong - loses nested user config
ctx.config.agent[AGENT_ID] = {
  ...getDefaults(ctx),
  ...ctx.config.agent?.[ID],
};
```

### Include `.ts` Extensions

```typescript
// Correct
import { Prompt } from '../util/prompt/index.ts';

// Wrong - will fail at runtime
import { Prompt } from '../util/prompt';
```

### Export Agent ID Constant

Always export the agent ID for use elsewhere:

```typescript
export const AGENT_MY_AGENT_ID = 'my-agent';
```

### Use Permission-Aware Prompts

Always check permissions before including capability sections:

```typescript
// Correct - only shows teammates if agent can delegate
${Prompt.when(canAgentDelegate(AGENT_ID, ctx), `
<teammates>
  ${formatAgentsList(ctx)}
</teammates>
`)}

// Wrong - shows teammates even if agent can't use them
<teammates>
  ${formatAgentsList(ctx)}
</teammates>
```
