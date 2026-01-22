# Utility Directory

General utilities shared across all domains.

## Directory Structure

```
util/
├── index.ts          # All utilities + re-exports from ../types.ts
└── hook.ts           # aggregateHooks() utility
```

## Key Exports

### ElishaConfigContext

Type for passing plugin input and config through setup functions (re-exported from `../types.ts`):

```typescript
import type { ElishaConfigContext } from './util/index.ts';

export const setupSomething = (ctx: ElishaConfigContext) => {
  const { input, config, directory, client } = ctx;
  // ...
};
```

### aggregateHooks

Merges multiple hook sets into one, running same-named hooks with `Promise.all`:

```typescript
import { aggregateHooks } from './util/index.ts';

const hooks = aggregateHooks(
  [
    setupInstructionHooks(input),
    setupMcpHooks(input),
    setupTaskHooks(input),
  ],
  ctx,
);
```

### getCacheDir / getDataDir

Platform-aware directory helpers:

```typescript
import { getCacheDir, getDataDir } from './util/index.ts';

const cacheDir = getCacheDir();
// macOS/Linux: ~/.cache/elisha
// Windows: %LOCALAPPDATA%/Elisha/Cache

const dataDir = getDataDir();
// macOS/Linux: ~/.local/share/elisha
// Windows: %LOCALAPPDATA%/Elisha/Data
```

### log

Async logging utility that sends to the OpenCode app:

```typescript
import { log } from './util/index.ts';

await log(
  {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error'
    message: 'Something happened',
    meta: { key: 'value' },
  },
  ctx,
);
```

## Types (from ../types.ts)

```typescript
// Plugin context with config
export type ElishaConfigContext = PluginInput & { config: Config };

// Hook types (everything except config, tool, auth)
export type Hooks = Omit<
  Awaited<ReturnType<Plugin>>,
  'config' | 'tool' | 'auth'
>;

// Tool types
export type Tools = Awaited<ReturnType<Plugin>>['tool'];
```

## Critical Rules

### Import from Barrel

Always import from `util/index.ts`, not individual files:

```typescript
// Correct
import { ElishaConfigContext, aggregateHooks, log } from './util/index.ts';

// Avoid
import { aggregateHooks } from './util/hook.ts';
```

### Include `.ts` Extensions

```typescript
// Correct
import { log } from './util/index.ts';

// Wrong - will fail at runtime
import { log } from './util';
```

## Adding New Utilities

1. Add the utility function directly to `src/util/index.ts`
2. Export it from the same file
3. Use consistent patterns from existing utilities

Only add utilities here if they are truly cross-cutting (used by multiple domains). Domain-specific utilities should stay in their domain:

| Location | Use For |
| -------- | ------- |
| `util/index.ts` | Cross-cutting utilities (logging, paths, hook aggregation) |
| `agent/util/` | Agent-specific helpers (delegation, formatting) |
| `agent/util/prompt/` | Prompt composition utilities |
| `mcp/util.ts` | MCP-specific helpers |
| `task/util.ts` | Task-specific helpers |
| `permission/util.ts` | Permission-specific helpers |
