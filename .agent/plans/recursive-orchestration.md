# Plan: Recursive Orchestration with Git Worktree Isolation

**Version**: 2.0
**Last Updated**: 2026-01-27T18:00:00Z
**Last Agent**: Ezra (planner)
**Status**: Draft
**Complexity**: High
**Tasks**: 32

## Overview

Implement recursive orchestration with git worktree isolation across four phases. This enables orchestrators to spawn sub-orchestrators in isolated worktrees, providing true file-level isolation for parallel work. The implementation progresses from MVP foundation through integration, observability, and hardening.

**Phase Summary**:

- **Phase 1 (MVP)**: Core worktree lifecycle tools, `workdir` parameter, Jethro mode change, basic cleanup
- **Phase 2 (Integration)**: Status/merge/report tools, review gate integration with Elihu
- **Phase 3 (Observability)**: Hierarchical task IDs, progress reporting, state persistence
- **Phase 4 (Hardening)**: Comprehensive error handling, cleanup automation, configuration, performance

## Spec Reference

- **Spec**: `.agent/specs/recursive-orchestration.md`
- **Phase 1**: Lines 1029-1035 (Foundation/MVP)
- **Phase 2**: Lines 1037-1042 (Integration)
- **Phase 3**: Lines 1044-1048 (Observability)
- **Phase 4**: Lines 1050-1055 (Hardening)

## Dependencies

- Git must be available in the environment
- Existing `elisha_task_create` tool in `src/features/tools/tasks/index.ts`
- Existing `defineHookSet` pattern in `src/hook/hook.ts`
- Existing `PluginContext` for accessing `client` and `directory`

## Risks

| Risk                                        | Impact | Mitigation                                                 |
| ------------------------------------------- | ------ | ---------------------------------------------------------- |
| Git worktree commands fail on edge cases    | High   | Comprehensive error handling with specific error codes     |
| Orphaned worktrees on crashes               | Medium | Cleanup hooks + periodic prune on plugin init              |
| Path validation bypass                      | High   | Strict validation that paths are within `.git/workspaces/` |
| Branch name collisions                      | Medium | Validate branch doesn't exist before creation              |
| Session directory mismatch                  | Medium | Always use absolute paths for worktree directories         |
| Merge conflicts block integration           | Medium | Review gate with Elihu, conflict resolution workflow       |
| State loss on restart                       | Medium | Worktree state persistence in Phase 3                      |
| Resource exhaustion from too many worktrees | Medium | Configurable max_concurrent limit in Phase 4               |

---

## Phase 1: Foundation (MVP)

> **Milestone**: Basic worktree creation/removal, task spawning in worktrees, sub-orchestration enabled
> **Tasks**: 12 | **Estimated Effort**: Medium-High

### Phase 1A: Types and Utilities (Sequential)

> Foundation types and git utilities must be created first as all tools depend on them.

#### 1.1 Create Worktree Types

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/types.ts`
**Depends on**: none

Create the type definitions for worktree operations as specified in the spec (Appendix C, lines 985-1027).

**Implementation details**:

- Define `WorktreeState` union type
- Define `WorktreeInfo` type with all fields
- Define `WorktreeCreateResult`, `WorktreeRemoveResult` discriminated unions
- Export all types

**Done when**:

- [ ] File exists at `src/features/tools/worktree/types.ts`
- [ ] `WorktreeState` type matches spec (pending, active, completed, blocked, failed, merging, merged, abandoned)
- [ ] `WorktreeInfo` type includes: id, path, branch, base_branch, base_commit, state, created_at, session_id, parent_session_id?, auto_cleanup
- [ ] `WorktreeCreateResult` discriminated union with `status: 'created' | 'failed'`
- [ ] `WorktreeRemoveResult` discriminated union with `status: 'removed' | 'failed'`
- [ ] Error codes defined: `BRANCH_EXISTS`, `PATH_EXISTS`, `GIT_ERROR`, `PERMISSION_DENIED`, `UNCOMMITTED_CHANGES`, `NOT_FOUND`
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `src/features/tools/tasks/types.ts` for discriminated union style
- Constraint: Use `export type` for all type exports

---

#### 1.2 Create Git Utilities Module

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/git.ts`
**Depends on**: 1.1

Create utility functions for git worktree operations. These wrap git commands with proper error handling.

**Implementation details**:

- `execGit(args: string[], cwd: string)`: Execute git command, return `{ data, error }` result
- `getWorktreeList(cwd: string)`: Parse `git worktree list --porcelain` output
- `getCurrentBranch(cwd: string)`: Get current branch name
- `branchExists(branch: string, cwd: string)`: Check if branch exists
- `getBaseBranchCommit(branch: string, cwd: string)`: Get SHA of branch HEAD
- `validateBranchName(name: string)`: Validate against regex `^[a-z0-9][a-z0-9\-\/]*[a-z0-9]$`
- `computeWorktreePath(directory: string, branchName: string)`: Compute `.git/workspaces/{suffix}` path
- `validateWorktreePath(path: string, directory: string)`: Ensure path is within `.git/workspaces/`

