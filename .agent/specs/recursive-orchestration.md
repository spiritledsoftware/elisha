# Spec: Recursive Orchestration with Git Worktree Isolation

**Version**: 1.0
**Last Updated**: 2026-01-27T15:00:00Z
**Last Agent**: Bezalel (architect)
**Status**: Draft
**Scope**: system

## Overview

This specification defines a recursive orchestration architecture for the Elisha agent swarm, enabling orchestrators to spawn sub-orchestrators that operate in isolated git worktrees. This addresses cognitive scaling limits, file conflict prevention, and natural git-based integration workflows.

### Goals

1. **Cognitive Scaling** - Bound each orchestrator's scope to prevent context window saturation
2. **True Isolation** - Eliminate file conflicts during parallel execution via git worktrees
3. **Deferred Integration** - Resolve conflicts at merge time using standard git tooling
4. **Recursive Capability** - Sub-orchestrators have full orchestration capabilities
5. **Observable Progress** - Root orchestrator can monitor branch progress hierarchically

### Non-Goals

- Multi-repository orchestration (out of scope)
- Persistent worktrees across sessions (cleanup on completion)
- Custom merge strategies beyond git defaults

## Architecture

```
                                    +---------------------------------------------+
                                    |           Root Orchestrator                 |
                                    |         (Jethro @ main branch)              |
                                    |                                             |
                                    |  - Decomposes into workstreams              |
                                    |  - Spawns sub-orchestrators                 |
                                    |  - Monitors branch progress                 |
                                    |  - Integrates completed branches            |
                                    +----------------------+----------------------+
                                                           |
                    +--------------------------------------+--------------------------------------+
                    |                                      |                                      |
                    v                                      v                                      v
    +-------------------------------+  +-------------------------------+  +-------------------------------+
    |    Sub-Orchestrator A         |  |    Sub-Orchestrator B         |  |    Sub-Orchestrator C         |
    |  (Jethro @ feature/ui)        |  |  (Jethro @ feature/api)       |  |  (Jethro @ feature/infra)     |
    |                               |  |                               |  |                               |
    |  workdir: .git/workspaces/ui  |  |  workdir: .git/workspaces/api |  |  workdir: .git/workspaces/infra|
    +---------------+---------------+  +---------------+---------------+  +---------------+---------------+
                    |                                  |                                  |
          +---------+---------+              +---------+---------+              +---------+---------+
          v                   v              v                   v              v                   v
    +-----------+       +-----------+  +-----------+       +-----------+  +-----------+       +-----------+
    |  Baruch   |       |  Oholiab  |  |  Baruch   |       |  Caleb    |  |  Baruch   |       |  Ezra     |
    | (executor)|       | (designer)|  | (executor)|       | (explorer)|  | (executor)|       | (planner) |
    +-----------+       +-----------+  +-----------+       +-----------+  +-----------+       +-----------+
```

### Directory Layout

```
elisha/
├── .git/
│   ├── worktrees/           ← Git's metadata (auto-managed)
│   │   ├── ui/              ← HEAD, index, gitdir for ui worktree
│   │   ├── api/
│   │   └── infra/
│   └── workspaces/          ← Working directories (our convention)
│       ├── ui/              ← feature/ui branch workspace
│       ├── api/             ← feature/api branch workspace
│       └── infra/           ← feature/infra branch workspace
├── src/
└── ...
```

> **Note**: We use `.git/workspaces/` instead of `.git/worktrees/` for working directories because:
>
> - Git uses `.git/worktrees/{name}/` for metadata files (HEAD, index, gitdir)
> - Placing working directories there causes metadata files to appear as untracked
> - `.git/workspaces/` keeps working directories clean and separate from Git's internal metadata

## Requirements

### Functional Requirements

