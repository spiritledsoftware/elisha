# Utility Directory

General utilities shared across all domains.

## Directory Structure

```
util/
├── index.ts          # Barrel export
├── types.ts          # ElishaConfigContext type
├── hooks.ts          # aggregateHooks() utility
├── log.ts            # Logging utilities
├── getCacheDir.ts    # Cache directory helper
└── getDataDir.ts     # Data directory helper
```

## Key Exports

### ElishaConfigContext

Type for passing plugin input and config through setup functions:

```typescript
import type { ElishaConfigContext } from '../util/index.ts';

export const setupSomething = (ctx: ElishaConfigContext) => {
  const { input, config } = ctx;
  // ...
};
```

### aggregateHooks

Merges multiple hook sets into one, running same-named hooks with `Promise.all`:

```typescript
import { aggregateHooks } from './util/hooks.ts';

const hooks = aggregateHooks(
  setupInstructionHooks(input),
  setupMcpHooks(input),
  setupTaskHooks(input),
);
```

## Critical Rules

### Import from Barrel

Always import from `util/index.ts`, not individual files:

```typescript
// Correct
import { ElishaConfigContext, aggregateHooks } from '../util/index.ts';

// Avoid
import { ElishaConfigContext } from '../util/types.ts';
```

### Include `.ts` Extensions

```typescript
// Correct
import { log } from '../util/index.ts';

// Wrong - will fail at runtime
import { log } from '../util';
```

## Adding New Utilities

1. Create the utility file in `src/util/`
2. Export from `src/util/index.ts`
3. Use consistent patterns from existing utilities

Only add utilities here if they are truly cross-cutting (used by multiple domains). Domain-specific utilities should stay in their domain (e.g., `agent/util/prompt/`).