**Done when**:

- [ ] File exists at `src/features/tools/worktree/git.ts`
- [ ] All functions use result pattern `{ data, error }`
- [ ] `execGit` properly captures stdout/stderr
- [ ] `getWorktreeList` parses porcelain format correctly
- [ ] `validateBranchName` rejects invalid names (spaces, special chars, etc.)
- [ ] `validateWorktreePath` prevents path traversal attacks
- [ ] `computeWorktreePath` derives suffix from branch name (e.g., `feature/ui` -> `ui`)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `src/util/session.ts` for result pattern style
- Use `Bun.spawn` for git command execution
- Constraint: Never use `--force` flags in git commands

---

#### 1.3 Create Worktree Registry

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/registry.ts`
**Depends on**: 1.1

Create an in-memory registry to track worktrees created by Elisha sessions. This enables cleanup on session end.

**Implementation details**:

- `WorktreeRegistry` class with Map<worktreeId, WorktreeInfo>
- `register(info: WorktreeInfo)`: Add worktree to registry
- `unregister(worktreeId: string)`: Remove from registry
- `get(worktreeId: string)`: Get worktree info
- `getBySessionId(sessionId: string)`: Get all worktrees for a session
- `getByPath(path: string)`: Find worktree by path
- `list()`: Get all registered worktrees
- Export singleton instance `worktreeRegistry`

**Done when**:

- [ ] File exists at `src/features/tools/worktree/registry.ts`
- [ ] `WorktreeRegistry` class implemented with all methods
- [ ] Singleton `worktreeRegistry` exported
- [ ] `getBySessionId` returns array of worktrees for cleanup
- [ ] Thread-safe for concurrent access (Map is sufficient for single-threaded Bun)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Simple class with Map storage
- Constraint: Registry is in-memory only (no persistence for MVP)

---

### Phase 1B: Core Tools (Parallel after 1A)

> These tools can be developed in parallel once types and utilities exist.

#### 1.4 Implement `git_worktree_create` Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: 1.1, 1.2, 1.3
**Parallel group**: A

Implement the worktree creation tool as specified in the spec (lines 255-311).

**Implementation details**:

- Tool ID: `git_worktree_create`
- Args: `branch_name` (required), `base_branch` (default: "HEAD"), `path_suffix` (optional)
- Validate branch name with regex
- Check branch doesn't already exist
- Compute worktree path: `.git/workspaces/{suffix}`
- Execute: `git worktree add .git/workspaces/{suffix} -b {branch_name} {base_branch}`
- Generate unique worktree ID (e.g., `wt-{nanoid}`)
- Register in worktree registry with session context
- Return `WorktreeCreateResult`

**Done when**:

- [ ] Tool defined with `defineTool` pattern
- [ ] Branch name validation rejects invalid names
- [ ] Existing branch check prevents overwrite
- [ ] Worktree created at `.git/workspaces/{suffix}`
- [ ] Worktree registered with session ID from `toolCtx.sessionID`
- [ ] Returns absolute path in result
- [ ] Returns base commit SHA in result
- [ ] Error cases return appropriate error codes
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `src/features/tools/tasks/index.ts` for tool definition
- Use `PluginContext.use()` to get `directory`
- Constraint: Path must be within `.git/workspaces/`

---

#### 1.5 Implement `git_worktree_remove` Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: 1.1, 1.2, 1.3
**Parallel group**: A

Implement the worktree removal tool as specified in the spec (lines 427-467).

**Implementation details**:

- Tool ID: `git_worktree_remove`
- Args: `worktree_id` (required), `force` (default: false), `delete_branch` (default: false)
- Look up worktree in registry
- Check for uncommitted changes (unless force=true)
- Execute: `git worktree remove {path}` (add `--force` only if force=true)
- Optionally delete branch: `git branch -d {branch}` (or `-D` if force)
- Unregister from registry
- Return `WorktreeRemoveResult`

**Done when**:

- [ ] Tool defined with `defineTool` pattern
- [ ] Validates worktree_id exists in registry
- [ ] Checks for uncommitted changes before removal
- [ ] `force=true` allows removal with uncommitted changes
- [ ] `delete_branch=true` deletes the associated branch
- [ ] Unregisters worktree from registry on success
- [ ] Returns `had_uncommitted_changes` in result
- [ ] Error cases return appropriate error codes
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `src/features/tools/tasks/index.ts` for tool definition
- Constraint: Only use `--force` when explicitly requested

---

### Phase 1C: Task Integration (Sequential after 1B)

> Modifying existing task tool requires worktree tools to be complete.

#### 1.6 Add `workdir` Parameter to `elisha_task_create`

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 1.4, 1.5

Modify the existing `elisha_task_create` tool to accept an optional `workdir` parameter for spawning tasks in worktrees.

**Implementation details**:

- Add `workdir` arg: `z.string().optional().describe("Working directory for the task...")`
- Use `args.workdir ?? directory` for task directory
- Pass `taskDirectory` to `client.session.create({ directory: taskDirectory })`
- Pass `taskDirectory` to `client.session.prompt*({ directory: taskDirectory })`
- Inject branch context into prompt when workdir differs from main directory

**Done when**:

- [ ] `workdir` parameter added to args schema
- [ ] `workdir` used for session creation when provided
- [ ] `workdir` used for prompt calls when provided
- [ ] Default behavior unchanged when `workdir` not provided
- [ ] Existing tests still pass (if any)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing code in `taskCreateTool`
- Key lines to modify: 75, 115-121, 135-139, 160-165
- Constraint: Must be backward compatible

---

#### 1.7 Inject Branch Context for Worktree Tasks

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: 1.6

When spawning a task in a worktree, inject context about the branch scope into the prompt.

**Implementation details**:

- Detect when `taskDirectory` differs from main `directory`
- Get current branch name from worktree using `getCurrentBranch`
- Inject `<branch_context>` XML block into enriched prompt (spec lines 231-250)
- Include: branch name, workdir path, parent branch info

**Done when**:

- [ ] Branch context injected when `workdir` is a worktree
- [ ] Context includes branch name, workdir path
- [ ] Context includes constraints about not merging to parent
- [ ] Context not injected when `workdir` matches main directory
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing `siblingContext` injection pattern
- Use `Prompt.template` for XML formatting
- Import `getCurrentBranch` from `~/features/tools/worktree/git`

---

### Phase 1D: Agent Configuration (Parallel with 1C)

#### 1.8 Change Jethro Mode to `all`

**Agent**: Baruch (executor)
**File**: `src/features/agents/orchestrator.ts`
**Depends on**: none
**Parallel group**: B

Change Jethro's mode from `primary` to `all` to enable sub-orchestration.

**Implementation details**:

- Change line 13: `mode: 'primary'` -> `mode: 'all'`
- No other changes needed

**Done when**:

- [ ] `mode: 'all'` in orchestrator agent config
- [ ] TypeScript compiles without errors
- [ ] Agent can be used as both primary and subagent

**Handoff context**:

- Single line change at line 13
- Constraint: No other changes to agent config

---

#### 1.9 Add Sub-Orchestrator Protocol to Jethro

**Agent**: Baruch (executor)
**File**: `src/features/agents/orchestrator.ts`
**Depends on**: 1.8
**Parallel group**: B

Add protocol guidance for when Jethro operates as a sub-orchestrator in a worktree.

**Implementation details**:

- Add new `<sub_orchestrator_protocol>` section to prompt
- Include guidance on:
  - Scope boundaries (stay within branch domain)
  - Completion reporting (structured summary, not merge)
  - Depth limits (don't create nested worktrees in MVP)
- Use `Prompt.when` to conditionally include based on context

**Done when**:

- [ ] Sub-orchestrator protocol section added to prompt
- [ ] Includes scope boundary guidance
- [ ] Includes completion reporting format
- [ ] Includes depth limit warning
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing protocol sections in orchestrator.ts
- Reference spec lines 231-250 for context format
- Constraint: Protocol should be conditional (only when in worktree)

---

### Phase 1E: Hooks and Cleanup (Sequential after 1C, 1D)

#### 1.10 Create Worktree Cleanup Hooks

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/hooks.ts`
**Depends on**: 1.4, 1.5, 1.3