| ID   | Requirement                                                     | Priority |
| ---- | --------------------------------------------------------------- | -------- |
| FR-1 | Orchestrators can spawn sub-orchestrators in isolated worktrees | Must     |
| FR-2 | Sub-orchestrators inherit full orchestration capabilities       | Must     |
| FR-3 | Worktrees are automatically cleaned up on completion            | Must     |
| FR-4 | Root orchestrator can monitor sub-orchestrator progress         | Must     |
| FR-5 | Branches can be merged back to parent branch                    | Must     |
| FR-6 | Merge conflicts trigger review workflow                         | Should   |
| FR-7 | Broadcasts propagate within worktree scope only                 | Must     |
| FR-8 | Hierarchical task IDs enable trace correlation                  | Should   |

### Non-Functional Requirements

| ID    | Requirement                                         | Priority |
| ----- | --------------------------------------------------- | -------- |
| NFR-1 | Worktree creation < 5 seconds                       | Should   |
| NFR-2 | No data loss on sub-orchestrator failure            | Must     |
| NFR-3 | Safe git operations only (no force push)            | Must     |
| NFR-4 | Works with existing Claude Code plugin architecture | Must     |

## Options Considered

### Option A: Worktree-per-Orchestrator (Recommended)

**Approach**: Each sub-orchestrator gets a dedicated git worktree with its own branch. The worktree path becomes the `directory` parameter for all child sessions.

**Implementation**:

1. New tool: `git_worktree_create` - Creates worktree and branch
2. New tool: `git_worktree_status` - Gets worktree state and diff summary
3. New tool: `git_worktree_merge` - Merges branch back to parent
4. New tool: `git_worktree_remove` - Cleans up worktree
5. Modify `elisha_task_create` - Add optional `workdir` parameter
6. Modify Jethro agent - Change mode from `primary` to `all`

**Pros**:

- True file isolation - no conflicts during execution
- Natural git workflow - branches, reviews, rollbacks
- Recursive by design - sub-orchestrators can spawn their own worktrees
- Deferred conflict resolution - conflicts handled at merge time
- Observable - `git diff` shows exactly what changed per branch

**Cons**:

- Disk space overhead (full working copy per worktree)
- Complexity in worktree lifecycle management
- Potential for orphaned worktrees on crashes
- Merge conflicts still require resolution

**Confidence**: High - Git worktrees are a mature, well-tested feature designed for this exact use case.

---

### Option B: Directory-Scoped Tasks (No Worktrees)

**Approach**: Sub-orchestrators work in the same directory but are constrained to specific file paths via permissions. No git isolation.

**Implementation**:

1. Modify `elisha_task_create` - Add `scope` parameter (file patterns)
2. Modify agent permissions - Dynamic path-based restrictions
3. Add conflict detection - Warn when tasks touch same files

**Pros**:

- Simpler implementation - no git operations
- No disk overhead
- Faster task startup

**Cons**:

- No true isolation - file conflicts still possible
- Requires complex permission management
- No natural rollback mechanism
- Conflicts detected at runtime, not deferred

**Confidence**: Medium - Works for simple cases but doesn't solve the core isolation problem.

---

### Option C: Stash-Based Isolation

**Approach**: Each sub-orchestrator stashes its changes, works on a clean slate, then applies stash on completion.

**Implementation**:

1. Auto-stash before sub-orchestrator starts
2. Work on clean working tree
3. Commit changes
4. Pop stash and resolve conflicts

**Pros**:

- No additional disk space
- Simpler than worktrees

**Cons**:

- Serial execution only - can't parallelize
- Stash conflicts are harder to resolve than merge conflicts
- No branch history for review
- Doesn't scale to recursive orchestration

**Confidence**: Low - Fundamentally incompatible with parallel execution.

## Recommendation

**Option A: Worktree-per-Orchestrator** because:

1. **True isolation** - Git worktrees provide complete file-level isolation without complex permission management
2. **Natural workflow** - Branches, PRs, and reviews are familiar patterns for code integration
3. **Recursive capability** - Sub-orchestrators can spawn their own worktrees without special handling
4. **Observable state** - `git diff`, `git log`, and `git status` provide rich introspection
5. **Mature tooling** - Git worktrees are battle-tested and well-documented

