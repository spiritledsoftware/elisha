# Review: Elisha Codebase - Thorough Review

**Version**: 1.1
**Last Updated**: 2026-01-20T12:00:00Z
**Last Agent**: reviewer
**Status**: Open
**Target**: Entire codebase
**Scope**: thorough

## Summary

**Files**: 37 TypeScript files, 23 Markdown files reviewed
**Issues**: 3 critical, 8 warnings, 12 nitpicks

The Elisha codebase demonstrates excellent architectural patterns with consistent use of `defu` for config merging, well-structured agent configurations, and comprehensive prompt engineering. However, there are significant issues with import extension consistency, code duplication in hooks, and missing error handling in several areas.

---

## Architecture Assessment

### Strengths

1. **Clean Plugin Architecture**: The entry point (`src/index.ts`) is minimal and delegates to well-organized setup functions
2. **Consistent Config Pattern**: All modules follow `setup*Config(ctx)` pattern with `defu` merging
3. **Protocol Expansion System**: Shared prompt sections via mustache syntax reduces duplication
4. **Permission Layering**: Global defaults + agent-specific overrides via `setupAgentPermissions()`
5. **Type Safety**: `ElishaConfigContext` provides strong typing throughout
6. **Excellent Prompt Engineering**: Agent prompts are comprehensive with clear examples, anti-patterns, and decision trees

### Concerns

1. **Hook Duplication**: Memory and instruction hooks are nearly identical (~90% shared code)
2. **No Test Coverage**: Zero test files found in the codebase
3. **Missing Error Boundaries**: Hooks don't handle API failures gracefully
4. **Task Tool Memory Leak**: `tasks` object grows unbounded without cleanup

---

## Issues

### Critical

| File | Line | Issue | Confidence | Suggestion |
|------|------|-------|------------|------------|
| `src/tools/task/index.ts` | 109 | Memory leak: `tasks` object grows unbounded without cleanup mechanism | Definite | Add task cleanup after completion or implement TTL-based eviction |
| Multiple files | - | Inconsistent import extensions: ~50% of imports missing `.ts` extension (Bun requirement) | Definite | Add `.ts` extension to all relative imports |
| `src/hooks/memory/index.ts` | 57-95 | No error handling for `session.compacted` event - API failures will crash | Likely | Wrap in try-catch, log errors gracefully |

### Warnings

| File | Line | Issue | Confidence | Suggestion |
|------|------|-------|------------|------------|
| `src/hooks/memory/index.ts` | - | Near-duplicate of `instruction/index.ts` (~90% identical code) | Definite | Extract shared hook factory function |
| `src/hooks/instruction/index.ts` | - | Near-duplicate of `memory/index.ts` (~90% identical code) | Definite | Extract shared hook factory function |
| `src/config/agent/compaction/index.ts` | 1 | Imports from `@opencode-ai/sdk` instead of `@opencode-ai/sdk/v2` | Definite | Use consistent SDK import path |
| `src/config/mcp/exa.ts` | 11-13 | API key exposed in headers without validation | Likely | Add validation for API key format, consider warning if missing |
| `src/config/mcp/context7.ts` | 11-13 | API key header name inconsistent (`CONTEXT7_API_KEY` vs `x-api-key`) | Potential | Verify correct header name with Context7 docs |
| `src/tools/task/index.ts` | 160-167 | Fire-and-forget `ctx.client.session.prompt()` - no await, errors silently ignored | Definite | Add await and error handling |
| `src/config/agent/explorer/index.ts` | 28 | Description has duplicate text ("An autonomous agent..." + "Codebase search specialist...") | Definite | Remove duplicate description prefix |
| `src/config/skill/index.ts` | 3 | Empty function body - placeholder with no implementation | Potential | Either implement or add TODO comment explaining intent |

### Nitpicks

| File | Line | Issue | Confidence | Suggestion |
|------|------|-------|------------|------------|
| `src/config/mcp/index.ts` | 1 | Inconsistent `.ts` extension usage (has `.ts` on types import) | Potential | Standardize all imports to include `.ts` |
| `src/config/mcp/grep-app.ts` | 2-3 | Missing `.ts` extension on imports (inconsistent with other MCP files) | Definite | Add `.ts` extension for consistency |
| `src/config/agent/researcher/prompt.md` | 329-331 | Trailing empty code blocks at end of file | Definite | Remove trailing empty code blocks |
| `src/config/agent/tester/prompt.md` | 370 | Trailing empty code block at end of file | Definite | Remove trailing empty code block |
| `src/config/agent/orchestrator/index.ts` | 29 | Uses `expandProtocols(PROMPT)` but orchestrator prompt uses protocols | Potential | Verified - orchestrator does use `{{protocol:context-handling}}` |
| `src/index.ts` | 2-4 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |
| `src/config/index.ts` | 3-9 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |
| `src/hooks/index.ts` | 2-3 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |
| `src/config/agent/index.ts` | 3-16 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |
| `src/config/command/index.ts` | 1-2 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |
| `src/config/permission/index.ts` | 4-9 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |
| `src/config/permission/agent.ts` | 3-4 | Missing `.ts` extensions on imports | Definite | Add `.ts` extension |