Implement hooks for automatic worktree cleanup when sessions end.

**Implementation details**:

- Listen for `session.status` events where `status === 'idle'`
- Check if session has associated worktrees via registry
- For each worktree with `auto_cleanup: true`:
  - Check if worktree has uncommitted changes
  - If no changes, remove worktree
  - If changes exist, log warning but preserve worktree
- Use `defineHookSet` pattern

**Done when**:

- [ ] File exists at `src/features/tools/worktree/hooks.ts`
- [ ] Hook listens for session idle events
- [ ] Queries registry for session's worktrees
- [ ] Removes worktrees with `auto_cleanup: true` and no uncommitted changes
- [ ] Preserves worktrees with uncommitted changes (logs warning)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `src/features/tools/tasks/hooks.ts`
- Use `PluginContext.use()` for client access
- Constraint: Never force-remove worktrees with uncommitted changes

---

#### 1.11 Add Orphan Worktree Pruning on Init

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/hooks.ts`
**Depends on**: 1.10

Add initialization logic to prune orphaned worktrees from previous sessions.

**Implementation details**:

- On plugin initialization (or first hook setup), run `git worktree prune`
- Scan `.git/workspaces/` for directories
- For each directory, check if it's a valid worktree
- Remove orphaned directories that don't have active sessions
- Log cleanup actions

**Done when**:

- [ ] Prune logic runs on hook setup
- [ ] Runs `git worktree prune` to clean git metadata
- [ ] Scans `.git/workspaces/` for orphaned directories
- [ ] Removes orphaned worktrees safely
- [ ] Logs cleanup actions for observability
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Initialization in hook setup function
- Constraint: Only prune worktrees in `.git/workspaces/` with Elisha naming pattern

---

### Phase 1F: Registration and Integration (Sequential - Final)

#### 1.12 Register Worktree ToolSet and Hooks

**Agent**: Baruch (executor)
**Files**: `src/features/tools/worktree/index.ts`, `src/features/tools/index.ts`, `src/features/hooks/index.ts`
**Depends on**: 1.4, 1.5, 1.10, 1.11

Create the toolset and register all new components with the plugin.

**Implementation details**:

- Create `worktreeToolSet` using `defineToolSet` pattern
- Export from `src/features/tools/worktree/index.ts`
- Add to `elishaToolSets` array in `src/features/tools/index.ts`
- Add `worktreeHooks` to `elishaHooks` array in `src/features/hooks/index.ts`
- Create barrel export in `src/features/tools/worktree/index.ts`

**Done when**:

- [ ] `worktreeToolSet` defined with both tools
- [ ] `worktreeToolSet` exported from `src/features/tools/worktree/index.ts`
- [ ] `worktreeToolSet` added to `elishaToolSets` in `src/features/tools/index.ts`
- [ ] `worktreeHooks` added to `elishaHooks` in `src/features/hooks/index.ts`
- [ ] All exports properly barrel-exported
- [ ] TypeScript compiles without errors
- [ ] `bun run build` succeeds

**Handoff context**:

- Pattern to follow: `src/features/tools/tasks/index.ts` for toolset
- Pattern to follow: `src/features/hooks/index.ts` for hook registration
- Constraint: Follow existing registration patterns exactly

---

## Phase 2: Integration

> **Milestone**: Full branch lifecycle with status, merge, and reporting; review gate with Elihu
> **Tasks**: 8 | **Estimated Effort**: Medium
> **Depends on**: Phase 1 complete

### Phase 2A: Status and Reporting Tools (Parallel)

#### 2.1 Implement `git_worktree_status` Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: Phase 1 complete
**Parallel group**: C

Implement the worktree status tool as specified in the spec (lines 315-358).

**Implementation details**:

- Tool ID: `git_worktree_status`
- Args: `worktree_id` (required), `include_diff` (default: false)
- Look up worktree in registry
- Execute: `git status --porcelain` in worktree directory
- Execute: `git rev-list --count {base_branch}..HEAD` for commits ahead
- Execute: `git rev-list --count HEAD..{base_branch}` for commits behind
- Optionally include diff summary via `git diff --stat`
- Return `WorktreeStatusResult`

**Done when**:

- [ ] Tool defined with `defineTool` pattern
- [ ] Returns `commits_ahead` and `commits_behind` counts
- [ ] Returns `files_changed` (uncommitted) and `files_staged` counts
- [ ] `include_diff=true` returns diff summary
- [ ] Handles worktree not found gracefully
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing worktree tools in `src/features/tools/worktree/index.ts`
- Reference spec lines 315-358 for return schema
- Constraint: Diff summary should be truncated if too large

---

#### 2.2 Implement `git_branch_report` Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: Phase 1 complete
**Parallel group**: C

Implement the branch report tool for sub-orchestrators to report completion status (spec lines 549-572).

**Implementation details**:

- Tool ID: `git_branch_report`
- Args: `status` (completed|blocked|failed), `summary`, `files_changed[]`, `merge_recommendation`, `blockers[]?`
- Validate files_changed entries have path, change_type, description
- Store report in registry associated with worktree
- Send structured message to parent session via `client.session.promptAsync`
- Return confirmation

**Done when**:

- [ ] Tool defined with `defineTool` pattern
- [ ] Validates all required fields
- [ ] Stores report in worktree registry
- [ ] Sends structured report to parent session
- [ ] Report includes all fields from spec (summary, files_changed, merge_recommendation)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `elisha_task_send_message` for parent communication
- Reference spec lines 1009-1024 for `BranchReport` type
- Constraint: Summary limited to 2000 characters

---

#### 2.3 Add `WorktreeStatusResult` and `BranchReport` Types

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/types.ts`
**Depends on**: Phase 1 complete
**Parallel group**: C