**Confidence**: High

## Detailed Design

### 1. Agent Configuration Changes

#### Jethro Mode Change

```typescript
// src/features/agents/orchestrator.ts
export const orchestratorAgent = defineAgent({
  id: 'Jethro (orchestrator)',
  config: () => {
    const config = ConfigContext.use();
    return {
      hidden: false,
      mode: 'all', // Changed from 'primary' to allow sub-orchestration
      model: config.model,
      // ... rest unchanged
    };
  },
  // ...
});
```

#### Sub-Orchestrator Context Injection

When a Jethro instance is spawned as a sub-orchestrator, inject context about its branch scope:

```xml
<branch_context>
  You are operating as a **sub-orchestrator** on branch `feature/ui`.

  **Scope**: All work must stay within this branch's domain.
  **Workdir**: /Users/user/code/elisha-ui
  **Parent Branch**: main
  **Parent Orchestrator**: Task ID abc123

  **Constraints**:
  - Do NOT merge to parent branch - report completion instead
  - Do NOT create additional worktrees (max depth reached)
  - Broadcast discoveries to parent via structured reports

  **Completion Protocol**:
  When all tasks complete, provide a structured summary:
  - Files changed (with brief descriptions)
  - Tests added/modified
  - Breaking changes (if any)
  - Recommended merge strategy
</branch_context>
```

### 2. Worktree Tool Specifications

#### `git_worktree_create`

Creates a new git worktree with an associated branch.

```typescript
const worktreeCreateTool = defineTool({
  id: 'git_worktree_create',
  config: {
    description: 'Create a git worktree for isolated branch work.',
    args: {
      branch_name: z
        .string()
        .regex(/^[a-z0-9][a-z0-9\-\/]*[a-z0-9]$/)
        .describe('Branch name (e.g., "feature/ui-redesign")'),
      base_branch: z
        .string()
        .default('HEAD')
        .describe('Branch to base the new branch on (default: current HEAD)'),
      path_suffix: z
        .string()
        .optional()
        .describe('Custom suffix for worktree path (default: derived from branch name)'),
    },
    execute: async (args, toolCtx) => {
      // Implementation details in section 3
    },
  },
});
```

**Behavior**:

1. Validate branch name doesn't exist
2. Compute worktree path: `.git/workspaces/{branch_suffix}`
3. Execute: `git worktree add .git/workspaces/{suffix} -b {branch_name} {base_branch}`
4. Return worktree metadata

**Return Schema**:

```typescript
type WorktreeCreateResult =
  | {
      status: 'created';
      worktree_id: string; // Unique ID for tracking
      path: string; // Absolute path to worktree
      branch: string; // Branch name
      base_branch: string; // What it branched from
      base_commit: string; // SHA of base commit
    }
  | {
      status: 'failed';
      error: string;
      code: 'BRANCH_EXISTS' | 'PATH_EXISTS' | 'GIT_ERROR' | 'PERMISSION_DENIED';
    };
```

---

#### `git_worktree_status`

Gets the current state of a worktree including uncommitted changes.

```typescript
const worktreeStatusTool = defineTool({
  id: 'git_worktree_status',
  config: {
    description: 'Get status of a worktree including changes and commits.',
    args: {
      worktree_id: z.string().describe('Worktree ID from git_worktree_create'),
      include_diff: z.boolean().default(false).describe('Include diff summary (can be large)'),
    },
    execute: async (args, toolCtx) => {
      // Implementation details in section 3
    },
  },
});
```

**Return Schema**:

```typescript
type WorktreeStatusResult =
  | {
      status: 'active';
      worktree_id: string;
      path: string;
      branch: string;
      commits_ahead: number; // Commits ahead of base
      commits_behind: number; // Commits behind base (if base moved)
      files_changed: number; // Uncommitted changes
      files_staged: number; // Staged but uncommitted
      diff_summary?: string; // If include_diff=true
    }
  | {
      status: 'not_found';
      worktree_id: string;
      error: string;
    };
```

