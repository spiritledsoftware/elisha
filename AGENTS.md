# Elisha - AI Agent Guidelines

OpenCode plugin providing 10 specialized agents, persistent memory via OpenMemory, and pre-configured MCP servers.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run build` | Build with Bun (NOT tsc) |
| `bun run lint` | Lint with Biome |
| `bun run format` | Format with Biome |
| `bun run typecheck` | Type check only (noEmit) |

## Critical Rules

### Import Extensions Required

All imports MUST include `.ts` extension. Bun requires explicit extensions:

```typescript
// Correct
import { foo } from './foo.ts';
import { setupAgentConfig } from '../agent/index.ts';

// Wrong - will fail at runtime
import { foo } from './foo';
```

### Build System

- **Bun builds** - `bun run build` compiles TypeScript
- **tsc is for type checking ONLY** - `noEmit: true` in tsconfig
- Never use `tsc` to build; it will not work

### Config Merging with defu

Always use `defu` for merging configs. Never use spread operators:

```typescript
// Correct
import defu from 'defu';
ctx.config.agent[id] = defu(
  ctx.config.agent?.[id] ?? {},
  getDefaults(ctx),
);

// Wrong - loses nested user overrides
ctx.config.agent[id] = {
  ...getDefaults(ctx),
  ...ctx.config.agent?.[id],
};
```

### Prompts as Markdown Files

Long prompts go in `.md` files, imported as strings via `globals.d.ts`:

```typescript
import PROMPT from './prompt.md';
// PROMPT is a string containing the file contents
```

### Protocol Expansion

Shared prompt sections use mustache syntax. Available protocols:

- `{{protocol:context-handling}}`
- `{{protocol:error-handling}}`
- `{{protocol:escalation}}`
- `{{protocol:plan-versioning}}`

```typescript
import { expandProtocols } from '../util/protocol/index.ts';
prompt: expandProtocols(PROMPT),
```

### Synthetic Messages in Hooks

Hooks that inject messages must mark them as synthetic:

```typescript
return {
  role: 'user',
  content: injectedContent,
  synthetic: true,  // Required
};
```

## Architecture

### Directory Structure

```
src/
├── index.ts              # Plugin entry point
├── globals.d.ts          # Type definitions for .md imports
├── config/               # Configuration modules
│   ├── index.ts          # Central config wiring (setupConfig)
│   ├── types.ts          # ElishaConfigContext type
│   ├── agent/            # Agent definitions (10 agents)
│   │   ├── util/protocol/  # Shared protocol .md files
│   │   └── [agent]/      # Each agent has index.ts + prompt.md
│   ├── command/          # Custom slash commands
│   ├── instruction/      # System instructions
│   ├── mcp/              # MCP server configs
│   ├── permission/       # Permission management
│   └── skill/            # Skill definitions
└── hooks/                # Plugin hooks
    ├── instruction/      # Instruction injection
    └── memory/           # Memory context injection
```

### Config Setup Pattern

Each config module exports a `setup*Config` function:

```typescript
// src/config/agent/executor/index.ts
export const AGENT_EXECUTOR_ID = 'executor';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'all',
  model: ctx.config.model,
  // ...
});

export const setupExecutorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXECUTOR_ID] = defu(
    ctx.config.agent?.[AGENT_EXECUTOR_ID] ?? {},
    getDefaults(ctx),
  );
};
```

### Barrel Exports

Every directory uses `index.ts` for exports. Import from the directory, not individual files:

```typescript
// Correct
import { setupAgentConfig } from './agent/index.ts';

// Avoid (unless importing specific non-exported item)
import { setupExecutorAgentConfig } from './agent/executor/index.ts';
```

## Agents

| Agent | Purpose | Key Tools |
|-------|---------|-----------|
| orchestrator | Coordinates multi-agent workflows | All |
| explorer | Codebase search (read-only) | Glob, Grep, Read |
| architect | Solution design (no code) | Read, Task |
| planner | Creates implementation plans | Read, Write, Task |
| executor | Implements plan tasks | Edit, Write, Bash |
| researcher | External research | WebFetch, WebSearch |
| reviewer | Code review (read-only) | Read, Grep |
| tester | Test execution and analysis | Bash, Read |
| documenter | Documentation writing | Read, Write |
| brainstormer | Creative ideation | Read, Task |

## MCP Servers

Configured in `src/config/mcp/`:

- **OpenMemory** - Persistent memory storage
- **Exa** - Web search
- **Context7** - Library documentation
- **Grep.app** - GitHub code search
- **Chrome DevTools** - Browser automation

## Code Style

Enforced by Biome:

- 2-space indentation
- Single quotes
- Trailing commas on all
- Auto-organized imports

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Use tsc for building | `bun run build` |
| Omit .ts extensions | Include `.ts` in all imports |
| Use spread for config merging | Use `defu` |
| Put long prompts inline | Use `.md` files |
| Forget `synthetic: true` on injected messages | Always mark synthetic |
| Import from deep paths | Use barrel exports from `index.ts` |

## Testing Changes

1. `bun run typecheck` - Verify types
2. `bun run lint` - Check for issues
3. `bun run build` - Ensure it compiles
