---
name: elisha-delegation
description: Use when orchestrating multi-agent workflows, delegating tasks to specialized agents, or coordinating parallel work across the Elisha agent swarm.
---

# Task Delegation

## Overview

Effective delegation requires structured handoffs, active monitoring, and timely intervention. The orchestrator owns the full task lifecycle—from initial handoff through completion—and must steer or resurrect tasks when they drift off-track.

## When to Use

**Triggering conditions:**

- Task requires specialized expertise (research, exploration, implementation)
- Work can be parallelized across independent subtasks
- Complex workflow needs coordination across multiple agents
- Need to monitor long-running async operations

**Don't use for:**

- Simple, single-step tasks the current agent can complete directly
- Tasks requiring tight, synchronous coordination (do sequentially instead)
- When the overhead of delegation exceeds the task complexity

## Quick Reference

| Scenario            | Agent                    | Key Consideration              |
| ------------------- | ------------------------ | ------------------------------ |
| Find files/patterns | `Caleb (explorer)`       | Read-only, returns paths       |
| External research   | `Berean (researcher)`    | Web search, documentation      |
| Implement code      | `Baruch (executor)`      | Needs clear plan/spec          |
| Design system       | `Bezalel (architect)`    | Design only, no implementation |
| Review code         | `Elihu (reviewer)`       | Reports issues, doesn't fix    |
| Write docs          | `Luke (documenter)`      | Matches existing style         |
| Debug blocker       | `Ahithopel (consultant)` | Advisory only                  |
| Multi-domain work   | `Jethro (orchestrator)`  | Coordinates sub-agents         |

## Handoff Format

Every delegation must include these five elements:

```
OBJECTIVE: [What to accomplish - 1 sentence]
CONTEXT: [Background, file paths, patterns observed]
CONSTRAINTS: [Must follow X, avoid Y, use pattern Z]
SUCCESS: [Specific, verifiable criteria]
DEPENDENCIES: [Prior tasks, files that must exist]
```

See [references/task-handoff.md](references/task-handoff.md) for full lifecycle details.

## Parallel vs Sequential

| Condition                              | Approach    |
| -------------------------------------- | ----------- |
| Tasks have no data dependencies        | Parallelize |
| Tasks modify different files           | Parallelize |
| Tasks are read-only (search, research) | Parallelize |
| Task B needs output from Task A        | Sequential  |
| Tasks modify the same file             | Sequential  |
| Order matters for correctness          | Sequential  |

See [references/parallel-execution.md](references/parallel-execution.md) for coordination patterns.

## Monitoring & Intervention

| Observed State                | Response                                           |
| ----------------------------- | -------------------------------------------------- |
| Task running too long         | Fetch partial output via `task_output(wait=false)` |
| Output going off-track        | Steer via `task_send_message`                      |
| Task completed but incomplete | Resurrect with specific gaps                       |
| Task failed                   | Assess cause, retry or escalate                    |

See [references/progress-tracking.md](references/progress-tracking.md) for health indicators.

## Complete Example

**Scenario**: Orchestrator needs to add a new feature requiring research, implementation, and documentation.

```
# Phase 1: Parallel Research & Exploration

## Task 1: Research (async)
elisha_task_create({
  title: "Research React Server Components patterns",
  agent: "Berean (researcher)",
  prompt: `
    OBJECTIVE: Find best practices for React Server Components data fetching.
    CONTEXT: Building a dashboard with mixed server/client components.
    CONSTRAINTS: Focus on Next.js 14+ patterns, ignore older approaches.
    SUCCESS: Summary of 3-5 patterns with pros/cons and code examples.
    DEPENDENCIES: None.
  `,
  async: true
})

## Task 2: Exploration (async)
elisha_task_create({
  title: "Find existing data fetching patterns",
  agent: "Caleb (explorer)",
  prompt: `
    OBJECTIVE: Locate all data fetching implementations in the codebase.
    CONTEXT: Need to understand current patterns before adding new feature.
    CONSTRAINTS: Focus on src/app and src/components directories.
    SUCCESS: List of files with data fetching, grouped by pattern used.
    DEPENDENCIES: None.
  `,
  async: true
})

# Phase 2: Wait and Synthesize

## Check progress after 30 seconds
elisha_task_output({ task_id: "task-1", wait: false })
elisha_task_output({ task_id: "task-2", wait: false })

## If Task 1 is off-track, steer it
elisha_task_send_message({
  task_id: "task-1",
  message: "Focus only on server-side patterns, skip client-side fetching."
})

## Wait for completion
elisha_task_output({ task_id: "task-1", wait: true })
elisha_task_output({ task_id: "task-2", wait: true })

# Phase 3: Implementation (sequential - depends on research)

elisha_task_create({
  title: "Implement dashboard data fetching",
  agent: "Baruch (executor)",
  prompt: `
    OBJECTIVE: Implement server component data fetching for dashboard.
    CONTEXT:
    - Research found: [synthesized patterns from Task 1]
    - Existing patterns: [findings from Task 2]
    CONSTRAINTS:
    - Follow pattern X from research (best fit for our use case)
    - Match existing code style in src/app/dashboard
    SUCCESS:
    - [ ] Data fetching implemented in src/app/dashboard/page.tsx
    - [ ] Loading states handled
    - [ ] Error boundaries in place
    - [ ] TypeScript types defined
    DEPENDENCIES: Research and exploration complete.
  `,
  async: false
})

# Phase 4: Documentation (can run after implementation)

elisha_task_create({
  title: "Document data fetching patterns",
  agent: "Luke (documenter)",
  prompt: `
    OBJECTIVE: Document the new data fetching approach.
    CONTEXT: Just implemented RSC data fetching in dashboard.
    CONSTRAINTS: Match existing docs style in docs/patterns/.
    SUCCESS: New doc at docs/patterns/data-fetching.md with examples.
    DEPENDENCIES: Implementation complete.
  `,
  async: false
})
```

**Key patterns demonstrated:**

1. **Parallel first**: Research and exploration have no dependencies
2. **Monitor async**: Check progress, steer if needed
3. **Synthesize before next phase**: Combine outputs for implementation context
4. **Sequential when dependent**: Implementation needs research results
5. **Clear handoffs**: Every task has all five elements

## Common Mistakes

| Mistake                                   | Fix                                               |
| ----------------------------------------- | ------------------------------------------------- |
| Vague objective ("improve the code")      | Specific goal ("Add error handling to fetchUser") |
| Missing success criteria                  | Include verifiable checklist items                |
| Not monitoring async tasks                | Check `task_output(wait=false)` periodically      |
| Starting new task instead of resurrecting | Use `task_send_message` to continue with context  |
| Parallelizing dependent tasks             | Map dependencies first, sequence when needed      |
| Delegating without context                | Always include CONTEXT and CONSTRAINTS            |
| Ignoring task health indicators           | Intervene at yellow, don't wait for red           |

## Validation Checklist

- [ ] Handoff includes all five elements (OBJECTIVE, CONTEXT, CONSTRAINTS, SUCCESS, DEPENDENCIES)
- [ ] Correct agent selected for task type
- [ ] Dependencies mapped before parallelizing
- [ ] Async tasks monitored for progress
- [ ] Off-track tasks steered or resurrected
- [ ] Results synthesized before dependent phases