---

#### `git_worktree_merge`

Merges a worktree's branch back to its parent branch.

```typescript
const worktreeMergeTool = defineTool({
  id: 'git_worktree_merge',
  config: {
    description: 'Merge a worktree branch back to parent branch.',
    args: {
      worktree_id: z.string().describe('Worktree ID to merge'),
      strategy: z
        .enum(['merge', 'squash', 'rebase'])
        .default('merge')
        .describe(
          'Merge strategy: merge (preserve history), squash (single commit), rebase (linear history)',
        ),
      commit_message: z.string().optional().describe('Custom commit message (required for squash)'),
      delete_branch: z.boolean().default(true).describe('Delete the branch after successful merge'),
    },
    execute: async (args, toolCtx) => {
      // Implementation details in section 3
    },
  },
});
```

**Return Schema**:

```typescript
type WorktreeMergeResult =
  | {
      status: 'merged';
      worktree_id: string;
      merge_commit: string; // SHA of merge commit
      strategy_used: string;
      branch_deleted: boolean;
    }
  | {
      status: 'conflict';
      worktree_id: string;
      conflicting_files: string[];
      resolution_hint: string;
    }
  | {
      status: 'failed';
      worktree_id: string;
      error: string;
      code: 'UNCOMMITTED_CHANGES' | 'BRANCH_DIVERGED' | 'GIT_ERROR';
    };
```

---

#### `git_worktree_remove`

Removes a worktree and optionally its branch.

```typescript
const worktreeRemoveTool = defineTool({
  id: 'git_worktree_remove',
  config: {
    description: 'Remove a worktree and clean up resources.',
    args: {
      worktree_id: z.string().describe('Worktree ID to remove'),
      force: z.boolean().default(false).describe('Force removal even with uncommitted changes'),
      delete_branch: z.boolean().default(false).describe('Also delete the associated branch'),
    },
    execute: async (args, toolCtx) => {
      // Implementation details in section 3
    },
  },
});
```

**Return Schema**:

```typescript
type WorktreeRemoveResult =
  | {
      status: 'removed';
      worktree_id: string;
      branch_deleted: boolean;
      had_uncommitted_changes: boolean;
    }
  | {
      status: 'failed';
      worktree_id: string;
      error: string;
      code: 'UNCOMMITTED_CHANGES' | 'NOT_FOUND' | 'GIT_ERROR';
    };
```

### 3. Task Spawning with Workdir

#### Modified `elisha_task_create`

Add optional `workdir` parameter to spawn tasks in a specific directory:

```typescript
// In src/features/tools/tasks/index.ts

export const taskCreateTool = defineTool({
  id: `${TASK_TOOLSET_ID}_create`,
  config: {
    description: 'Run a task using a specified agent.',
    args: {
      title: z.string(),
      agent: z.string(),
      prompt: z.string(),
      async: z.boolean().default(false),
      timeout_ms: z.number().optional(),
      // NEW: Optional workdir for worktree-based orchestration
      workdir: z
        .string()
        .optional()
        .describe(
          'Working directory for the task. If provided, task runs in this directory instead of current.',
        ),
    },
    execute: async (args, toolCtx) => {
      const { client, directory } = PluginContext.use();

      // Use provided workdir or fall back to current directory
      const taskDirectory = args.workdir ?? directory;

      // ... existing agent lookup logic ...

      const createSessionResult = await client.session.create({
        parentID: toolCtx.sessionID,
        title: args.async ? `${ASYNC_TASK_PREFIX} Task: ${args.title}` : `Task: ${args.title}`,
        directory: taskDirectory, // Use task-specific directory
      });

      // ... rest of implementation with taskDirectory ...
    },
  },
});
```

#### Workdir Inheritance

Child tasks automatically inherit their parent's workdir unless explicitly overridden:

