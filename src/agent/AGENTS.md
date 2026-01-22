# Agent Configuration Directory

This directory contains the agent swarm definitions. Each agent is a flat TypeScript file.

## Directory Structure

```
agent/
├── index.ts              # Agent registration and setup (two-phase)
├── types.ts              # AgentCapabilities type
├── [agent].ts            # Each agent as flat file (executor.ts, planner.ts, etc.)
└── util/
    ├── index.ts          # Agent helpers (canAgentDelegate, formatAgentsList, etc.)
    └── prompt/
        ├── index.ts      # Prompt.template, Prompt.when, Prompt.code
        └── protocols.ts  # Protocol namespace (reusable prompt sections)
```

## Creating a New Agent

### 1. Create Agent File

Create a flat file in `agent/`:

```
agent/
└── my-agent.ts
```

### 2. Write the Configuration

```typescript
import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import type { AgentCapabilities } from './types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_MY_AGENT_ID = 'MyName (my-agent)';

export const AGENT_MY_AGENT_CAPABILITIES: AgentCapabilities = {
  task: 'Task type description',
  description: 'When to use this agent',
};

const getDefaultConfig = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'subagent',
  model: ctx.config.model,
  temperature: 0.5,
  permission: setupAgentPermissions(
    AGENT_MY_AGENT_ID,
    {
      edit: 'deny',
      webfetch: 'ask',
    },
    ctx,
  ),
  description: 'Brief description for Task tool selection...',
});

// Phase 1: Config setup
export const setupMyAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_MY_AGENT_ID] = defu(
    ctx.config.agent?.[AGENT_MY_AGENT_ID] ?? {},
    getDefaultConfig(ctx),
  );
};

// Phase 2: Prompt setup (after all configs finalized)
export const setupMyAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_MY_AGENT_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_MY_AGENT_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are a specialized agent that does X.
    </role>

    ${Prompt.when(
      canDelegate,
      `
    <teammates>
      ${formatAgentsList(ctx)}
    </teammates>
    `,
    )}

    <protocols>
      ${Protocol.contextGathering(AGENT_MY_AGENT_ID, ctx)}
      ${Protocol.escalation(AGENT_MY_AGENT_ID, ctx)}
    </protocols>

    <instructions>
      1. Step one
      2. Step two
    </instructions>
  `;
};
```

### 3. Register in `index.ts`

```typescript
import { setupMyAgentConfig, setupMyAgentPrompt } from './my-agent.ts';

export const setupAgentConfig = (ctx: ElishaConfigContext) => {
  // Phase 1: All configs first
  setupMyAgentConfig(ctx);
  // ... other configs

  // Phase 2: All prompts after configs finalized
  setupMyAgentPrompt(ctx);
  // ... other prompts
};
```

### 4. Add to Capabilities Map

In `util/index.ts`, add to `AGENT_CAPABILITIES`:

```typescript
import { AGENT_MY_AGENT_CAPABILITIES, AGENT_MY_AGENT_ID } from '../my-agent.ts';

const AGENT_CAPABILITIES: Record<string, AgentCapabilities> = {
  // ... existing
  [AGENT_MY_AGENT_ID]: AGENT_MY_AGENT_CAPABILITIES,
};
```

## Agent Modes

| Mode       | Usage                                                                               |
| ---------- | ----------------------------------------------------------------------------------- |
| `primary`  | Main agent (orchestrator). Set as `default_agent`.                                  |
| `all`      | Core agents (planner, executor, reviewer, designer, brainstormer) available via Task tool. |
| `subagent` | Helper agents (explorer, researcher, consultant, documenter) with specialized roles. |

## Two-Phase Setup Pattern

Agents use two-phase setup to ensure config is finalized before prompts read it:

```typescript
// In index.ts
export const setupAgentConfig = (ctx: ElishaConfigContext) => {
  // PHASE 1: Config setup (permissions, model, mode)
  setupExplorerAgentConfig(ctx);
  setupExecutorAgentConfig(ctx);
  // ... all other configs

  // PHASE 2: Prompt setup (uses finalized config)
  setupExplorerAgentPrompt(ctx);
  setupExecutorAgentPrompt(ctx);
  // ... all other prompts
};
```

This ensures `canAgentDelegate()` and similar checks see the complete agent roster.

## Prompt Utilities

### `Prompt.template`

Tagged template literal for composing prompts:

```typescript
import { Prompt } from './util/prompt/index.ts';

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

## Protocol Namespace

Reusable prompt sections in `util/prompt/protocols.ts`:

