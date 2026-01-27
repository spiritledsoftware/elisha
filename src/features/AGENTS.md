# Features Directory

Implementation of all Elisha plugin features: agents, tools, MCPs, hooks, and commands.

## Registration Pattern (Critical)

**Every new feature MUST be registered in its index file to be loaded by the plugin.**

| Feature Type | Index File | Export Array |
|--------------|------------|--------------|
| Agents | `agents/index.ts` | `elishaAgents` |
| Tools | `tools/index.ts` | `elishaToolSets` |
| MCPs | `mcps/index.ts` | `elishaMcps` |
| Hooks | `hooks/index.ts` | `elishaHooks` |
| Commands | `commands/index.ts` | `elishaCommands` |

```typescript
// Example: Adding a new agent
// 1. Create src/features/agents/my-agent.ts
// 2. Add to src/features/agents/index.ts:
import { myAgent } from './my-agent';
export const elishaAgents = [
  // ... existing agents
  myAgent,  // Add here
];
```

## Agent Conventions

### ID Format

Agent IDs follow `Name (role)` pattern using biblical names:

- `Baruch (executor)` - Implementation specialist
- `Caleb (explorer)` - Codebase search specialist
- `Jethro (orchestrator)` - Task coordinator

### Prompt Structure

Agents use XML-structured prompts with the `Protocol` namespace:

```typescript
import { Prompt } from '~/util/prompt';
import { Protocol } from '~/util/prompt/protocols';

export const myAgent = defineAgent({
  id: 'Name (role)',
  config: () => ({
    mode: 'subagent',  // or 'primary', 'all'
    model: config.small_model,  // or config.model
    temperature: 0.4,
    permission: { /* tool permissions */ },
    description: Prompt.template`...`,  // For agent selection
  }),
  prompt: (self) => Prompt.template`
    <role>
      You are [Name], a [description].
    </role>

    ${Prompt.when(self.canDelegate, `
    <teammates>
      ${formatAgentsList()}
    </teammates>
    `)}

    <protocols>
      ${Protocol.agentsMdMaintenance(self)}
      ${Protocol.contextGathering(self)}
      ${Protocol.escalation(self)}
      ${Prompt.when(self.canDelegate, Protocol.taskHandoff)}
    </protocols>

    <instructions>
      1. Follow ALL protocols provided
      2. [Specific instructions]
    </instructions>

    <constraints>
      - [What agent must/must not do]
    </constraints>

    <output_format>
      [Expected response structure]
    </output_format>
  `,
});
```

### Agent Modes

| Mode | Description | Example |
|------|-------------|---------|
| `primary` | Main entry point, can be default agent | Orchestrator |
| `subagent` | Delegated to by other agents | Explorer, Researcher |
| `all` | Can be both primary and subagent | Executor |

### Protocol Namespace

Reusable prompt sections in `src/util/prompt/protocols.ts`:

| Protocol | Purpose |
|----------|---------|
| `Protocol.contextGathering(self)` | Memory/search instructions |
| `Protocol.escalation(self)` | How to handle blockers |
| `Protocol.taskHandoff` | Delegation format |
| `Protocol.verification` | Quality gates |
| `Protocol.agentCommunication(self)` | Sibling task messaging |

## Tool Conventions

### ID Format

Tool IDs use `prefix_action` pattern:

- `elisha_task_create`
- `elisha_task_broadcast`
- `elisha_task_cancel`

### ToolSet Grouping

Related tools are grouped into ToolSets:

```typescript
// src/features/tools/tasks/index.ts
export const taskToolSet = defineToolSet({
  id: 'elisha_task',
  config: async () => ({
    [taskCreateTool.id]: await taskCreateTool.setup(),
    [taskOutputTool.id]: await taskOutputTool.setup(),
    // ...
  }),
});
```

### Tool with Hooks

Tools that need event handling colocate hooks:

```
tools/
└── tasks/
    ├── index.ts    # Tool definitions
    ├── hooks.ts    # Event handlers
    └── types.ts    # Shared types
```

## Hook Conventions

### Event-Driven Context Injection

Hooks listen to OpenCode events and inject synthetic messages:

```typescript
export const myHooks = defineHookSet({
  id: 'my-hooks',
  hooks: () => ({
    event: async ({ event }) => {
      if (event.type === 'session.compacted') {
        // Inject context after compaction
        await client.session.promptAsync({
          sessionID: event.properties.sessionID,
          noReply: true,
          parts: [{ type: 'text', text: '...', synthetic: true }],
        });
      }
    },
  }),
});
```

### Common Event Types

- `session.created` - New session started
- `session.compacted` - Session history compressed
- `session.status` - Session state changed
- `tool.execute.after` - Tool finished execution

## MCP Conventions

### Structure

```typescript
export const myMcp = defineMcp({
  id: 'my-mcp',  // kebab-case
  capabilities: ['Capability 1', 'Capability 2'],
  config: {
    enabled: true,
    type: 'local',
    command: ['bunx', '-y', 'package-name', 'mcp'],
    environment: { /* env vars */ },
  },
});
```

### Colocated Hooks

MCPs with special handling have colocated hooks:

```
mcps/
└── openmemory/
    ├── index.ts   # MCP definition
    └── hooks.ts   # Memory validation hooks
```
