# Parallel Execution Protocol

Guidelines for concurrent task execution and coordination.

## When to Parallelize

Execute independent tasks concurrently when:

| Condition                | Example                                         |
| ------------------------ | ----------------------------------------------- |
| No data dependencies     | Research task A doesn't need output from task B |
| Different files modified | Task A edits `src/api/`, task B edits `src/ui/` |
| Read-only operations     | Multiple search or exploration tasks            |
| Independent domains      | Frontend and backend work on separate features  |

## When NOT to Parallelize

Execute sequentially when:

| Condition                    | Example                               |
| ---------------------------- | ------------------------------------- |
| Task B needs Task A's output | Implementation needs research results |
| Same file modified           | Both tasks edit `src/config.ts`       |
| Order matters                | Database migration before seeding     |
| Shared state                 | Tasks that read/write same resource   |

## Coordination Pattern

```
1. Identify independent task groups
   └── Map dependencies between tasks
   └── Group tasks with no cross-dependencies

2. Launch parallel tasks in single batch
   └── Use async: true for all parallel tasks
   └── Capture task IDs for monitoring

3. Monitor all tasks
   └── Check progress periodically
   └── Steer any that drift off-track

4. Wait for all to complete
   └── Use task_output(wait=true) for each
   └── Collect all results

5. Synthesize results before next phase
   └── Combine outputs coherently
   └── Resolve any conflicts
   └── Use synthesis as context for dependent tasks
```

## Dependency Mapping

Before parallelizing, map task dependencies:

```
Task A: Research patterns (no deps)
Task B: Explore codebase (no deps)
Task C: Implement feature (depends on A, B)
Task D: Write tests (depends on C)
Task E: Update docs (depends on C)

Execution plan:
  Phase 1 (parallel): A, B
  Phase 2 (sequential): C
  Phase 3 (parallel): D, E
```

## Batch Launch Example

```typescript
// Phase 1: Launch independent tasks in parallel
const task1 = elisha_task_create({
  title: 'Research API patterns',
  agent: 'Berean (researcher)',
  prompt: '...',
  async: true,
});

const task2 = elisha_task_create({
  title: 'Find existing implementations',
  agent: 'Caleb (explorer)',
  prompt: '...',
  async: true,
});

// Monitor both
await Promise.all([
  elisha_task_output({ task_id: task1.id, wait: true }),
  elisha_task_output({ task_id: task2.id, wait: true }),
]);

// Phase 2: Sequential task using combined results
const task3 = elisha_task_create({
  title: 'Implement feature',
  agent: 'Baruch (executor)',
  prompt: `
    CONTEXT:
    - Research found: ${task1.output}
    - Existing patterns: ${task2.output}
    ...
  `,
  async: false,
});
```

## Result Synthesis

When combining outputs from multiple agents:

### Synthesis Process

1. **Collect all outputs** - Gather results from each delegated task
2. **Identify conflicts** - Note any contradictions or overlaps
3. **Resolve conflicts** - Use domain expert or ask user if unclear
4. **Merge coherently** - Combine into unified context for next phase
5. **Attribute sources** - Note which agent contributed what

### Synthesis Format

```markdown
## Combined Results

### From [Agent 1]: [Task Title]

[Key findings/outputs]

### From [Agent 2]: [Task Title]

[Key findings/outputs]

### Synthesis

[Unified conclusion/context for next phase]

### Conflicts (if any)

[What disagreed and how resolved]
```

## Common Parallelization Mistakes

| Mistake                       | Consequence                         | Fix                              |
| ----------------------------- | ----------------------------------- | -------------------------------- |
| Parallelizing dependent tasks | Race conditions, incomplete context | Map dependencies first           |
| Not monitoring parallel tasks | Wasted effort on wrong direction    | Check progress periodically      |
| Skipping synthesis            | Next phase lacks full context       | Always combine before proceeding |
| Too many parallel tasks       | Overwhelms coordination             | Limit to 3-5 concurrent tasks    |
