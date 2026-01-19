# Plugin Hooks Directory

This directory contains plugin hooks that inject context into chat sessions.

## Directory Structure

```
hooks/
├── index.ts              # Hook aggregation and setup
├── instruction/          # Instruction injection hooks
│   ├── index.ts
│   └── prompt.md         # AGENTS.md maintenance guidance
└── memory/               # Memory context injection hooks
    ├── index.ts
    └── prompt.md         # OpenMemory usage guidance
```

## Creating a New Hook Module

### 1. Create Hook Directory

```
hooks/
└── my-hook/
    ├── index.ts
    └── prompt.md         # Optional: if injecting prompt content
```

### 2. Write the Hook Setup (`index.ts`)

```typescript
import type { PluginInput } from '@opencode-ai/plugin';
import dedent from 'dedent';
import type { Hooks } from '..';

import PROMPT from './prompt.md';

export const setupMyHooks = (ctx: PluginInput): Hooks => {
  const injectedSessions = new Set<string>();

  return {
    'chat.message': async (_input, output) => {
      const sessionId = output.message.sessionID;
      if (injectedSessions.has(sessionId)) return;

      // Check if already injected in session history
      const existing = await ctx.client.session.messages({
        path: { id: sessionId },
      });
      if (!existing.data) return;

      const hasContext = existing.data.some((msg) => {
        if (msg.parts.length === 0) return false;
        return msg.parts.some(
          (part) =>
            part.type === 'text' &&
            part.text.includes('<my-context>'),
        );
      });
      if (hasContext) {
        injectedSessions.add(sessionId);
        return;
      }

      injectedSessions.add(sessionId);
      await ctx.client.session.prompt({
        path: { id: sessionId },
        body: {
          noReply: true,  // Don't trigger AI response
          model: output.message.model,
          agent: output.message.agent,
          parts: [
            {
              type: 'text',
              text: dedent`
              <my-context>
                ${PROMPT}
              </my-context>`,
              synthetic: true,  // CRITICAL: Must be true
            },
          ],
        },
      });
    },
    event: async ({ event }) => {
      if (event.type === 'session.compacted') {
        // Re-inject after compaction
        const sessionId = event.properties.sessionID;
        // ... fetch model/agent and re-inject
      }
    },
  };
};
```

### 3. Register in `index.ts`

```typescript
import { setupMyHooks } from './my-hook';

export const setupHooks = (ctx: PluginInput): Hooks => {
  const myHooks = setupMyHooks(ctx);
  // ... existing hooks

  return {
    ...myHooks,
    // ... existing hooks
    'chat.message': async (input, output) => {
      await Promise.all([
        myHooks['chat.message']?.(input, output),
        // ... other hooks
      ]);
    },
    event: async (input) => {
      await Promise.all([
        myHooks.event?.(input),
        // ... other hooks
      ]);
    },
  };
};
```

## Key Patterns

### Session Tracking

Always track injected sessions to prevent duplicate injection:

```typescript
const injectedSessions = new Set<string>();

// In chat.message handler:
if (injectedSessions.has(sessionId)) return;
// ... check existing messages for context tag
injectedSessions.add(sessionId);
```

### Duplicate Detection

Check session history for existing context before injecting:

```typescript
const hasContext = existing.data.some((msg) =>
  msg.parts.some(
    (part) =>
      part.type === 'text' &&
      part.text.includes('<my-context>'),
  ),
);
if (hasContext) {
  injectedSessions.add(sessionId);
  return;
}
```

### Re-injection After Compaction

Handle `session.compacted` events to re-inject context:

```typescript
event: async ({ event }) => {
  if (event.type === 'session.compacted') {
    const sessionId = event.properties.sessionID;

    // Fetch model/agent from recent messages
    const { model, agent } = await ctx.client.session
      .messages({
        path: { id: sessionId },
        query: { limit: 50 },
      })
      .then(({ data }) => {
        for (const msg of data || []) {
          if ('model' in msg.info && msg.info.model) {
            return { model: msg.info.model, agent: msg.info.agent };
          }
        }
        return {};
      });

    injectedSessions.add(sessionId);
    await ctx.client.session.prompt({
      // ... inject context
    });
  }
},
```

### Conditional Injection

Check config before injecting (e.g., memory hook checks if OpenMemory is enabled):

```typescript
const { data: config } = await ctx.client.config.get();
if (!(config?.mcp?.openmemory?.enabled ?? true)) {
  return;
}
```

## Available Hooks

| Hook | Trigger | Use Case |
|------|---------|----------|
| `chat.message` | Each chat message | Inject context on first message |
| `event` | System events | Re-inject after `session.compacted` |

## Existing Hook Modules

| Module | Purpose | Context Tag |
|--------|---------|-------------|
| `instruction` | AGENTS.md maintenance guidance | `<instructions-context>` |
| `memory` | OpenMemory usage guidance | `<memory-context>` |

## Critical Rules

1. **Always mark injected messages as `synthetic: true`** - Required for proper message handling
2. **Use `noReply: true`** - Context injection should not trigger AI response
3. **Track injected sessions** - Prevent duplicate injection with `Set<string>`
4. **Check existing messages** - Detect if context already exists in session history
5. **Handle compaction events** - Re-inject context after `session.compacted`
6. **Use `dedent`** - Clean multi-line strings for prompt content
7. **Prompts in `.md` files** - Long prompts go in separate markdown files

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Inject without checking history | Check for existing context tag first |
| Forget `synthetic: true` | Always mark injected messages synthetic |
| Skip compaction handling | Re-inject on `session.compacted` event |
| Use `noReply: false` | Always use `noReply: true` for context |
| Inline long prompts | Put prompts in `.md` files |
| Forget to track session | Add to `injectedSessions` Set |