Extend types file with status and report types.

**Implementation details**:

- Add `WorktreeStatusResult` discriminated union (spec lines 340-358)
- Add `BranchReport` type (spec lines 1009-1024)
- Add `WorktreeMergeResult` discriminated union (spec lines 398-418)
- Export all new types

**Done when**:

- [ ] `WorktreeStatusResult` with `status: 'active' | 'not_found'`
- [ ] `WorktreeStatusResult` includes commits_ahead, commits_behind, files_changed, files_staged, diff_summary?
- [ ] `BranchReport` type matches spec exactly
- [ ] `WorktreeMergeResult` with `status: 'merged' | 'conflict' | 'failed'`
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing types in `src/features/tools/worktree/types.ts`
- Reference spec Appendix C for exact type definitions

---

### Phase 2B: Merge Tool (Sequential after 2A)

#### 2.4 Implement `git_worktree_merge` Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: 2.1, 2.3

Implement the worktree merge tool as specified in the spec (lines 362-418).

**Implementation details**:

- Tool ID: `git_worktree_merge`
- Args: `worktree_id`, `strategy` (merge|squash|rebase), `commit_message?`, `delete_branch` (default: true)
- Validate worktree has no uncommitted changes
- Switch to base branch in main directory
- Execute merge based on strategy:
  - `merge`: `git merge --no-ff {branch}`
  - `squash`: `git merge --squash {branch}` + `git commit -m "{message}"`
  - `rebase`: `git rebase {branch}`