```typescript
// When spawning a child task from a sub-orchestrator
const enrichedPrompt = Prompt.template`
  ${siblingContext}
  <inherited_context>
    Working directory: ${taskDirectory}
    Branch: ${await getCurrentBranch(taskDirectory)}
  </inherited_context>
  ${args.prompt}
`;
```

### 4. Cross-Branch Communication

#### Broadcast Scope

Broadcasts are scoped to the worktree they originate from:

| Broadcast Target | Behavior                                       |
| ---------------- | ---------------------------------------------- |
| `siblings`       | Only siblings in same worktree                 |
| `children`       | Only direct children (may be in sub-worktrees) |
| `all`            | Siblings + children in same worktree           |

#### Cross-Worktree Reporting

Sub-orchestrators report to parent via structured completion messages, not broadcasts:

```typescript
// New tool: git_branch_report
const branchReportTool = defineTool({
  id: 'git_branch_report',
  config: {
    description: 'Report branch completion status to parent orchestrator.',
    args: {
      status: z.enum(['completed', 'blocked', 'failed']),
      summary: z.string().max(2000).describe('Summary of work done'),
      files_changed: z.array(
        z.object({
          path: z.string(),
          change_type: z.enum(['added', 'modified', 'deleted']),
          description: z.string(),
        }),
      ),
      merge_recommendation: z.enum(['ready', 'needs_review', 'has_conflicts']),
      blockers: z.array(z.string()).optional(),
    },
    execute: async (args, toolCtx) => {
      // Send structured report to parent session
    },
  },
});
```

### 5. Integration Phase

#### Merge Workflow State Machine

```
                                    +-------------+
                                    |   PENDING   |
                                    |  (branch    |
                                    |   created)  |
                                    +------+------+
                                           |
                                           v
                                    +-------------+
                                    |   ACTIVE    |<----------------+
                                    |  (work in   |                 |
                                    |  progress)  |                 |
                                    +------+------+                 |
                                           |                        |
                              +------------+------------+           |
                              |            |            |           |
                              v            v            v           |
                       +-----------+ +-----------+ +-----------+    |
                       | COMPLETED | |  BLOCKED  | |  FAILED   |    |
                       |           | |           | |           |    |
                       +-----+-----+ +-----+-----+ +-----+-----+    |
                             |             |             |          |
                             |             |             |          |
                             v             |             |          |
                       +-----------+       |             |          |
                       |  REVIEW   |<------+             |          |
                       | (optional)|                     |          |
                       +-----+-----+                     |          |
                             |                          |          |
                    +--------+--------+                 |          |
                    |        |        |                 |          |
                    v        v        v                 |          |
             +----------+ +----------+ +----------+     |          |
             | APPROVED | | CHANGES  | | REJECTED |     |          |
             |          | | REQUESTED| |          |     |          |
             +----+-----+ +----+-----+ +----+-----+     |          |
                  |            |            |          |          |
                  |            +------------+----------+          |
                  |                         |                     |
                  v                         v                     |
           +-----------+             +-----------+                |
           |  MERGING  |             | ABANDONED |                |
           |           |             |           |                |
           +-----+-----+             +-----------+                |
                 |                                                |
        +--------+--------+                                       |
        |        |        |                                       |
        v        v        v                                       |
 +----------+ +----------+ +----------+                           |
 |  MERGED  | | CONFLICT | |  MERGE   |                           |
 |          | |          | |  FAILED  |                           |
 +----------+ +----+-----+ +----------+                           |
                   |                                              |
                   +----------------------------------------------+
                          (resolve and retry)
```

#### Merge Strategy Selection

| Scenario                  | Recommended Strategy | Rationale                  |
| ------------------------- | -------------------- | -------------------------- |
| Single logical change     | `squash`             | Clean history, easy revert |
| Multiple distinct commits | `merge --no-ff`      | Preserve commit history    |
| Linear history required   | `rebase`             | No merge commits           |
| Conflicts expected        | `merge`              | Easier conflict resolution |

