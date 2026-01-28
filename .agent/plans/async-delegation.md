# Plan: Async Delegation Support for Agent Prompts

**Version**: 1.1
**Last Updated**: 2025-01-20T18:00:00Z
**Last Agent**: executor
**Status**: Complete
**Complexity**: Medium
**Tasks**: 10

## Overview

Add async delegation protocol and guidance to agent prompts, enabling agents to launch parallel tasks, collect results with timeouts, and synthesize findings efficiently.

## Checkpoint

**Session**: 2025-01-20T18:00:00Z
**Completed**: All tasks (1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3)
**In Progress**: None
**Notes**: All phases complete. Verification passed (typecheck, build, lint).
**Blockers**: None

## Tasks

### Phase 1: Protocol Infrastructure

#### 1.1 Create Async Delegation Protocol

**Status**: Complete ✓

**File**: `src/agent/util/protocol/async-delegation.md`

Create the new protocol file with comprehensive async delegation guidance.

**Content must include**:

- Decision matrix (when to use async vs sync delegation)
- Async pattern: launch → collect → synthesize
- Timeout guidelines by task type
- Error handling for partial results
- Anti-patterns to avoid

**Done when**:

- [x] Protocol file exists at `src/agent/util/protocol/async-delegation.md`
- [x] Contains decision matrix table (async vs sync criteria)
- [x] Contains async pattern with clear steps
- [x] Contains timeout guidelines table by task type
- [x] Contains anti-patterns section
- [x] Follows existing protocol file format (see `context-handling.md` for reference)

#### 1.2 Register Protocol in Index

**Status**: Complete ✓

**File**: `src/agent/util/protocol/index.ts`

Add the new protocol to the PROTOCOLS registry so `{{protocol:async-delegation}}` works.

**Done when**:

- [x] Import statement added for `async-delegation.md`
- [x] Entry added to PROTOCOLS object with key `'async-delegation'`
- [x] `bun run typecheck` passes
- [x] `bun run build` succeeds

### Phase 2: Primary Delegator Updates

#### 2.1 Update Orchestrator Prompt - Add Protocol Reference

**Status**: Complete ✓

**File**: `src/agent/orchestrator/prompt.md`

Add the async delegation protocol reference to the orchestrator prompt.

**Location**: After the "Context Handling" section (around line 146)

**Done when**:

- [x] `{{protocol:async-delegation}}` added after Context Handling section
- [x] Brief intro sentence before protocol reference explaining its purpose

#### 2.2 Update Orchestrator Prompt - Enhance Parallel Section

**Status**: Complete ✓

**File**: `src/agent/orchestrator/prompt.md`

Update the existing "Parallel vs Sequential" section (lines 314-325) to reference the protocol and add concrete async examples.

**Done when**:

- [x] Parallel section references async delegation protocol
- [x] Adds example showing async launch with timeout
- [x] Adds example showing result collection and synthesis
- [x] Maintains existing sequential guidance

### Phase 3: Core Agent Updates

#### 3.1 Update Architect Prompt

**Status**: Complete ✓

**File**: `src/agent/architect/prompt.md`

Add async delegation protocol and concrete example for parallel context gathering.

**Location**: After the "Context Handling" section (around line 35)

**Done when**:

- [x] `{{protocol:async-delegation}}` added after Context Handling section
- [x] Concrete example added showing parallel explorer + researcher launch
- [x] Example shows timeout handling for research tasks
- [x] Key point added for architects about async context gathering

#### 3.2 Update Executor Prompt

**Status**: Complete ✓

**File**: `src/agent/executor/prompt.md`

Add async delegation protocol with focus on parallel context gathering pattern.

**Location**: After the "Context Handling" section (around line 240)

**Done when**:

- [x] `{{protocol:async-delegation}}` added after Context Handling section
- [x] Key point added for executors about when to use async (multiple file lookups)
- [x] Example showing parallel explorer calls for related files

#### 3.3 Update Planner Prompt

**Status**: Complete ✓

**File**: `src/agent/planner/prompt.md`

