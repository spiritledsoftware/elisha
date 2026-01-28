---
name: elisha-communication
description: Use when sharing discoveries with sibling tasks, broadcasting context to children, or coordinating between parallel agents in a swarm.
---

# Agent Communication

## Overview

Agents in a swarm coordinate through broadcasts and direct messages. Siblings share discoveries to avoid redundant work; orchestrators broadcast context to children. Effective communication keeps parallel tasks aligned without micromanagement.

## When to Use

**Triggering conditions:**

- Found important pattern, file, or configuration that affects siblings
- Encountered a gotcha or anti-pattern others should avoid
- Need to sync context at the start of a complex task
- Orchestrator needs to share context with all delegated tasks

**Don't use for:**

- Reporting task progress (that's for parent/orchestrator)
- Requesting help (use escalation instead)
- Obvious discoveries ("found package.json")

## Quick Reference

| Action                        | Tool                                            | Use Case                          |
| ----------------------------- | ----------------------------------------------- | --------------------------------- |
| Share discovery with siblings | `elisha_task_broadcast`                         | Found pattern, gotcha, or context |
| Read sibling discoveries      | `elisha_task_broadcasts_read`                   | Sync context at task start        |
| Direct message to task        | `elisha_task_send_message`                      | Specific info for one sibling     |
| Broadcast to children         | `elisha_task_broadcast({ target: 'children' })` | Orchestrator sharing context      |

## Broadcast Categories

| Category    | When to Use                               | Example                                            |
| ----------- | ----------------------------------------- | -------------------------------------------------- |
| `discovery` | Found important file, pattern, or config  | "Config pattern: Use ConfigContext.use()"          |
| `warning`   | Encountered gotcha or anti-pattern        | "Don't import from /internal, use re-exports"      |
| `context`   | Background that helps understand codebase | "Auth uses JWT with 1hr expiry"                    |
| `blocker`   | Stuck and need sibling awareness          | "API endpoint returning 500, may affect your task" |

See [references/broadcasting.md](references/broadcasting.md) for detailed guidelines.

## Communication Flow Example

```
Orchestrator creates 3 parallel tasks:
├── Task A: Research (Berean)
├── Task B: Explore (Caleb)
└── Task C: Implement (Baruch)

Task B discovers important pattern:
  → Broadcasts to siblings: "All services use dependency injection via constructor"

Task A reads broadcast:
  → Adjusts research to focus on DI patterns

Task C reads broadcast:
  → Implements using DI pattern from start

Orchestrator reads child broadcasts:
  → Sees the DI discovery
  → Broadcasts to all children: "Good find. Use the ServiceContainer in src/di/"

Result: All tasks aligned without orchestrator micromanaging
```

## Common Mistakes

| Mistake                              | Fix                                     |
| ------------------------------------ | --------------------------------------- |
| Broadcasting progress updates        | Report to parent only, not siblings     |
| Vague broadcasts ("found something") | Include specific file paths and details |
| Requesting help via broadcast        | Use escalation protocol instead         |
| Broadcasting before verifying        | Confirm information before sharing      |
| Over-broadcasting                    | Only share high-value discoveries       |
| Not reading sibling broadcasts       | Check at start of complex tasks         |

## Validation Checklist

- [ ] Broadcast is concise (2-5 lines) and actionable
- [ ] Includes specific file paths or function names
- [ ] Correct category selected for the content
- [ ] Not broadcasting obvious or speculative info
- [ ] Read sibling broadcasts at task start (if complex task)