#### Review Gate Integration

When `merge_recommendation: 'needs_review'`:

```typescript
// Root orchestrator workflow
const branchReport = await taskOutput({
  task_id: subOrchestratorId,
  wait: true,
});

if (branchReport.merge_recommendation === 'needs_review') {
  // Delegate review to Elihu
  const reviewResult = await taskCreate({
    agent: 'Elihu (reviewer)',
    title: `Review branch ${branchReport.branch}`,
    prompt: `
      OBJECTIVE: Review changes on branch ${branchReport.branch}
      CONTEXT: ${branchReport.summary}
      FILES: ${JSON.stringify(branchReport.files_changed)}
      
      Review for:
      - Code quality
      - Test coverage
      - Breaking changes
      - Security issues
      
      Provide: approve, request_changes, or reject
    `,
    workdir: worktreePath,
  });

  // Handle review result...
}
```

### 6. Error Handling

#### Error Matrix

| Error Condition              | Detection                | Recovery                    | Cleanup                  |
| ---------------------------- | ------------------------ | --------------------------- | ------------------------ |
| Sub-orchestrator timeout     | `task_output` timeout    | Cancel task, report partial | Remove worktree (force)  |
| Sub-orchestrator crash       | Session status check     | Report failure              | Remove worktree (force)  |
| Uncommitted changes on merge | `worktree_status` check  | Commit or stash             | None (preserve work)     |
| Merge conflict               | `worktree_merge` result  | Delegate to reviewer        | None (preserve branches) |
| Worktree creation fails      | `worktree_create` result | Retry with different path   | None                     |
| Branch already exists        | `worktree_create` result | Use existing or rename      | None                     |
| Orphaned worktree            | Periodic cleanup hook    | `git worktree prune`        | Auto-remove              |

#### Failure Recovery Protocol

```typescript
// In root orchestrator error handling
async function handleSubOrchestratorFailure(
  worktreeId: string,
  taskId: string,
  error: TaskResult & { status: 'failed' },
) {
  // 1. Get worktree status to assess damage
  const status = await worktreeStatus({ worktree_id: worktreeId });

  if (status.status === 'active' && status.commits_ahead > 0) {
    // Work was done - preserve it
    await branchReport({
      status: 'failed',
      summary: `Task failed after ${status.commits_ahead} commits. Error: ${error.error}`,
      files_changed: [], // Would need to compute
      merge_recommendation: 'needs_review',
      blockers: [error.error],
    });

    // Don't remove worktree - let user decide
    return {
      action: 'preserved',
      worktree_id: worktreeId,
      branch: status.branch,
      commits_preserved: status.commits_ahead,
    };
  }

  // No work done - clean up
  await worktreeRemove({ worktree_id: worktreeId, force: true });
  return {
    action: 'cleaned_up',
    worktree_id: worktreeId,
  };
}
```

### 7. Observability

#### Hierarchical Task IDs

Task IDs include worktree context for trace correlation:

```
root-abc123                          # Root orchestrator
+-- wt:ui-def456                     # Worktree task
|   +-- task-ghi789                  # Child task in worktree
|   +-- task-jkl012                  # Another child
+-- wt:api-mno345                    # Another worktree
|   +-- task-pqr678
+-- task-stu901                      # Direct child (no worktree)
```

#### Progress Reporting Format

```markdown
## Recursive Orchestration Progress

**Root Task**: Implement feature X
**Started**: 2026-01-27T10:00:00Z
**Status**: In Progress

### Worktree Branches

| Branch        | Orchestrator  | Status    | Progress  | Health   |
| ------------- | ------------- | --------- | --------- | -------- |
| feature/ui    | wt:ui-def456  | Active    | 3/5 tasks | [green]  |
| feature/api   | wt:api-mno345 | Active    | 1/3 tasks | [yellow] |
| feature/infra | wt:infra-xyz  | Completed | 4/4 tasks | [check]  |

### Branch Details

#### feature/ui ([green] Healthy)

- [check] Create component structure
- [check] Implement styling
- [progress] Add tests (in progress)
- [pending] Integration tests
- [pending] Documentation

#### feature/api ([yellow] Slow)

- [check] Define endpoints
- [progress] Implement handlers (running 15min)
- [pending] Add validation

### Integration Queue

1. feature/infra -> main (ready to merge)
2. feature/ui -> main (pending completion)
3. feature/api -> main (pending completion)
```