Add protocol reference with brief guidance on async delegation during planning.

**Location**: After the "Context Handling" section (around line 101)

**Done when**:

- [x] `{{protocol:async-delegation}}` added after Context Handling section
- [x] Key point added for planners about async context gathering before planning

### Phase 4: Supporting Agent Updates

#### 4.1 Update Reviewer Prompt

**Status**: Complete ✓

**File**: `src/agent/reviewer/prompt.md`

Add protocol reference for async delegation during thorough reviews.

**Location**: After the "Context Handling" section (around line 96)

**Done when**:

- [x] `{{protocol:async-delegation}}` added after Context Handling section
- [x] Key point added for reviewers about parallel pattern/security research

#### 4.2 Update Tester Prompt

**Status**: Complete ✓

**File**: `src/agent/tester/prompt.md`

Add protocol reference for async delegation during test analysis.

**Location**: After any existing Context Handling section, or in Delegation section

**Done when**:

- [x] `{{protocol:async-delegation}}` added in appropriate location
- [x] Key point added for testers about parallel test file discovery

#### 4.3 Update Documenter Prompt

**Status**: Complete ✓

**File**: `src/agent/documenter/prompt.md`

Add protocol reference for async delegation during documentation.

**Location**: After any existing Context Handling section, or in Delegation section

**Done when**:

- [x] `{{protocol:async-delegation}}` added in appropriate location
- [x] Key point added for documenters about parallel code exploration

## Testing

- [x] `bun run typecheck` passes after all changes
- [x] `bun run build` succeeds
- [x] `bun run lint` passes (or only pre-existing issues)
- [x] Protocol expansion works: verify `{{protocol:async-delegation}}` expands correctly

## Verification Commands

```bash
# Type check
bun run typecheck

# Build
bun run build

# Lint
bun run lint

# Verify protocol expansion (manual test)
# Import expandProtocols and test with a string containing {{protocol:async-delegation}}
```

## Risks

| Risk                                    | Mitigation                                                   |
| --------------------------------------- | ------------------------------------------------------------ |
| Protocol content too verbose            | Keep decision matrix concise, use tables                     |
| Inconsistent integration across prompts | Follow exact pattern from context-handling protocol          |
| Build failures from .md import          | Verify globals.d.ts handles .md imports (already configured) |
| Agents ignore async guidance            | Make examples concrete and actionable                        |

## Protocol Content Outline

The async-delegation.md protocol should contain:

```markdown
# Async Delegation Protocol

## Decision Matrix

| Criteria                     | Use Async | Use Sync |
| ---------------------------- | --------- | -------- |
| Tasks are independent        | ✓         |          |
| Need result before next step |           | ✓        |
| Multiple similar lookups     | ✓         |          |
| Sequential dependency        |           | ✓        |

## Async Pattern

1. **Launch**: Start multiple tasks with `async: true`
2. **Collect**: Gather results with appropriate timeouts
3. **Synthesize**: Combine findings, handle partial results

## Timeout Guidelines

| Task Type             | Recommended Timeout | Rationale               |
| --------------------- | ------------------- | ----------------------- |
| Explorer (quick)      | 30s                 | File search is fast     |
| Explorer (thorough)   | 60s                 | Deep search needs time  |
| Researcher (quick)    | 45s                 | Web calls have latency  |
| Researcher (thorough) | 90s                 | Multiple sources        |
| Architect             | 120s                | Design requires thought |

## Handling Partial Results

- If some tasks timeout, proceed with available results
- Note which tasks failed in synthesis
- Escalate if critical information missing

## Anti-Patterns

- ❌ Don't launch async for dependent tasks
- ❌ Don't ignore timeouts (tasks may hang)
- ❌ Don't launch more than 4 parallel tasks
- ❌ Don't use async for single quick lookups
```

## Dependencies

- Phase 1 must complete before Phases 2-4 (protocol must exist to reference)
- Phase 2-4 tasks are independent and can be done in any order
- All phases depend on existing protocol infrastructure working
