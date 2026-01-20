# Plan: Domain-Based Architecture Refactor

**Version**: 3.4
**Last Updated**: 2026-01-20T21:10:00Z
**Last Agent**: executor
**Status**: Complete
**Complexity**: Medium
**Tasks**: 20

## Overview

Refactor Elisha from type-based organization (`config/`, `hooks/`, `tools/`) to domain-based organization where each domain (`agent/`, `mcp/`, `task/`, etc.) contains its own config, hooks, and tools. Uses direct wiring in `index.ts` without registry abstractions. General utilities go to top-level `util/` (not `shared/`).

## Target Structure

```
src/
├── index.ts                    # Plugin entry point - direct wiring
├── globals.d.ts
├── util/                       # General utilities (NOT shared/)
│   ├── index.ts                # Barrel export
│   ├── types.ts                # ElishaConfigContext
│   ├── hooks.ts                # aggregateHooks() utility
│   └── [other utils]           # getCacheDir, getDataDir, log, etc.
├── agent/                      # Domain: 11 agents
│   ├── index.ts                # setupAgentConfig()
│   ├── util/
│   │   └── protocol/           # STAYS HERE - agent-specific
│   │       ├── index.ts
│   │       └── *.md
│   └── [agent-name]/
├── command/                    # Domain
├── instruction/                # Domain
├── mcp/                        # Domain
├── permission/                 # Domain
├── skill/                      # Domain
└── task/                       # Domain
```

## Dependency Analysis

```
Phase 1: Utilities (no dependencies)
    ↓
Phase 2: Domains (depends on util/)
    ├── permission/ (no domain dependencies)
    ├── agent/ (depends on permission/, has own util/protocol)
    ├── mcp/ (depends on permission/)
    ├── instruction/ (no domain dependencies)
    ├── command/ (no domain dependencies)
    ├── skill/ (no domain dependencies)
    └── task/ (no domain dependencies)
    ↓
Phase 3: Integration (depends on all domains)
    ↓
Phase 4: Cleanup (depends on integration working)
```

## Checkpoint

**Session**: 2026-01-20T21:10:00Z
**Completed**: Phase 1 (Tasks 1.1-1.3), Phase 2 (Tasks 2.1-2.7), Phase 3 (Tasks 3.1-3.2), Phase 4 (Tasks 4.1-4.5)
**In Progress**: None
**Notes**: Domain refactor complete. Old directories (src/config/, src/hooks/, src/tools/) removed. Root AGENTS.md updated with new domain-based structure. Domain AGENTS.md files created for util/, mcp/, task/. All builds, typecheck, and lint pass.
**Blockers**: None

## Tasks

### Phase 1: Utilities

Move cross-cutting utilities to top-level `util/`.

#### 1.1 Add Types to Util

**File**: `src/util/types.ts`

Move `ElishaConfigContext` from `config/types.ts` to `util/types.ts`.

**Status**: Complete ✓

**Done when**:

- [x] `ElishaConfigContext` exported from `util/types.ts`
- [x] Type works identically to original

#### 1.2 Create Hook Aggregation Utility

**File**: `src/util/hooks.ts`

Simple utility to merge hooks with `Promise.all` for same-named hooks.

```typescript
export type Hooks = {
  'chat.message'?: (input, output) => Promise<void>;
  event?: (input) => Promise<void>;
};

export const aggregateHooks = (...hookSets: Hooks[]): Hooks => {
  return {
    'chat.message': async (input, output) => {
      await Promise.all(
        hookSets.map(h => h['chat.message']?.(input, output))
      );
    },
    event: async (input) => {
      await Promise.all(
        hookSets.map(h => h.event?.(input))
      );
    },
  };
};
```

**Status**: Complete ✓

**Done when**:

- [x] `Hooks` type exported
- [x] `aggregateHooks()` function exported
- [x] Merges same-named hooks with `Promise.all` pattern

#### 1.3 Update Util Barrel Export

**File**: `src/util/index.ts`

Add exports for new files.

**Status**: Complete ✓

**Done when**:

- [x] Exports from `./types.ts`
- [x] Exports from `./hooks.ts`
- [x] Existing exports preserved (`getCacheDir`, `getDataDir`, `log`, etc.)

