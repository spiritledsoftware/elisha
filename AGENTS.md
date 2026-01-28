# Elisha

OpenCode plugin providing specialized AI agents, MCP server integrations, and multi-agent orchestration tools for software development.

## Tech Stack

- **Runtime**: Bun (≥1.0.0)
- **Language**: TypeScript (strict mode, ESNext target)
- **Build**: Bun bundler with `.md` as text loader
- **Package**: ESModules (`"type": "module"`)
- **Schema**: Zod 4.x for runtime validation
- **SDK**: `@opencode-ai/plugin` and `@opencode-ai/sdk`

## Project Structure

```
src/
├── index.ts              # Plugin entry point
├── types.ts              # Shared type definitions
├── context.ts            # AsyncLocalStorage contexts
├── agent/                # Agent definition primitives
├── tool/                 # Tool definition primitives
├── mcp/                  # MCP server definition primitives
├── hook/                 # Hook definition primitives
├── command/              # Command definition primitives
├── skill/                # Skill installation logic
├── permission/           # Permission utilities
├── utils/                # Shared utilities (Prompt, session, context)
└── features/             # Feature implementations
    ├── agents/           # 11 specialized agent definitions
    ├── tools/            # Custom tools (task delegation)
    ├── mcps/             # MCP server configurations
    ├── hooks/            # Event hooks (memory, worktree)
    └── commands/         # Slash commands (/init-deep)
assets/
└── skills/               # SKILL.md files copied to ~/.config/opencode/skills/
scripts/
└── build.ts              # Bun build script with asset copying
.agent/                   # Agent-generated artifacts
├── plans/                # Implementation plans
├── specs/                # Specifications
└── reviews/              # Code reviews
```

## Code Standards

### Naming Conventions

| Element         | Convention                 | Example                       |
| --------------- | -------------------------- | ----------------------------- |
| Files           | kebab-case                 | `chrome-devtools.ts`          |
| Agent prompts   | `{agent}.prompt.md`        | `executor.prompt.md`          |
| Test files      | `{name}.test.ts`           | `utils.test.ts`               |
| Factory exports | `{name}Agent`, `{name}Mcp` | `orchestratorAgent`, `exaMcp` |
| Type exports    | PascalCase with `type`     | `type ElishaConfig`           |

### Import Patterns

```typescript
// Always use path alias for src imports
import { ConfigContext } from '~/context';
import { log } from '~/utils';

// Type-only imports use `type` keyword
import type { PluginInput } from '@opencode-ai/plugin';

// Never use require() - always ES imports
```

### Factory Pattern

All domain objects use factory functions that return objects with `setup()` methods:

```typescript
// Agent definition pattern
export const executorAgent = defineAgent({
  id: 'Baruch (executor)',
  config: () => ({
    mode: 'all',
    model: config.model,
    permission: {
      /* ... */
    },
    description: '...',
  }),
  prompt, // Imported from .prompt.md
});

// Tool definition pattern
export const myTool = defineTool({
  id: 'my_tool',
  config: {
    description: '...',
    args: { name: z.string() },
    execute: async (args, ctx) => {
      /* ... */
    },
  },
});
```

### Context Pattern

Uses `AsyncLocalStorage` for dependency injection:

```typescript
// Create context
export const ConfigContext = createContext<ConfigContextType>('ElishaConfigContext');

// Provide context (wrap async operations)
await ConfigContext.provide(config, async () => {
  // Context available here
});

// Use context (must be within provide scope)
const config = ConfigContext.use();

// Capture for async callbacks
const ctx = ConfigContext.capture();
ctx.run(() => originalExecute(...args));
```

### Result Type Pattern

Error handling uses discriminated unions:

```typescript
type Result<T, E extends Error = Error> = { data: T; error?: never } | { data?: never; error: E };

// Usage
const result = await someOperation();
if (result.error) return { error: result.error };
return { data: result.data };
```

### Prompt Templates