---

## Detailed Findings

### 1. Import Extension Inconsistency (Critical)

The AGENTS.md explicitly states: "All imports MUST include `.ts` extension. Bun requires explicit extensions."

**Current State**: Approximately 50% of imports are missing the `.ts` extension.

**Files with correct extensions**:

- `src/tools/index.ts` - `'./task/index.ts'`
- `src/config/mcp/exa.ts` - `'../types.ts'`, `'./types.ts'`
- `src/config/mcp/context7.ts` - `'../types.ts'`, `'./types.ts'`
- `src/config/mcp/chrome-devtools.ts` - `'../types.ts'`, `'./types.ts'`
- `src/config/mcp/openmemory.ts` - `'../types.ts'`, `'./types.ts'`
- `src/config/mcp/index.ts` - `'../types.ts'` (but missing on others)

**Files missing extensions**:

- `src/index.ts` - All 3 imports
- `src/config/index.ts` - All 7 imports
- `src/hooks/index.ts` - Both imports
- `src/config/agent/index.ts` - All 12 imports
- `src/config/permission/index.ts` - All 6 imports
- `src/config/permission/agent.ts` - Both imports
- `src/config/command/index.ts` - Both imports
- All agent `index.ts` files - `expandProtocols` import
- `src/config/mcp/grep-app.ts` - Both imports
- `src/config/mcp/index.ts` - 4 of 6 imports

### 2. Hook Code Duplication (Warning)

`src/hooks/memory/index.ts` and `src/hooks/instruction/index.ts` are ~90% identical:

**Identical patterns**:

- Session tracking with `Set<string>`
- `chat.message` handler structure
- Duplicate detection logic
- Compaction event handling
- Model/agent extraction from messages

**Only differences**:

- Context tag name (`<memory-context>` vs `<instructions-context>`)
- Config check (memory checks `mcp?.openmemory?.enabled`)
- Prompt content

**Suggested refactor**:

```typescript
// src/hooks/util/createContextHook.ts
export const createContextHook = (options: {
  contextTag: string;
  prompt: string;
  enabledCheck?: (config: Config) => boolean;
}) => (ctx: PluginInput): Hooks => {
  // Shared implementation
};
```

### 3. Task Tool Memory Leak (Critical)

```typescript
// src/tools/task/index.ts:109
const tasks: Record<string, Task> = {};
```

Tasks are added but never removed. Over time, this object will grow unbounded.

**Suggested fix**:

```typescript
// Option 1: Cleanup after completion
if (!args.async) {
  delete tasks[taskID]; // After getting result
}

// Option 2: TTL-based cleanup
const TASK_TTL_MS = 60 * 60 * 1000; // 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, task] of Object.entries(tasks)) {
    if (now - task.startedAt.getTime() > TASK_TTL_MS) {
      delete tasks[id];
    }
  }
}, TASK_TTL_MS / 2);
```

### 4. Fire-and-Forget Promise (Warning)

```typescript
// src/tools/task/index.ts:160-167
ctx.client.session.prompt({
  path: { id: session.id },
  body: {
    agent: args.agent,
    parts: [{ type: 'text', text: args.prompt }],
  },
  query: { directory: ctx.directory },
});
```

This promise is not awaited. If it fails, the error is silently swallowed.

**Suggested fix**:

```typescript
await ctx.client.session.prompt({...}).catch(error => {
  // Log error or handle gracefully
  console.error(`Failed to start task: ${error.message}`);
});
```

### 5. Missing Error Handling in Hooks (Critical)

The `event` handler in both hooks doesn't handle API failures:

```typescript
event: async ({ event }) => {
  if (event.type === 'session.compacted') {
    // All these API calls can fail
    const { model, agent } = await ctx.client.session.messages({...});
    await ctx.client.session.prompt({...});
  }
}
```

**Suggested fix**:

```typescript
event: async ({ event }) => {
  if (event.type === 'session.compacted') {
    try {
      // ... existing code
    } catch (error) {
      console.error(`Failed to re-inject context after compaction: ${error}`);
      // Optionally remove from injectedSessions to retry on next message
    }
  }
}
```

### 6. SDK Import Inconsistency (Warning)

```typescript
// src/config/agent/compaction/index.ts:1
import type { AgentConfig } from '@opencode-ai/sdk';

// All other files use:
import type { AgentConfig } from '@opencode-ai/sdk/v2';
```

### 7. Explorer Description Duplication (Warning)

```typescript
// src/config/agent/explorer/index.ts:27-28
description:
  'An autonomous agent that explores the codebase to gather information and insights to assist other agents in making informed decisions.Codebase search specialist. Finds files, searches code, maps structure...'
```

The description has two concatenated sentences without proper spacing, suggesting accidental duplication.

---

## Code Quality Assessment

### Positive Patterns