### 8. Worktree Lifecycle Hooks

#### Session Hooks

```typescript
// src/features/tools/worktree/hooks.ts

export const worktreeHooks = defineHookSet({
  id: 'worktree-hooks',
  hooks: () => ({
    event: async ({ event }) => {
      // Clean up worktrees when parent session ends
      if (event.type === 'session.status' && event.properties.status === 'idle') {
        const sessionWorktrees = await getSessionWorktrees(event.properties.sessionID);
        for (const wt of sessionWorktrees) {
          if (wt.autoCleanup) {
            await cleanupWorktree(wt.id);
          }
        }
      }
    },
  }),
});
```

#### Periodic Cleanup

```typescript
// Prune orphaned worktrees on plugin initialization
async function pruneOrphanedWorktrees() {
  const { directory } = PluginContext.use();

  // Get all worktrees
  const result = await exec('git worktree list --porcelain', {
    cwd: directory,
  });

  // Parse and check each worktree
  for (const worktree of parseWorktreeList(result)) {
    if (worktree.path.includes('-elisha-') && !(await hasActiveSession(worktree))) {
      await exec(`git worktree remove --force ${worktree.path}`, {
        cwd: directory,
      });
    }
  }
}
```

## Security Considerations

| Concern                 | Mitigation                                            |
| ----------------------- | ----------------------------------------------------- |
| Arbitrary path creation | Validate worktree paths are within `.git/workspaces/` |
| Branch name injection   | Strict regex validation on branch names               |
| Force push risk         | Never use `--force` in git push operations            |
| Credential exposure     | Worktrees inherit git credentials from main repo      |
| Resource exhaustion     | Limit concurrent worktrees per session (configurable) |
| Orphaned worktrees      | Automatic cleanup on session end + periodic prune     |

## Example Workflows

### Workflow 1: Multi-Domain Feature Implementation

```
User: "Implement user authentication with UI, API, and database changes"

Root Jethro:
1. Analyze request -> identifies 3 domains
2. Create worktrees:
   - feature/auth-ui -> .git/workspaces/auth-ui
   - feature/auth-api -> .git/workspaces/auth-api
   - feature/auth-db -> .git/workspaces/auth-db
3. Spawn sub-orchestrators (parallel):
   - Jethro@auth-ui: "Implement login/signup UI components"
   - Jethro@auth-api: "Implement auth endpoints and middleware"
   - Jethro@auth-db: "Create user schema and migrations"
4. Monitor progress via task_output
5. Collect branch reports
6. Integration phase:
   - Merge auth-db first (no dependencies)
   - Merge auth-api (depends on db)
   - Merge auth-ui (depends on api types)
7. Final review with Elihu
8. Report completion to user
```

### Workflow 2: Handling Merge Conflicts

```
Root Jethro:
1. Attempt merge: feature/auth-api -> main
2. Result: CONFLICT in src/types.ts
3. Delegate to Ahithopel:
   "Resolve merge conflict in src/types.ts between auth-api and main"
4. Ahithopel analyzes both versions, recommends resolution
5. Delegate to Baruch in auth-api worktree:
   "Apply conflict resolution: [specific changes]"
6. Retry merge -> SUCCESS
7. Continue with remaining branches
```

### Workflow 3: Sub-Orchestrator Failure Recovery