Use `Prompt.template` for multi-line prompts with dedent and interpolation:

```typescript
import { Prompt } from '~/utils/prompt';

const prompt = Prompt.template`
  <context>
    ${contextData}
  </context>

  ${Prompt.when(condition, '## Optional Section')}
`;
```

## Commands

| Command               | Description                         |
| --------------------- | ----------------------------------- |
| `bun run build`       | Build dist/ (typecheck + bundle)    |
| `bun run build:watch` | Watch mode build                    |
| `bun run typecheck`   | Run TypeScript type checking (tsgo) |
| `bun run lint`        | Run oxlint                          |
| `bun run lint:fix`    | Fix linting issues                  |
| `bun run format`      | Format with oxfmt                   |
| `bun run test`        | Run tests with Bun                  |
| `bun run test:watch`  | Watch mode tests                    |

## Critical Rules

### MUST Follow

- **Context scope**: Always call `Context.provide()` before `Context.use()` - contexts don't cross async boundaries without re-providing
- **Type imports**: Use `import type` for type-only imports (verbatimModuleSyntax enabled)
- **Path alias**: Use `~` for all src imports, not relative paths like `../../`
- **Factory setup**: Domain objects must call `setup()` before use
- **Test mocks**: Use helpers from `test-setup.ts` (`createMockConfig`, `createMockPluginCtx`)
- **Prompt files**: Agent prompts are `.prompt.md` files imported as text

### Build Requirements

- Run `bun run typecheck` before committing - strict mode is enabled
- Run `bun run lint` to catch issues oxlint detects
- Build copies `assets/` to `dist/assets/` - keep skill files there

## Anti-Patterns

| Don't Do This                             | Do This Instead                                      |
| ----------------------------------------- | ---------------------------------------------------- |
| `import x from '../../context'`           | `import x from '~/context'`                          |
| `import { SomeType } from '...'`          | `import type { SomeType } from '...'`                |
| `const result = await fn(); if (!result)` | `if (result.error) return { error: result.error }`   |
| `require('module')`                       | `import x from 'module'`                             |
| `ConfigContext.use()` outside provide     | Wrap in `ConfigContext.provide(ctx, async () => {})` |
| `agent.prompt = "inline string"`          | Import from `agent.prompt.md`                        |
| Hardcoding tool IDs in prompts            | Reference `${toolName.id}` from tool definition      |

## Testing Patterns

```typescript
import { describe, expect, it } from 'bun:test';
import { ConfigContext } from '~/context';
import { createMockConfig } from '../test-setup';

describe('myFunction', () => {
  it('does something', () => {
    const ctx = createMockConfig({
      config: { agent: { 'Test Agent': { mode: 'subagent' } } },
    });

    ConfigContext.provide(ctx, () => {
      const result = myFunction();
      expect(result).toBe(expected);
    });
  });
});
```

## Agent Development

When adding new agents:

1. Create `src/features/agents/{name}.ts` with `defineAgent()`
2. Create `src/features/agents/{name}.prompt.md` with markdown prompt
3. Export from `src/features/agents/index.ts` array
4. Agent prompt should include skill loading instructions

When modifying agent prompts:

- Edit the `.prompt.md` file, not TypeScript
- Use XML-style tags for structured data (`<context>`, `<sibling_tasks>`)
- Include skill loading table in prompts

## Tool Development

When adding tools:

1. Define with `defineTool()` in feature directory
2. Use Zod schemas for args validation
3. Return JSON strings from execute (will be parsed by SDK)
4. Access context via `PluginContext.use()` inside execute

```typescript
export const myTool = defineTool({
  id: 'my_tool',
  config: {
    description: 'Does something useful',
    args: {
      input: z.string().describe('What to process'),
    },
    execute: async (args, toolCtx) => {
      const { client } = PluginContext.use();
      // ... implementation
      return JSON.stringify({ status: 'completed', result: '...' });
    },
  },
});
```