- Handle conflicts by returning conflict info
- Optionally delete branch after successful merge
- Return `WorktreeMergeResult`

**Done when**:

- [ ] Tool defined with `defineTool` pattern
- [ ] Supports all three merge strategies
- [ ] Validates no uncommitted changes before merge
- [ ] Returns `conflicting_files` array on conflict
- [ ] `delete_branch=true` removes branch after successful merge
- [ ] Updates worktree state to 'merged' in registry
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing worktree tools
- Reference spec lines 362-418 for behavior
- Constraint: Never use `--force` in merge operations
- Constraint: Squash strategy requires commit_message

---

#### 2.5 Add Git Merge Utilities

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/git.ts`
**Depends on**: 2.3

Add utility functions for merge operations.

**Implementation details**:

- `hasUncommittedChanges(cwd: string)`: Check for uncommitted changes
- `getMergeConflicts(cwd: string)`: Parse conflicting files after failed merge
- `abortMerge(cwd: string)`: Run `git merge --abort`
- `getCommitsBetween(base: string, head: string, cwd: string)`: List commits for squash message

**Done when**:

- [ ] All functions use result pattern `{ data, error }`
- [ ] `hasUncommittedChanges` correctly detects staged and unstaged changes
- [ ] `getMergeConflicts` parses `git status` for conflict markers
- [ ] `abortMerge` safely aborts in-progress merge
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing utilities in `src/features/tools/worktree/git.ts`
- Constraint: All git operations must be safe (no force flags)

---

### Phase 2C: Review Gate Integration (Sequential after 2B)

#### 2.6 Add Review Gate Protocol to Jethro

**Agent**: Baruch (executor)
**File**: `src/features/agents/orchestrator.ts`
**Depends on**: 2.4

Add protocol for triggering Elihu review when `merge_recommendation: 'needs_review'`.

**Implementation details**:

- Add `<review_gate_protocol>` section to orchestrator prompt
- Include guidance on:
  - When to trigger review (needs_review recommendation)
  - How to delegate to Elihu with branch context
  - How to handle review results (approve, request_changes, reject)
- Reference spec lines 646-678 for workflow

**Done when**:

- [ ] Review gate protocol section added to prompt
- [ ] Includes delegation format for Elihu
- [ ] Includes handling for all review outcomes
- [ ] Protocol is conditional (only for root orchestrator)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing protocol sections in orchestrator.ts
- Reference spec lines 646-678 for review workflow
- Constraint: Only root orchestrator should trigger reviews

---

#### 2.7 Add Branch Review Context to Elihu

**Agent**: Baruch (executor)
**File**: `src/features/agents/reviewer.ts`
**Depends on**: 2.6

Enhance Elihu's prompt to handle branch review requests.

**Implementation details**:

- Add `<branch_review_protocol>` section
- Include guidance on:
  - Reviewing changes in worktree context
  - Using `git_worktree_status` to understand changes
  - Providing structured review response (approve, request_changes, reject)
- Add worktree tools to Elihu's permissions

**Done when**:

- [ ] Branch review protocol section added to prompt
- [ ] Elihu can access `git_worktree_status` tool
- [ ] Review response format documented in prompt
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing protocol sections in reviewer.ts
- Constraint: Elihu should not have merge permissions

---

#### 2.8 Register Phase 2 Tools in ToolSet

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: 2.1, 2.2, 2.4

Add new tools to the worktree toolset.

**Implementation details**:

- Add `git_worktree_status` to toolset
- Add `git_worktree_merge` to toolset
- Add `git_branch_report` to toolset
- Update toolset exports

**Done when**:

- [ ] All three new tools in `worktreeToolSet`
- [ ] Tools appear in agent tool list
- [ ] TypeScript compiles without errors
- [ ] `bun run build` succeeds

**Handoff context**:

- Pattern to follow: Existing toolset registration in `src/features/tools/worktree/index.ts`

---

## Phase 3: Observability

> **Milestone**: Hierarchical task tracking, progress reporting, state persistence
> **Tasks**: 6 | **Estimated Effort**: Medium
> **Depends on**: Phase 2 complete

### Phase 3A: Hierarchical Task IDs (Sequential)

#### 3.1 Implement Hierarchical Task ID Generation

**Agent**: Baruch (executor)
**File**: `src/features/tools/tasks/index.ts`
**Depends on**: Phase 2 complete

Modify task ID generation to include worktree context for trace correlation.

**Implementation details**:

- Detect if task is spawned in a worktree
- Generate hierarchical ID format: `{parent_id}:wt:{suffix}:{task_id}` for worktree tasks
- Store parent task ID in task metadata
- Enable trace correlation across worktree boundaries

**Done when**:

- [ ] Worktree tasks have hierarchical IDs
- [ ] Parent task ID stored in metadata
- [ ] ID format matches spec (lines 738-748)
- [ ] Non-worktree tasks unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing task ID generation in `taskCreateTool`
- Reference spec lines 738-748 for ID format
- Constraint: Must be backward compatible

---

#### 3.2 Add Task Hierarchy Tracking to Registry

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/registry.ts`
**Depends on**: 3.1