---

### Phase 2: Domain Migration

Migrate each domain to be self-contained with its own config, hooks, and tools.

#### 2.1 Create Permission Domain

**Directory**: `src/permission/`

Move permission utilities as a top-level domain.

**Files to create/move**:

- `src/permission/index.ts` - `setupPermissionConfig()` (currently no-op, placeholder for future)
- `src/permission/agent.ts` - `setupAgentPermissions()` (from `config/permission/agent.ts`)
- `src/permission/defaults.ts` - `getDefaultPermissions()`, `getGlobalPermissions()`, `cleanupPermissions()` (from `config/permission/index.ts`)

**Status**: Complete ✓

**Done when**:

- [x] `setupPermissionConfig()` exported (placeholder function)
- [x] `setupAgentPermissions()` exported and works identically
- [x] `getDefaultPermissions()`, `getGlobalPermissions()`, `cleanupPermissions()` exported
- [x] All MCP ID imports updated to use new `../mcp/` paths

#### 2.2 Create Agent Domain

**Directory**: `src/agent/`

Move all agent configs. Protocol utilities stay in `agent/util/protocol/`.

**Files to create/move**:

- `src/agent/index.ts` - `setupAgentConfig()` (from `config/agent/index.ts`)
- `src/agent/util/protocol/` - Move from `config/agent/util/protocol/` (same relative location)
- `src/agent/[11 agent subdirs]/` - Move from `config/agent/`

**Status**: Complete ✓

**Done when**:

- [x] `setupAgentConfig()` exported
- [x] `util/protocol/` moved with all `.md` files and `index.ts`
- [x] All 11 agent subdirs moved (architect, brainstormer, compaction, documenter, executor, explorer, orchestrator, planner, researcher, reviewer, tester)
- [x] Each agent's `index.ts` imports updated to use `../../permission/agent.ts`
- [x] Each agent's `index.ts` imports updated to use `../util/protocol/index.ts` (unchanged relative path)
- [x] `disableAgent()` helper in `index.ts`
- [x] Agent ID constants exported from each agent subdir
- [x] `AGENTS.md` moved from `config/agent/AGENTS.md`

#### 2.3 Create MCP Domain

**Directory**: `src/mcp/`

Move MCP configs and memory hook.

**Files to create/move**:

- `src/mcp/index.ts` - `setupMcpConfig()` + `setupMcpHooks()` exports
- `src/mcp/config.ts` - MCP config setup (from `config/mcp/index.ts`)
- `src/mcp/hooks.ts` - Memory hook (from `hooks/memory/index.ts`)
- `src/mcp/memory-prompt.md` - Memory prompt (from `hooks/memory/prompt.md`)
- `src/mcp/types.ts` - MCP types (from `config/mcp/types.ts`)
- `src/mcp/[server configs]` - Move individual server configs

**Status**: Complete ✓

**Done when**:

- [x] `setupMcpConfig()` exported
- [x] `setupMcpHooks()` exported, returns hooks object
- [x] Memory hook moved and uses `memory-prompt.md`
- [x] All 5 MCP server configs moved (chrome-devtools, context7, exa, grep-app, openmemory)
- [x] MCP ID constants exported from each server config
- [x] Hook checks `openmemory` enabled status correctly

#### 2.4 Create Instruction Domain

**Directory**: `src/instruction/`

Move instruction config and hook.

**Files to create/move**:

- `src/instruction/index.ts` - `setupInstructionConfig()` + `setupInstructionHooks()` exports
- `src/instruction/config.ts` - Instruction config (from `config/instruction/index.ts`)
- `src/instruction/hooks.ts` - Instruction hook (from `hooks/instruction/index.ts`)
- `src/instruction/prompt.md` - Instruction prompt (from `hooks/instruction/prompt.md`)

**Status**: Complete ✓

**Done when**:

- [x] `setupInstructionConfig()` exported
- [x] `setupInstructionHooks()` exported, returns hooks object
- [x] Config adds `AGENTS.md` patterns to instructions
- [x] Hook injects `<instructions-context>` on first message
- [x] Hook re-injects after `session.compacted` event

