# Elisha

An OpenCode plugin providing AI agent orchestration with persistent memory, specialized agents, and MCP tool integration.

## Tech Stack

- **TypeScript** (ESNext, strict mode)
- **Bun** - Runtime and build tool
- **Biome** - Formatting and linting
- **OpenCode Plugin SDK** (`@opencode-ai/plugin`, `@opencode-ai/sdk`)
- **defu** - Deep object merging for config
- **nanoid** - ID generation

## Project Structure

```
src/
├── index.ts          # Plugin entry point, exports ElishaPlugin
├── context.ts        # AsyncLocalStorage contexts (ConfigContext, PluginContext)
├── types.ts          # Shared type definitions
├── agent/            # Agent definitions and utilities
├── mcp/              # MCP server configurations
├── task/             # Task delegation tools
├── instruction/      # AGENTS.md injection system
├── permission/       # Permission utilities
├── command/          # Slash commands (/init-deep)
├── skill/            # Skill configurations
└── util/             # Shared utilities
```

## Code Standards

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `chrome-devtools.ts`)
- **Functions**: `camelCase` (e.g., `setupAgentConfig`)
- **Types/Interfaces**: `PascalCase` (e.g., `ElishaAgent`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `TOOL_TASK_ID`)

### Import Conventions

- Use `~` path alias for src imports: `import { ConfigContext } from '~/context'`
- Group imports: external packages first, then internal modules
- Use `type` imports for type-only imports: `import type { Config } from '@opencode-ai/sdk/v2'`

### Module Pattern

Each domain module follows this structure:
```typescript
// index.ts - Re-exports public API
export { setupXxxConfig } from './config'
export { setupXxxHooks } from './hook'
export * from './types'
```

## Key Patterns

### Context Pattern (AsyncLocalStorage)

All config access uses `AsyncLocalStorage` contexts:

```typescript
import { ConfigContext, PluginContext } from '~/context';

// Access current config (throws if not in context)
const config = ConfigContext.use();

// Provide context for async operations
await ConfigContext.provide(config, async () => {
  // config available here
});
```

### Define Pattern (Agents, MCPs)

Use factory functions that return objects with `setupConfig` methods:

```typescript
// Agent definition
export const myAgent = defineAgent({
  id: 'Name (role)',
  capabilities: ['What it does'],
  config: () => ({ /* AgentConfig */ }),
  prompt: (self) => Prompt.template`...`,
});

// MCP definition
export const myMcp = defineMcp({
  id: 'mcp-name',
  capabilities: ['What it provides'],
  config: { /* McpConfig */ },
});
```

### Prompt Template Pattern

Use `Prompt.template` for agent prompts with conditional sections:

```typescript
import { Prompt } from './util/prompt';
import { Protocol } from './util/prompt/protocols';

const prompt = Prompt.template`
  <role>...</role>
  ${Prompt.when(condition, '<optional-section>...</optional-section>')}
  ${Protocol.contextGathering(self)}
`;
```

### Hook Aggregation

Multiple hook sets are combined with isolated execution:

```typescript
import { aggregateHooks } from './util/hook';

return aggregateHooks([
  setupMcpHooks(),
  setupInstructionHooks(),
  setupTaskHooks(),
]);
```

## Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun run build` | Build to `dist/` |
| `bun run build:watch` | Build with watch mode |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | Biome linting |
| `bun run lint:fix` | Fix lint issues |
| `bun run format` | Format with Biome |
| `bun run format:check` | Check formatting |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |

## Testing

- Test files: `*.test.ts` co-located with source
- Use `bun:test` (`describe`, `it`, `expect`)
- Mock utilities in `src/test-setup.ts`:
  - `createMockConfig()` - Mock Config object
  - `createMockPluginInput()` - Mock PluginInput
  - `createMockConfigWithMcp()` - Config with MCP servers
  - `createMockConfigWithAgent()` - Config with specific agent

```typescript
import { describe, expect, it } from 'bun:test';
import { ConfigContext } from '~/context';
import { createMockConfig } from '../test-setup';

describe('myFunction', () => {
  it('does something', () => {
    const ctx = createMockConfig();
    ConfigContext.provide(ctx, () => {
      // test code
    });
  });
});
```

## Critical Rules

- **Always use contexts** - Never access config directly; use `ConfigContext.use()`
- **Re-provide context across async boundaries** - AsyncLocalStorage doesn't persist across some async operations
- **Use `defu` for config merging** - Preserves user overrides while applying defaults
- **Test files must use `ConfigContext.provide()`** - Tests need explicit context setup
- **CI runs format, typecheck, lint, build, test** - All must pass before merge

## Anti-Patterns

- ❌ Importing from `@opencode-ai/sdk` without `/v2` suffix
- ❌ Using `config.agent?.foo` without null coalescing defaults
- ❌ Modifying config outside of `setupConfig` functions
- ❌ Creating agents without `defineAgent` factory
- ❌ Hardcoding MCP tool names (use `${mcp.id}*` pattern)
- ❌ Skipping `cleanupPermissions` when setting agent permissions

## Versioning

Uses [changesets](https://github.com/changesets/changesets) for version management:
- Run `bunx @changesets/cli` to create a changeset
- Merging to `main` triggers release workflow