```
Root Jethro:
1. Sub-orchestrator Jethro@auth-api fails after 2 commits
2. Error: "Context window exceeded"
3. Recovery:
   a. Check worktree status -> 2 commits preserved
   b. Create branch report with partial progress
   c. Spawn new sub-orchestrator with narrower scope:
      "Continue auth-api implementation. Already done: [list commits]"
   d. New sub-orchestrator completes remaining work
4. Merge proceeds normally
```

## Open Questions / Future Considerations

### Open Questions

1. **Maximum worktree depth**: Should sub-orchestrators be allowed to create their own worktrees? Current recommendation: No (max depth = 1) to prevent resource exhaustion.

2. **Worktree naming conflicts**: What if two orchestrators try to create `feature/ui` simultaneously? Need atomic branch creation or namespace prefixing.

3. **Cross-worktree dependencies**: How to handle when work in worktree A depends on work in worktree B? Options: sequential execution, or merge B first.

4. **Worktree persistence**: Should worktrees survive session restarts? Current recommendation: No, clean up on session end.

### Future Considerations

1. **Worktree pooling**: Pre-create worktrees for faster startup
2. **Shallow worktrees**: Use `--depth` for large repos
3. **Remote worktrees**: Support for worktrees on remote machines
4. **Worktree templates**: Pre-configured worktrees for common patterns
5. **Integration with GitHub PRs**: Auto-create PRs from worktree branches

## Appendix

### A. Git Worktree Command Reference

```bash
# Create worktree with new branch
git worktree add .git/workspaces/ui -b feature/ui main

# List worktrees
git worktree list

# Remove worktree
git worktree remove .git/workspaces/ui

# Force remove (with uncommitted changes)
git worktree remove --force .git/workspaces/ui

# Prune stale worktree metadata
git worktree prune

# Lock worktree (prevent pruning)
git worktree lock .git/workspaces/ui --reason "Active orchestration"

# Unlock worktree
git worktree unlock .git/workspaces/ui
```

### B. Configuration Schema

```typescript
// In opencode.json or config
{
  "elisha": {
    "worktree": {
      "enabled": true,
      "max_concurrent": 5,
      "auto_cleanup": true,
      "workspaces_dir": ".git/workspaces",  // Fixed convention
      "branch_prefix": "elisha/",
      "default_merge_strategy": "merge"
    }
  }
}
```

> **Note**: The `workspaces_dir` is a fixed convention (`.git/workspaces`) rather than a configurable path prefix. This ensures consistent behavior and simplifies path validation.

### C. Type Definitions

```typescript
// src/features/tools/worktree/types.ts

export type WorktreeState =
  | 'pending'
  | 'active'
  | 'completed'
  | 'blocked'
  | 'failed'
  | 'merging'
  | 'merged'
  | 'abandoned';

export type WorktreeInfo = {
  id: string;
  path: string;
  branch: string;
  base_branch: string;
  base_commit: string;
  state: WorktreeState;
  created_at: string;
  session_id: string;
  parent_session_id?: string;
  auto_cleanup: boolean;
};

export type BranchReport = {
  worktree_id: string;
  status: 'completed' | 'blocked' | 'failed';
  summary: string;
  files_changed: Array<{
    path: string;
    change_type: 'added' | 'modified' | 'deleted';
    description: string;
  }>;
  commits: Array<{
    sha: string;
    message: string;
  }>;
  merge_recommendation: 'ready' | 'needs_review' | 'has_conflicts';
  blockers?: string[];
};
```

### D. Implementation Phases

#### Phase 1: Foundation (MVP)

- `git_worktree_create` tool
- `git_worktree_remove` tool
- `workdir` parameter on `elisha_task_create`
- Jethro mode change to `all`
- Basic cleanup hooks

#### Phase 2: Integration

- `git_worktree_status` tool
- `git_worktree_merge` tool
- `git_branch_report` tool
- Review gate integration with Elihu

#### Phase 3: Observability

- Hierarchical task ID tracking
- Progress reporting format
- Worktree state persistence

#### Phase 4: Hardening

- Comprehensive error handling
- Orphan cleanup automation
- Configuration options
- Performance optimization
