# Hook System

Defines hook sets that extend Elisha's behavior through lifecycle events. Each hook set provides isolated, concurrent execution of hooks.

## Hook Architecture

### Hook Definition Pattern

All hook sets use `defineHookSet()` from `./hook.ts`:

```typescript
export const myHooks = defineHookSet({
  id: 'my-hooks',              // Unique identifier
  capabilities: ['...'],       // Array of capability descriptions
  hooks: () => ({              // Returns Partial<Hooks> (can be async)
    'chat.message': async (input, output) => { ... },
    'tool.execute.before': async (input) => { ... },
  }),
});
```

### Available Hook Points

| Hook | Purpose | Arguments |
|------|---------|-----------|
| `chat.params` | Modify chat parameters | `(params)` |
| `chat.message` | React to messages | `(input, output)` |
| `command.execute.before` | Before command execution | `(command)` |
| `tool.execute.before` | Before tool execution | `(input)` |
| `tool.execute.after` | After tool execution | `(input, output)` |
| `permission.ask` | Permission requests | `(permission)` |
| `event` | System events | `({ event })` |
| `experimental.chat.messages.transform` | Transform messages | `(messages)` |
| `experimental.chat.system.transform` | Transform system prompt | `(system)` |
| `experimental.session.compacting` | Session compaction | `(session)` |
| `experimental.text.complete` | Text completion | `(text)` |

## Hook Aggregation

### `aggregateHooks()`

Combines multiple hook sets with error isolation:

```typescript
import { aggregateHooks } from './util';

const combined = aggregateHooks([hookSetA, hookSetB, hookSetC]);
```

**Behavior:**

- Same-named hooks run concurrently via `Promise.allSettled`
- One failing hook doesn't crash others
- Errors are logged but don't propagate

## Adding a New Hook Set

> **CRITICAL**: Import `defineHookSet` from `~/hook/hook`, NOT from `~/hook`.
> The barrel export creates circular dependencies when hook sets import from modules that also use hooks.

1. Create `src/my-feature/hook.ts`:

   ```typescript
   // CORRECT - import from ~/hook/hook
   import { defineHookSet } from '~/hook/hook';
   
   // WRONG - causes circular dependency
   // import { defineHookSet } from '~/hook';
   
   export const myFeatureHooks = defineHookSet({
     id: 'my-feature-hooks',
     capabilities: ['What it does'],
     hooks: () => ({
       'chat.message': async (input, output) => {
         // Hook implementation
       },
     }),
   });
   ```

2. Add to `src/hook/hooks.ts`:

   ```typescript
   import { myFeatureHooks } from '~/my-feature/hook';
   
   export const elishaHooks: ElishaHookSet[] = [
     // ... existing hooks
     myFeatureHooks,
   ];
   ```

## Critical Rules

- **Hook IDs must be unique** - Used for debugging and logging
- **Always use `defineHookSet()`** - Don't create hook sets manually
- **Import from `~/hook/hook`** - Avoid circular dependency via barrel export
- **Hooks must be idempotent** - May be called multiple times
- **Don't throw in hooks** - Errors are logged but execution continues

## Anti-Patterns

- ❌ Importing `defineHookSet` from `~/hook` (causes circular deps)
- ❌ Throwing errors to abort execution (use early returns instead)
- ❌ Relying on hook execution order (hooks run concurrently)
- ❌ Storing state outside hook closure without cleanup strategy
- ❌ Blocking hooks with long synchronous operations
