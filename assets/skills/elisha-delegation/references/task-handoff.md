# Task Handoff Protocol

The full task lifecycle from initial delegation through completion.

## 1. Initial Handoff

Provide structured context with five required elements:

| Element          | Purpose                         | Example                                        |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| **OBJECTIVE**    | What to accomplish (1 sentence) | "Add pagination to the users list"             |
| **CONTEXT**      | Background the agent needs      | File paths, patterns observed, prior decisions |
| **CONSTRAINTS**  | Boundaries and patterns         | "Must use existing Button component"           |
| **SUCCESS**      | Verifiable completion criteria  | Checklist of specific outcomes                 |
| **DEPENDENCIES** | Prerequisites                   | "Requires API endpoint from Task 1"            |

### Handoff Template

```markdown
## OBJECTIVE:

[Clear goal statement - what, not how]

## CONTEXT:

[Background info, file paths, patterns observed]

- Relevant files: [paths]
- Related work: [prior tasks or decisions]
- Current state: [what exists now]

## CONSTRAINTS:

[Boundaries, patterns to follow, things to avoid]

- Must: [required patterns]
- Avoid: [anti-patterns or out-of-scope items]

## SUCCESS:

[Specific, verifiable criteria]

- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]
- [ ] [Measurable outcome 3]

## DEPENDENCIES:

[Prior tasks, files that must exist]

- [Dependency 1]
- [Dependency 2]
```

## 2. Processing Received Handoffs

When receiving a task, extract and validate:

1. **OBJECTIVE** - Must be clear and specific
2. **CONTEXT** - Background info, file paths, patterns
3. **CONSTRAINTS** - Boundaries, things to avoid
4. **SUCCESS** - Criteria to verify completion
5. **DEPENDENCIES** - Prerequisites that must exist

**If any required information is missing**: Request clarification before starting.

## 3. Monitor Progress (Async Tasks)

For long-running tasks, check progress periodically:

```typescript
// Get partial results without blocking
elisha_task_output({ task_id: 'task-123', wait: false });
```

**Monitoring frequency:**

| Task Complexity            | Check Interval |
| -------------------------- | -------------- |
| Simple (< 2 min expected)  | Once at 1 min  |
| Medium (2-5 min expected)  | Every 1-2 min  |
| Complex (> 5 min expected) | Every 2-3 min  |

**Why monitor:**

- Early detection prevents wasted effort
- Allows steering before task completes incorrectly
- Provides visibility into swarm execution state

## 4. Steer if Off-Track

Use `elisha_task_send_message` to redirect running tasks:

```typescript
elisha_task_send_message({
  task_id: 'task-123',
  message: 'Stop researching client-side patterns. Focus only on server components.',
});
```

**Steering examples:**

| Situation          | Steering Message                     |
| ------------------ | ------------------------------------ |
| Wrong focus        | "Stop X, focus on Y instead"         |
| Missing constraint | "Add constraint: must also handle Z" |
| Too broad          | "Narrow scope to only files in /src" |
| Wrong approach     | "Use pattern X instead of Y"         |

## 5. Refine via Resurrection

Completed tasks can be continued with follow-up messages:

```typescript
// Task completed but needs refinement
elisha_task_send_message({
  task_id: 'task-123',
  message: 'Good start. Please also add error handling for the edge case where user is null.',
});
```

**Resurrection patterns:**

| Pattern       | Use Case          | Example Message                             |
| ------------- | ----------------- | ------------------------------------------- |
| **Critique**  | Output has issues | "Issues found: [list]. Please fix."         |
| **Elaborate** | Need more detail  | "Expand section X with examples"            |
| **Iterate**   | Add related work  | "Good, now also add Y"                      |
| **Correct**   | Factual errors    | "The API endpoint is /v2/users, not /users" |

**Key insight**: Resurrection preserves context—more efficient than starting new tasks.

## When to Intervene

| Situation                  | Action                                           |
| -------------------------- | ------------------------------------------------ |
| Task going wrong direction | Steer immediately via `elisha_task_send_message` |
| Output incomplete          | Resurrect with specific gaps to fill             |
| Output has errors          | Resurrect with specific fixes needed             |
| Need related follow-up     | Resurrect same task (preserves context)          |
| Task stuck/blocked         | Assess cause, provide missing info or escalate   |

## Verification Before Completion

Before marking any delegated task complete:

1. **Check acceptance criteria** - Every SUCCESS item must be satisfied
2. **Verify no regressions** - Changes don't break existing functionality
3. **Confirm patterns match** - Code follows codebase conventions
4. **Test if applicable** - Run relevant tests, check they pass

**If verification fails**: Resurrect with specific failure details, do NOT mark complete.