1. **Consistent `defu` usage**: All config merging correctly uses `defu` instead of spread operators
2. **Type safety**: Strong typing with `ElishaConfigContext` throughout
3. **Prompts in Markdown**: All long prompts correctly placed in `.md` files
4. **Synthetic messages**: All injected messages correctly marked with `synthetic: true`
5. **Barrel exports**: Consistent use of `index.ts` for exports
6. **Protocol expansion**: Excellent DRY pattern for shared prompt sections

### Agent Prompt Quality

| Agent | Quality | Notes |
|-------|---------|-------|
| orchestrator | Excellent | Comprehensive delegation patterns, context handling, decision flow |
| executor | Excellent | Clear modes, checkpoint protocol, anti-patterns, examples |
| explorer | Good | Clear search strategies, but description has typo |
| architect | Excellent | Confidence levels, escalation patterns, option analysis |
| planner | Excellent | Dependency analysis, task breakdown guidance, templates |
| researcher | Excellent | Tool selection decision tree, fallback strategies, confidence indicators |
| reviewer | Good | Clear scope levels, security checklist |
| tester | Good | Framework detection, mode examples, confidence levels |
| documenter | Good | Style matching guidance, templates, scope levels |
| brainstormer | Good | Creative techniques, output format, anti-patterns |

### Missing Tests

No test files found in the codebase. Critical areas that need testing:

1. **Config merging**: Verify `defu` correctly preserves user overrides
2. **Permission setup**: Verify agent permissions merge correctly
3. **Protocol expansion**: Verify mustache replacement works
4. **Hook injection**: Verify context injection and duplicate detection
5. **Task tool**: Verify session creation, polling, and result extraction

---

## Security Considerations

| Area | Status | Notes |
|------|--------|-------|
| API Keys | Warning | Exa/Context7 keys read from env, but no validation |
| Permissions | Good | Sensible defaults, `.env` files denied |
| Bash | Good | Dangerous `rm` patterns denied |
| External directories | Good | Requires `ask` permission |
| Secrets in logs | Unknown | No logging review performed |

---

## Performance Concerns

| Area | Severity | Issue |
|------|----------|-------|
| Task memory | Medium | Unbounded growth of `tasks` object |
| Hook API calls | Low | Multiple API calls per message (could batch) |
| Session polling | Low | 500ms interval is reasonable |

---

## Actionable Items

Tasks for executor to address (Critical and Warning issues):

### Critical

- [ ] `src/tools/task/index.ts:109` - Add task cleanup mechanism to prevent memory leak
- [ ] Multiple files - Add `.ts` extension to all relative imports (see detailed list below)
- [ ] `src/hooks/memory/index.ts:57-95` - Add try-catch error handling for compaction event
- [ ] `src/hooks/instruction/index.ts:53-92` - Add try-catch error handling for compaction event

### Warnings

- [ ] `src/hooks/` - Extract shared hook factory to eliminate duplication
- [ ] `src/config/agent/compaction/index.ts:1` - Change import to `@opencode-ai/sdk/v2`
- [ ] `src/tools/task/index.ts:160-167` - Add await and error handling for session.prompt
- [ ] `src/config/agent/explorer/index.ts:28` - Fix duplicate description text
- [ ] `src/config/mcp/exa.ts:11-13` - Add API key validation/warning
- [ ] `src/config/mcp/context7.ts:11-13` - Verify correct header name

### Import Extension Fixes Required

**Core files**:

- [ ] `src/index.ts:2-4` - Add `.ts` to `./config`, `./hooks`, `./tools`
- [ ] `src/config/index.ts:3-9` - Add `.ts` to all imports
- [ ] `src/hooks/index.ts:2-3` - Add `.ts` to `./instruction`, `./memory`

**Permission files**:

- [ ] `src/config/permission/index.ts:4-9` - Add `.ts` to all imports
- [ ] `src/config/permission/agent.ts:3-4` - Add `.ts` to imports

**Agent files**:

- [ ] `src/config/agent/index.ts:2-16` - Add `.ts` to all imports
- [ ] All 10 agent `index.ts` files - Add `.ts` to `../util/protocol` import

**MCP files**:

- [ ] `src/config/mcp/index.ts:2-6` - Add `.ts` to 4 imports
- [ ] `src/config/mcp/grep-app.ts:2-3` - Add `.ts` to imports

**Other files**:

- [ ] `src/config/command/index.ts:1-2` - Add `.ts` to imports
- [ ] `src/config/instruction/index.ts:1` - Add `.ts` to import
- [ ] `src/config/skill/index.ts:1` - Add `.ts` to import

### Recommended Improvements

- [ ] Add unit tests for config merging and permission setup
- [ ] Add integration tests for hook injection
- [ ] Consider adding a logging utility for consistent error reporting
- [ ] Document the task tool's memory management strategy
- [ ] Clean up trailing code blocks in researcher and tester prompts

---

## Resolution Log

| Version | Agent | Action | Timestamp |
|---------|-------|--------|-----------|
| 1.0 | reviewer | Initial thorough review | 2026-01-20T00:00:00Z |
| 1.1 | reviewer | Enhanced with detailed findings, architecture assessment, prompt quality review | 2026-01-20T12:00:00Z |