Extend registry to track task hierarchy within worktrees.

**Implementation details**:

- Add `tasks: string[]` field to `WorktreeInfo`
- Add `registerTask(worktreeId: string, taskId: string)` method
- Add `getTaskHierarchy(worktreeId: string)` method
- Track parent-child relationships

**Done when**:

- [ ] `WorktreeInfo` includes task list
- [ ] Tasks registered when spawned in worktree
- [ ] Hierarchy queryable via registry
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing registry methods
- Constraint: In-memory only (persistence in 3.4)

---

### Phase 3B: Progress Reporting (Parallel after 3A)

#### 3.3 Implement Progress Report Generation

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/progress.ts`
**Depends on**: 3.1, 3.2
**Parallel group**: D

Create utility to generate progress reports in the format specified in spec (lines 752-788).

**Implementation details**:

- Create `generateProgressReport(rootTaskId: string)` function
- Query all worktrees associated with root task
- For each worktree, get status and task progress
- Format as markdown table per spec
- Include health indicators (green, yellow, red)

**Done when**:

- [ ] File exists at `src/features/tools/worktree/progress.ts`
- [ ] Generates markdown progress report
- [ ] Includes worktree branch table
- [ ] Includes per-branch task details
- [ ] Includes integration queue
- [ ] TypeScript compiles without errors

**Handoff context**:

- Reference spec lines 752-788 for exact format
- Pattern to follow: Result pattern for errors

---

#### 3.4 Add Progress Report Tool

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/index.ts`
**Depends on**: 3.3
**Parallel group**: D

Expose progress report generation as a tool.

**Implementation details**:

- Tool ID: `git_worktree_progress`
- Args: `root_task_id?` (default: current session's root)
- Call `generateProgressReport`
- Return formatted markdown

**Done when**:

- [ ] Tool defined with `defineTool` pattern
- [ ] Returns markdown progress report
- [ ] Handles no worktrees gracefully
- [ ] Added to `worktreeToolSet`
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing worktree tools

---

### Phase 3C: State Persistence (Sequential after 3B)

#### 3.5 Implement Worktree State Persistence

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/persistence.ts`
**Depends on**: 3.2

Add file-based persistence for worktree state to survive restarts.

**Implementation details**:

- Create `WorktreePersistence` class
- Store state in `.git/workspaces/.elisha-state.json`
- Methods: `save()`, `load()`, `clear()`
- Auto-save on registry changes
- Load on plugin initialization

**Done when**:

- [ ] File exists at `src/features/tools/worktree/persistence.ts`
- [ ] State persisted to `.git/workspaces/.elisha-state.json`
- [ ] State loaded on initialization
- [ ] Handles corrupted state file gracefully
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Result pattern for file operations
- Constraint: State file must be in `.git/` to be ignored by git

---

#### 3.6 Integrate Persistence with Registry

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/registry.ts`
**Depends on**: 3.5

Connect persistence layer to registry.

**Implementation details**:

- Import `WorktreePersistence`
- Call `persistence.save()` after registry mutations
- Call `persistence.load()` in registry constructor
- Handle persistence failures gracefully (log, continue)

**Done when**:

- [ ] Registry auto-saves on changes
- [ ] Registry loads persisted state on init
- [ ] Persistence failures don't crash plugin
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing registry implementation
- Constraint: Persistence is best-effort, not critical path

---

## Phase 4: Hardening

> **Milestone**: Production-ready with comprehensive error handling, configuration, and performance
> **Tasks**: 6 | **Estimated Effort**: Medium
> **Depends on**: Phase 3 complete

### Phase 4A: Error Handling (Parallel)

#### 4.1 Implement Comprehensive Error Recovery

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/errors.ts`
**Depends on**: Phase 3 complete
**Parallel group**: E

Create centralized error handling for worktree operations per spec (lines 680-732).

**Implementation details**:

- Create error type hierarchy: `WorktreeError`, `MergeError`, `CleanupError`
- Implement recovery strategies per error matrix (spec lines 684-693)
- Add `handleSubOrchestratorFailure` function (spec lines 696-731)
- Preserve work when possible, clean up when safe

**Done when**:

- [ ] File exists at `src/features/tools/worktree/errors.ts`
- [ ] Error types cover all failure modes
- [ ] Recovery strategies match spec error matrix
- [ ] `handleSubOrchestratorFailure` preserves commits when present
- [ ] TypeScript compiles without errors

**Handoff context**:

- Reference spec lines 680-732 for error handling
- Pattern to follow: Result pattern for all operations
- Constraint: Never lose committed work

---

#### 4.2 Add Retry Logic to Git Operations

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/git.ts`
**Depends on**: 4.1
**Parallel group**: E

Add retry logic for transient git failures.

**Implementation details**:

- Create `withRetry<T>(fn: () => Promise<T>, options)` wrapper
- Retry on: lock file errors, network errors
- Don't retry on: validation errors, conflict errors
- Configurable max retries and backoff

**Done when**:

- [ ] `withRetry` wrapper implemented
- [ ] Transient errors retried with backoff
- [ ] Non-transient errors fail immediately
- [ ] Retry count configurable
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing git utilities
- Constraint: Max 3 retries by default

---

### Phase 4B: Cleanup Automation (Sequential after 4A)

#### 4.3 Enhance Orphan Cleanup Automation

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/hooks.ts`
**Depends on**: 4.1

Improve orphan cleanup with better detection and safer removal.

**Implementation details**:

- Add age-based cleanup (worktrees older than configurable threshold)
- Add session validation (check if session still exists)
- Add dry-run mode for testing
- Add cleanup report generation
- Integrate with error recovery

**Done when**:

- [ ] Age-based cleanup implemented
- [ ] Session validation before cleanup
- [ ] Dry-run mode available
- [ ] Cleanup generates report
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing cleanup hooks
- Constraint: Never remove worktrees with uncommitted changes without explicit force

---

### Phase 4C: Configuration (Sequential after 4B)

#### 4.4 Implement Configuration Options

**Agent**: Baruch (executor)
**File**: `src/features/tools/worktree/config.ts`
**Depends on**: 4.3

Add configurable options per spec Appendix B (lines 963-979).

**Implementation details**:

- Create `WorktreeConfig` type
- Options: `enabled`, `max_concurrent`, `auto_cleanup`, `branch_prefix`, `default_merge_strategy`
- Read from `opencode.json` via `ConfigContext`
- Provide sensible defaults
- Validate configuration on load

**Done when**:

- [ ] File exists at `src/features/tools/worktree/config.ts`
- [ ] All config options from spec implemented
- [ ] Defaults match spec recommendations
- [ ] Config validation with helpful errors
- [ ] TypeScript compiles without errors

**Handoff context**:

- Reference spec Appendix B (lines 963-979) for schema
- Pattern to follow: `ConfigContext.use()` for access
- Constraint: All options must have sensible defaults

---

#### 4.5 Integrate Configuration Throughout

**Agent**: Baruch (executor)
**Files**: `src/features/tools/worktree/index.ts`, `src/features/tools/worktree/hooks.ts`
**Depends on**: 4.4

Apply configuration to all worktree operations.

**Implementation details**:

- Check `enabled` before tool execution
- Enforce `max_concurrent` limit in `git_worktree_create`
- Apply `branch_prefix` to new branches
- Use `default_merge_strategy` in `git_worktree_merge`
- Apply `auto_cleanup` setting to new worktrees

**Done when**:

- [ ] `enabled: false` disables all worktree tools
- [ ] `max_concurrent` enforced with helpful error
- [ ] `branch_prefix` applied to new branches
- [ ] `default_merge_strategy` used when not specified
- [ ] `auto_cleanup` respected in hooks
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Check config at start of each tool execute
- Constraint: Config changes should not affect existing worktrees

---

### Phase 4D: Performance (Sequential - Final)

#### 4.6 Performance Optimization

**Agent**: Baruch (executor)
**Files**: `src/features/tools/worktree/git.ts`, `src/features/tools/worktree/registry.ts`
**Depends on**: 4.5

Optimize for large-scale usage.

**Implementation details**:

- Cache git command results where safe (branch list, commit SHAs)
- Batch registry operations
- Add lazy loading for worktree status
- Profile and optimize hot paths
- Add performance logging for diagnostics

**Done when**:

- [ ] Git command results cached appropriately
- [ ] Registry operations batched
- [ ] Lazy loading for expensive operations
- [ ] Performance logging available
- [ ] No regressions in functionality
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: Existing caching patterns in codebase
- Constraint: Cache invalidation must be correct
- Constraint: Performance logging should be opt-in

---

## Testing

### Phase 1 Testing

- [ ] Create a worktree: `git_worktree_create({ branch_name: "feature/test" })`
- [ ] Verify worktree exists at `.git/workspaces/test/`
- [ ] Verify branch `feature/test` was created
- [ ] Spawn task in worktree: `elisha_task_create({ ..., workdir: "<worktree_path>" })`
- [ ] Verify task operates in worktree directory
- [ ] Remove worktree: `git_worktree_remove({ worktree_id: "<id>" })`
- [ ] Verify worktree and branch cleaned up
- [ ] Test error cases: invalid branch name, existing branch, non-existent worktree

### Phase 2 Testing

- [ ] Get worktree status: `git_worktree_status({ worktree_id: "<id>" })`
- [ ] Verify commits_ahead/behind counts
- [ ] Create branch report: `git_branch_report({ status: "completed", ... })`
- [ ] Verify report sent to parent session
- [ ] Merge worktree: `git_worktree_merge({ worktree_id: "<id>", strategy: "squash" })`
- [ ] Verify merge completed and branch deleted
- [ ] Test merge conflict handling
- [ ] Test Elihu review integration

### Phase 3 Testing

- [ ] Verify hierarchical task IDs generated
- [ ] Generate progress report: `git_worktree_progress()`
- [ ] Verify markdown format matches spec
- [ ] Restart plugin and verify state persisted
- [ ] Verify task hierarchy restored

### Phase 4 Testing

- [ ] Test error recovery for various failure modes
- [ ] Test retry logic with simulated transient failures
- [ ] Test orphan cleanup with age threshold
- [ ] Test all configuration options
- [ ] Test max_concurrent limit enforcement
- [ ] Profile performance with multiple worktrees

### Integration Testing

- [ ] Jethro can spawn sub-orchestrator Jethro in worktree
- [ ] Sub-orchestrator can delegate to specialists (Baruch, Caleb, etc.)
- [ ] Specialists operate within worktree directory
- [ ] Session end triggers worktree cleanup
- [ ] Orphaned worktrees pruned on restart
- [ ] Full workflow: create -> work -> report -> review -> merge

## Verification Checklist

### Phase 1

- [ ] All 12 Phase 1 tasks completed
- [ ] TypeScript compiles without errors (`bun run typecheck`)
- [ ] Linting passes (`bun run check`)
- [ ] Build succeeds (`bun run build`)
- [ ] No regressions in existing task tools
- [ ] Worktree tools appear in agent tool list
- [ ] Hooks registered and firing on events

### Phase 2

- [ ] All 8 Phase 2 tasks completed
- [ ] Status, merge, and report tools functional
- [ ] Review gate integration working
- [ ] All merge strategies tested

### Phase 3

- [ ] All 6 Phase 3 tasks completed
- [ ] Hierarchical task IDs generated correctly
- [ ] Progress reports match spec format
- [ ] State persists across restarts

### Phase 4

- [ ] All 6 Phase 4 tasks completed
- [ ] Error recovery handles all failure modes
- [ ] Configuration options all functional
- [ ] Performance acceptable with 5+ concurrent worktrees

## Rollback Considerations

### Phase 1 Rollback

1. **Revert Jethro mode change**: Change `mode: 'all'` back to `mode: 'primary'` in `orchestrator.ts`
2. **Remove tool registration**: Remove `worktreeToolSet` from `elishaToolSets` array
3. **Remove hook registration**: Remove `worktreeHooks` from `elishaHooks` array
4. **Revert task_create changes**: Remove `workdir` parameter and branch context injection
5. **Clean up worktrees manually**: Run `git worktree list` and `git worktree remove` for any remaining worktrees

### Phase 2 Rollback

1. Remove Phase 2 tools from toolset
2. Revert Elihu and Jethro prompt changes
3. Phase 1 functionality remains intact

### Phase 3 Rollback

1. Remove persistence file
2. Revert hierarchical ID changes
3. Remove progress report tool
4. Phase 1-2 functionality remains intact

### Phase 4 Rollback

1. Remove configuration file
2. Revert to default settings
3. Remove performance optimizations
4. Phase 1-3 functionality remains intact

## Checkpoint

**Session**: 2026-01-27T18:00:00Z
**Completed**: Full plan creation (all 4 phases)
**In Progress**: None
**Notes**: Ready for Phase 1A execution. Start with task 1.1 (types) as foundation. Each phase builds on the previous - do not start Phase N+1 until Phase N is complete and verified.
**Blockers**: None
