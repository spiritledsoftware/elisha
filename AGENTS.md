# Elisha

OpenCode plugin providing specialized AI agent orchestration with persistent memory.

## Tech Stack

- **Runtime**: Bun >= 1.0.0
- **Language**: TypeScript (strict mode, ESNext target)
- **Core Dependencies**:
  - `@opencode-ai/plugin` / `@opencode-ai/sdk/v2` - Plugin framework
  - `zod` v4 - Schema validation
  - `defu` - Deep object defaults
- **Tooling**: Biome (format/lint), tsgo (typecheck), Husky (git hooks)

## Project Structure

```
src/
├── index.ts              # Plugin entry, exports ElishaPlugin
├── context.ts            # PluginContext and ConfigContext
├── types.ts              # Global types
├── agent/                # Agent builder and utilities
├── command/              # Command builder
├── hook/                 # Hook builder and utilities
├── mcp/                  # MCP builder
├── tool/                 # Tool builder
├── permission/           # Permission system
├── instruction/          # AGENTS.md injection config
├── skill/                # Skill configuration
├── util/                 # Utilities (prompt, session, context)
└── features/             # Feature implementations
    ├── agents/           # 11 agent definitions
    ├── commands/         # Custom commands
    ├── hooks/            # Hook implementations
    ├── mcps/             # MCP configurations
    └── tools/            # Tool implementations
```

## Core Patterns

### Builder Pattern

All entity types use a `define*` builder function:

```typescript
// Agent
import { defineAgent } from '~/agent';
export const myAgent = defineAgent({
  id: 'Name (role)',
  config: () => ({ /* AgentConfig */ }),
  prompt: (self) => `...`,
});

// Tool
import { defineTool } from '~/tool';
export const myTool = defineTool({
  id: 'my_tool',
  config: { description: '...', args: { /* zod schema */ }, execute: async () => {} },
});

// MCP
import { defineMcp } from '~/mcp';
export const myMcp = defineMcp({
  id: 'my-mcp',
  capabilities: ['...'],
  config: { /* McpConfig */ },
});
```

### Context System

Uses `AsyncLocalStorage` for request-scoped context:

```typescript
import { ConfigContext, PluginContext } from '~/context';

// Access context (throws if not provided)
const config = ConfigContext.use();
const { client, directory } = PluginContext.use();

// Provide context to async scope
await ConfigContext.provide(config, async () => {
  // config available in this scope
});
```

### Path Alias

Use `~` for src imports: `import { Prompt } from '~/util/prompt'`

### Result Pattern

Async operations return discriminated unions:

```typescript
const result = await someOperation();
if (result.error) {
  return { error: result.error };
}
return { data: result.data };
```

### Prompt Templates

Use `Prompt.template` for composing prompts:

```typescript
import { Prompt } from '~/util/prompt';

const prompt = Prompt.template`
  <section>
    ${Prompt.when(condition, 'conditional content')}
    ${otherContent}
  </section>
`;
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run build` | Typecheck + bundle to dist/ |
| `bun run build:watch` | Watch mode build |
| `bun run typecheck` | TypeScript check with tsgo |
| `bun run test` | Run tests |
| `bun run check` | Biome lint + format check |
| `bun run check:fix` | Auto-fix lint/format issues |

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `init-deep.ts` |
| Types | PascalCase | `ElishaAgent` |
| Functions | camelCase | `defineAgent` |
| Agent IDs | `Name (role)` | `Baruch (executor)` |
| Tool IDs | `prefix_action` | `elisha_task_create` |
| MCP IDs | kebab-case | `chrome-devtools` |

## Testing

- Use Bun test runner (`bun test`)
- Tests colocated with source: `foo.ts` → `foo.test.ts`
- Mock helpers in `src/test-setup.ts`
- Use `ConfigContext.provide()` to inject test config

```typescript
import { describe, expect, it } from 'bun:test';
import { ConfigContext } from '~/context';
import { createMockConfig } from '../test-setup';

describe('feature', () => {
  it('works', () => {
    const ctx = createMockConfig();
    ConfigContext.provide(ctx, () => {
      // test with mocked config
    });
  });
});
```

## Critical Rules

1. **Always use context pattern** - Never pass config/client as parameters; use `ConfigContext.use()` / `PluginContext.use()`
2. **Wrap async in context** - When crossing async boundaries, re-provide context
3. **Use path alias** - Import from `~/` not relative `../`
4. **Return result objects** - Use `{ data, error }` pattern for async operations
5. **Register features** - Add new entities to the appropriate index file (`src/features/*/index.ts`)

## Anti-Patterns

- ❌ Direct config access without context: `const config = globalConfig`
- ❌ Relative imports from src: `import { x } from '../../../agent'`
- ❌ Throwing errors from async operations (return error objects instead)
- ❌ Modifying config outside `setup*` functions
- ❌ Forgetting to add new agents/tools/mcps to their index exports