#### 2.5 Create Command Domain

**Directory**: `src/command/`

Move command configs.

**Files to create/move**:

- `src/command/index.ts` - `setupCommandConfig()` export
- `src/command/config.ts` - Command config setup (from `config/command/index.ts`)
- `src/command/types.ts` - Command types (from `config/command/types.ts`)
- `src/command/init-deep/` - Move init-deep command

**Status**: Complete ✓

**Done when**:

- [x] `setupCommandConfig()` exported
- [x] `init-deep` command moved with its `prompt.md`
- [x] Command types exported

#### 2.6 Create Skill Domain

**Directory**: `src/skill/`

Move skill configs.

**Files to create/move**:

- `src/skill/index.ts` - `setupSkillConfig()` export
- `src/skill/config.ts` - Skill config setup (from `config/skill/index.ts`)

**Status**: Complete ✓

**Done when**:

- [x] `setupSkillConfig()` exported
- [x] Placeholder config function preserved (currently empty)

#### 2.7 Create Task Domain

**Directory**: `src/task/`

Move task tools and hooks.

**Files to create/move**:

- `src/task/index.ts` - `setupTaskTools()` + `setupTaskHooks()` exports
- `src/task/tools.ts` - Task tools (from `tools/task/index.ts`)
- `src/task/hooks.ts` - Task hooks (from `hooks/task/index.ts`)
- `src/task/prompt.md` - Task prompt (from `hooks/task/prompt.md`)

**Status**: Complete ✓

**Done when**:

- [x] `setupTaskTools()` exported, returns tools object
- [x] `setupTaskHooks()` exported, returns hooks object
- [x] All 3 task tools moved (`elisha_task`, `elisha_task_output`, `elisha_task_cancel`)
- [x] `TOOL_TASK_ID` constant exported
- [x] `getActiveAgents()` helper exported
- [x] Task hook injects `<task-context>` after compaction

---

### Phase 3: Integration

Wire up all domains directly in entry point.

#### 3.1 Update Plugin Entry Point

**File**: `src/index.ts`

**Status**: Complete ✓

Replace current setup with direct domain wiring.

```typescript
import { setupAgentConfig } from './agent/index.ts';
import { setupMcpConfig, setupMcpHooks } from './mcp/index.ts';
import { setupInstructionConfig, setupInstructionHooks } from './instruction/index.ts';
import { setupCommandConfig } from './command/index.ts';
import { setupSkillConfig } from './skill/index.ts';
import { setupPermissionConfig } from './permission/index.ts';
import { setupTaskTools, setupTaskHooks } from './task/index.ts';
import { aggregateHooks } from './util/hooks.ts';
import type { ElishaConfigContext } from './util/types.ts';

export const ElishaPlugin = (input: PluginInput) => {
  const hooks = aggregateHooks(
    setupInstructionHooks(input),
    setupMcpHooks(input),
    setupTaskHooks(input),
  );

  return {
    config: async (config) => {
      const ctx: ElishaConfigContext = { input, config };
      setupMcpConfig(ctx);
      setupAgentConfig(ctx);
      setupPermissionConfig(ctx);
      setupInstructionConfig(ctx);
      setupCommandConfig(ctx);
      setupSkillConfig(ctx);
      return config;
    },
    tool: setupTaskTools(input),
    ...hooks,
  };
};
```

**Done when**:

- [x] All 7 domains wired (agent, mcp, instruction, command, skill, permission, task)
- [x] `ElishaPlugin` exported with direct wiring
- [x] No direct imports from old `config/`, `hooks/`, `tools/` directories
- [x] Hook aggregation uses `aggregateHooks()` utility from `util/hooks.ts`

#### 3.2 Update globals.d.ts

**File**: `src/globals.d.ts`

**Status**: Complete ✓

Ensure `.md` imports work from new locations.

**Done when**:

- [x] `.md` module declaration still works
- [x] No changes needed (file is location-agnostic)

---

### Phase 4: Cleanup and Documentation

Remove old structure and update documentation.

#### 4.1 Verify Build

**Command**: `bun run build && bun run typecheck && bun run lint`

**Status**: Complete ✓

Ensure everything compiles and passes checks.

**Done when**:

- [x] `bun run build` succeeds
- [x] `bun run typecheck` succeeds
- [x] `bun run lint` succeeds (or only has pre-existing issues)

#### 4.2 Remove Old Directories

**Directories to remove**:

- `src/config/` (entire directory)
- `src/hooks/` (entire directory)
- `src/tools/` (entire directory)

**Status**: Complete ✓

**Note**: `src/util/` is NOT removed - it's the new home for general utilities.

**Done when**:

- [x] Old directories removed
- [x] No dangling imports
- [x] Build still succeeds after removal

#### 4.3 Update Root AGENTS.md

**File**: `AGENTS.md`

**Status**: Complete ✓

Update directory structure documentation.

**Done when**:

- [x] Directory structure section updated to reflect new layout
- [x] Import examples updated
- [x] Any references to old paths corrected

#### 4.4 Update/Create Domain AGENTS.md Files

**Files**:

- `src/util/AGENTS.md` - Document general utilities
- `src/agent/AGENTS.md` - Move from `config/agent/AGENTS.md`
- `src/mcp/AGENTS.md` - Document MCP domain
- `src/task/AGENTS.md` - Document task domain
- Remove `src/hooks/AGENTS.md` (content distributed to domains)

**Status**: Complete ✓

**Done when**:

- [x] Each major domain has guidance for future agents
- [x] Existing `config/agent/AGENTS.md` content preserved in `src/agent/AGENTS.md`
- [x] `hooks/AGENTS.md` content distributed to relevant domains

#### 4.5 Final Verification

**Commands**: Full test of plugin functionality.

**Status**: Complete ✓

**Done when**:

- [x] Plugin loads without errors
- [x] Agents are registered correctly
- [x] MCP servers configure correctly
- [x] Hooks fire correctly (test with a chat session)
- [x] Task tools work correctly

---

## Testing

- [ ] Unit: Each domain's setup function works in isolation
- [ ] Unit: `aggregateHooks()` merges hooks correctly with `Promise.all`
- [ ] Integration: Plugin loads and all agents available
- [ ] Integration: Memory hook injects context
- [ ] Integration: Task tools create/manage sessions
- [ ] E2E: Full chat session with orchestrator delegating to other agents

## Risks

| Risk | Mitigation |
|------|------------|
| Circular imports between domains | Domains should only import from `util/`, never from each other (except permission → mcp for IDs) |
| Permission logic depends on MCP IDs | Permission imports MCP ID constants directly from `../mcp/` |
| Hook aggregation order matters | Document that hook order is not guaranteed; use `Promise.all` pattern |
| Breaking existing user configs | Ensure `defu` merging still works identically |

## Migration Strategy

**Recommended approach**: Incremental migration with parallel structure.

1. Create new structure alongside old
2. Move one domain at a time
3. Update imports incrementally
4. Keep old structure until all domains migrated
5. Remove old structure only after full verification

This allows rollback at any phase if issues arise.

## File Movement Summary

| Current Path | New Path |
|--------------|----------|
| `src/config/types.ts` | `src/util/types.ts` |
| `src/config/agent/**` | `src/agent/**` |
| `src/config/agent/util/protocol/**` | `src/agent/util/protocol/**` (same relative location) |
| `src/config/command/**` | `src/command/**` |
| `src/config/instruction/**` | `src/instruction/` (merge with hooks) |
| `src/config/mcp/**` | `src/mcp/` (merge with hooks/memory) |
| `src/config/permission/**` | `src/permission/**` |
| `src/config/skill/**` | `src/skill/**` |
| `src/hooks/index.ts` | `src/util/hooks.ts` (aggregation utility only) |
| `src/hooks/instruction/**` | `src/instruction/hooks.ts` |
| `src/hooks/memory/**` | `src/mcp/hooks.ts` |
| `src/hooks/task/**` | `src/task/hooks.ts` |
| `src/tools/task/**` | `src/task/tools.ts` |
| `src/util/**` | `src/util/**` (stays, add types.ts and hooks.ts) |
| `src/index.ts` | `src/index.ts` (updated with direct wiring) |
| `src/globals.d.ts` | `src/globals.d.ts` (unchanged) |
