# Agent Configuration Directory

This directory contains the agent swarm definitions. Each agent has its own subdirectory.

## Directory Structure

```
agent/
├── index.ts              # Agent registration and setup
├── util/
│   └── protocol/         # Shared prompt sections
│       ├── index.ts      # expandProtocols() function
│       ├── context-handling.md
│       ├── error-handling.md
│       ├── escalation.md
│       └── plan-versioning.md
└── [agent-name]/
    ├── index.ts          # Agent configuration setup
    └── prompt.md         # Agent prompt
```

## Creating a New Agent

### 1. Create Agent Directory

```
agent/
└── my-agent/
    ├── index.ts
    └── prompt.md
```

### 2. Write the Configuration (`index.ts`)

```typescript
import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import type { ElishaConfigContext } from '../..';
import { setupAgentPermissions } from '../../permission/agent.ts';
import { expandProtocols } from '../util/protocol/index.ts';

import PROMPT from './prompt.md';

export const AGENT_MY_AGENT_ID = 'my-agent';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',               // 'primary', 'all', or 'subagent'
  hidden: false,
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
  prompt: expandProtocols(PROMPT),
});

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

| Mode | Usage |
|------|-------|
| `primary` | Main agent (orchestrator). Set as `default_agent`. |
| `all` | Core agents (planner, executor, reviewer) available via Task tool. |
| `subagent` | Helper agents (explorer, researcher, architect, documenter) with specialized roles. |

## Protocol Expansion

Shared prompt sections live in `util/protocol/`. Use mustache syntax in prompts:

```markdown
## Error Handling
{{protocol:error-handling}}
```

Available protocols:

- `{{protocol:context-handling}}` - How to handle provided context
- `{{protocol:error-handling}}` - Error handling patterns
- `{{protocol:escalation}}` - When/how to escalate
- `{{protocol:plan-versioning}}` - Plan version management

Expand in `index.ts`:

```typescript
import { expandProtocols } from '../util/protocol/index.ts';

prompt: expandProtocols(PROMPT),
```

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

| Agent | Mode | Purpose |
|-------|------|---------|
| `orchestrator` | `primary` | Task coordinator, delegates all work |
| `planner` | `all` | Creates implementation plans |
| `executor` | `all` | Implements plan tasks |
| `reviewer` | `all` | Code review (read-only) |
| `brainstormer` | `all` | Creative ideation |
| `explorer` | `subagent` | Codebase search (read-only) |
| `researcher` | `subagent` | External research |
| `architect` | `subagent` | Solution design (no code) |
| `designer` | `subagent` | Frontend/UX design specialist |
| `tester` | `subagent` | Test execution and analysis |
| `documenter` | `subagent` | Documentation writing |
| `compaction` | `subagent` | Session compaction |

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
import { expandProtocols } from '../util/protocol/index.ts';

// Wrong - will fail at runtime
import { expandProtocols } from '../util/protocol';
```

### Export Agent ID Constant

Always export the agent ID for use elsewhere:

```typescript
export const AGENT_MY_AGENT_ID = 'my-agent';
```

### Prompts as Markdown Files

Long prompts go in `prompt.md`, imported as strings:

```typescript
import PROMPT from './prompt.md';
```

This works via `globals.d.ts` type definitions.