```typescript
import { Protocol } from './util/prompt/protocols.ts';

// Context gathering (memory, explorer, researcher)
${Protocol.contextGathering(AGENT_ID, ctx)}

// Escalation to consultant
${Protocol.escalation(AGENT_ID, ctx)}

// Standard confidence levels
${Protocol.confidence}

// Checkpoint format for plans
${Protocol.checkpoint}

// Task handoff format
${Protocol.taskHandoff}

// Verification checklist
${Protocol.verification}

// Parallel execution guidelines
${Protocol.parallelWork}

// Result synthesis format
${Protocol.resultSynthesis}

// Progress tracking format
${Protocol.progressTracking}
```

Protocols are permission-aware - they only include sections the agent can actually use.

## Permission-Aware Prompts

### `canAgentDelegate(agentId, ctx)`

Checks if an agent can delegate to other agents:

```typescript
const canDelegate = canAgentDelegate(AGENT_MY_AGENT_ID, ctx);

${Prompt.when(canDelegate, `
<teammates>
  ${formatAgentsList(ctx)}
</teammates>
`)}
```

### `isMcpAvailableForAgent(mcpId, agentId, ctx)`

Checks if an MCP is both enabled and allowed for a specific agent:

```typescript
import { MCP_OPENMEMORY_ID } from '../mcp/index.ts';

const hasMemory = isMcpAvailableForAgent(MCP_OPENMEMORY_ID, AGENT_MY_AGENT_ID, ctx);
```

### Other Utility Functions

| Function                              | Purpose                                          |
| ------------------------------------- | ------------------------------------------------ |
| `isToolAllowedForAgent(tool, id, ctx)` | Check if a tool pattern is allowed for an agent |
| `getEnabledAgents(ctx)`               | Get all non-disabled agents                      |
| `getSubAgents(ctx)`                   | Get agents with descriptions (for delegation)    |
| `hasSubAgents(ctx)`                   | Check if any agents are available for delegation |
| `isAgentEnabled(name, ctx)`           | Check if a specific agent is enabled             |
| `formatTaskMatchingTable(ctx)`        | Format task->agent matching table                 |
| `formatTaskAssignmentGuide(ctx)`      | Format simplified assignment guide               |

## Existing Agents

| Agent ID                    | Mode       | Purpose                                              |
| --------------------------- | ---------- | ---------------------------------------------------- |
| `Elisha (orchestrator)`     | `primary`  | Task coordinator, delegates all work                 |
| `Caleb (explorer)`          | `subagent` | Codebase search (read-only)                          |
| `Berean (researcher)`       | `subagent` | External research                                    |
| `Jubal (brainstormer)`      | `all`      | Creative ideation                                    |
| `Ahithopel (consultant)`    | `subagent` | Expert helper for debugging blockers (advisory-only) |
| `Bezalel (architect)`       | `subagent` | Writes architectural specs to .agent/specs/          |
| `Ezra (planner)`            | `all`      | Creates implementation plans                         |
| `Elihu (reviewer)`          | `all`      | Code review (read-only)                              |
| `Luke (documenter)`         | `subagent` | Documentation writing                                |
| `Oholiab (designer)`        | `all`      | Frontend/UX design specialist                        |
| `Baruch (executor)`         | `all`      | Implements plan tasks                                |
| `compaction`                | `subagent` | Session compaction (hidden, system use)              |

## Disabling Built-in Agents

The `index.ts` disables some default OpenCode agents to avoid conflicts:

```typescript
disableAgent('build', ctx);
disableAgent('plan', ctx);
disableAgent('explore', ctx);
disableAgent('general', ctx);
```

## Critical Rules

### Use Flat Files, Not Subdirectories

```
# Correct
agent/executor.ts

# Wrong
agent/executor/index.ts
```

### Always Use `defu` for Config Merging

```typescript
// Correct - preserves user overrides
ctx.config.agent[AGENT_ID] = defu(
  ctx.config.agent?.[AGENT_ID] ?? {},
  getDefaultConfig(ctx),
);

// Wrong - loses nested user config
ctx.config.agent[AGENT_ID] = {
  ...getDefaultConfig(ctx),
  ...ctx.config.agent?.[AGENT_ID],
};
```

### Include `.ts` Extensions

```typescript
// Correct
import { Prompt } from './util/prompt/index.ts';

// Wrong - will fail at runtime
import { Prompt } from './util/prompt';
```

### Export Agent ID and Capabilities

Always export both for use elsewhere:

```typescript
export const AGENT_MY_AGENT_ID = 'MyName (my-agent)';
export const AGENT_MY_AGENT_CAPABILITIES: AgentCapabilities = { ... };
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
