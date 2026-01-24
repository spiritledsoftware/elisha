# Agent System

Defines the 11 specialized AI agents that form the Elisha swarm. Each agent has a specific role, capabilities, and constraints.

## Agent Architecture

### Agent Definition Pattern

All agents use `defineAgent()` from `./agent.ts`:

```typescript
export const myAgent = defineAgent({
  id: 'Name (role)',           // Format: "Name (role)" - e.g., "Baruch (executor)"
  capabilities: ['...'],       // Array of capability descriptions
  config: () => ({             // Returns AgentConfig (can be async)
    mode: 'subagent',          // 'primary' | 'subagent' | 'all'
    model: config.model,       // Use config.model or config.small_model
    temperature: 0.5,
    permission: { ... },
    description: '...',        // Used by orchestrator for delegation
  }),
  prompt: (self) => Prompt.template`...`,  // Returns prompt string
});
```

### Agent Modes

| Mode | Description | Example |
|------|-------------|---------|
| `primary` | Main entry point, coordinates work | orchestrator |
| `subagent` | Specialist, receives delegated tasks | explorer, executor |
| `all` | Can be primary or subagent | executor (when orchestrator disabled) |

### Agent Hierarchy

```
orchestrator (primary)
├── explorer (read-only search)
├── researcher (external research)
├── brainstormer (ideation)
├── consultant (expert advice)
├── architect (design specs)
├── planner (implementation plans)
├── reviewer (code review)
├── documenter (documentation)
├── designer (UI/CSS)
└── executor (code changes)
```

## Prompt System

### Prompt.template

Tagged template literal that handles:
- Filtering null/undefined/empty values
- Preserving indentation for multi-line interpolations
- Dedenting common leading whitespace
- Collapsing 3+ newlines into 2

```typescript
const prompt = Prompt.template`
  <role>
    ${roleDescription}
  </role>
  
  ${Prompt.when(hasFeature, '<feature>...</feature>')}
`;
```

### Prompt.when

Conditional content inclusion:

```typescript
// Include section only if condition is true
${Prompt.when(self.canDelegate, Protocol.taskHandoff)}

// With else clause
${Prompt.when(hasExplorer, 
  `Delegate to explorer`,
  `Search directly`
)}
```

### Protocol Namespace

Reusable prompt sections in `./util/prompt/protocols.ts`:

| Protocol | Purpose | Dynamic? |
|----------|---------|----------|
| `contextGathering(agent)` | How to gather context | Yes - adapts to agent's MCPs |
| `escalation(agent)` | How to handle blockers | Yes - checks for consultant |
| `confidence` | Confidence level reporting | Static |
| `checkpoint` | Plan checkpoint format | Static |
| `taskHandoff` | Delegation format | Static |
| `verification` | Quality gate checklist | Static |
| `parallelWork` | Parallel execution rules | Static |
| `resultSynthesis` | Combining agent outputs | Static |
| `progressTracking` | Workflow state tracking | Static |
| `clarification` | Handling unclear requests | Static |
| `scopeAssessment` | Complexity triage | Static |
| `reflection` | Self-review before output | Static |
| `retryStrategy` | Failure recovery | Static |

## Agent Utilities

### `./util/index.ts`

```typescript
// Get all enabled agents
getEnabledAgents(): Array<AgentConfig & { id: string }>

// Get agents suitable for delegation (have descriptions)
getSubAgents(): Array<AgentConfig & { id: string }>

// Check if delegation is possible
hasSubAgents(): boolean

// Format agents for prompt injection
formatAgentsList(): string
```

### Agent Self-Reference

The `self` parameter in `config` and `prompt` provides:

```typescript
self.id           // Agent's ID
self.isEnabled    // Whether agent is enabled in config
self.permissions  // Agent's permission config
self.hasPermission(pattern)  // Check specific permission
self.hasMcp(mcpName)         // Check if MCP is available
self.canDelegate             // Can use task tools + has subagents
```

## Permission Patterns

### Common Permission Configs

```typescript
// Read-only agent (explorer)
permission: {
  edit: 'deny',
  webfetch: 'deny',
  websearch: 'deny',
  [`${TOOL_TASK_ID}*`]: 'deny',  // Leaf node - can't delegate
}

// Full access agent (executor)
permission: {
  webfetch: 'deny',
  websearch: 'deny',
  codesearch: 'deny',
}

// Orchestrator (no direct code access)
permission: {
  edit: 'deny',
}
```

### MCP Permission Pattern

Use `${mcp.id}*` wildcard for MCP tool permissions:

```typescript
import { openmemory } from '~/mcp/openmemory';

permission: {
  [`${openmemory.id}*`]: 'allow',  // All openmemory tools
}
```

## Adding a New Agent

1. Create `src/agent/my-agent.ts`:
   ```typescript
   import { defineAgent } from './agent';
   import { Prompt } from './util/prompt';
   import { Protocol } from './util/prompt/protocols';
   
   export const myAgent = defineAgent({
     id: 'Name (role)',
     capabilities: ['What it does'],
     config: () => ({ ... }),
     prompt: (self) => Prompt.template`...`,
   });
   ```

2. Add to `src/agent/index.ts`:
   ```typescript
   import { myAgent } from './my-agent';
   
   export const elishaAgents = [
     // ... existing agents
     myAgent,
   ];
   ```

3. If agent can be delegated to, add to orchestrator's teammates list (automatic via `formatAgentsList()` if it has a `description`)

## Critical Rules

- **Agent IDs must be unique** - Format: "Name (role)"
- **Always use `defineAgent()`** - Don't create agents manually
- **Leaf agents deny `TOOL_TASK_ID*`** - Prevents infinite delegation loops
- **Use `self.canDelegate` checks** - Don't assume delegation is available
- **Prompts must be deterministic** - Same config = same prompt

## Anti-Patterns

- ❌ Hardcoding agent IDs in prompts (use `self.id` or imports)
- ❌ Checking `config.agent?.[id]` directly (use `self.isEnabled`)
- ❌ Creating circular delegation (A → B → A)
- ❌ Skipping `Protocol.contextGathering` for agents that need context
- ❌ Using `Prompt.when` without proper boolean condition
