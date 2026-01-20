# Async Delegation Protocol

How to use async delegation for parallel task execution.

## Decision Matrix

When to use async (`async: true`) vs sync (default) delegation:

| Criteria                      | Use Async | Use Sync |
| ----------------------------- | --------- | -------- |
| Tasks are independent         | ✓         |          |
| Need result before next step  |           | ✓        |
| Multiple similar lookups      | ✓         |          |
| Sequential dependency         |           | ✓        |
| Gathering context in parallel | ✓         |          |
| Building on previous result   |           | ✓        |

## Async Pattern

### 1. Launch

Start multiple independent tasks with `async: true`:

```
Task 1: "Find auth patterns. Thoroughness: quick." (async: true)
Task 2: "Research JWT best practices. Thoroughness: quick." (async: true)
```

Both tasks run in parallel. You receive task IDs immediately.

### 2. Collect

Gather results with `elisha_task_output` using appropriate timeouts:

```
elisha_task_output(task_id_1, wait: true, timeout: 30000)
elisha_task_output(task_id_2, wait: true, timeout: 45000)
```

### 3. Synthesize

Combine findings, handle partial results if some tasks timed out:

```markdown
<context>
<codebase>
[From explorer task]
</codebase>

<research>
[From researcher task]
</research>
</context>
```

## Timeout Guidelines

| Task Type              | Recommended Timeout | Rationale                    |
| ---------------------- | ------------------- | ---------------------------- |
| Explorer (quick)       | 30s                 | File search is fast          |
| Explorer (thorough)    | 60s                 | Deep search needs time       |
| Researcher (quick)     | 45s                 | Web calls have latency       |
| Researcher (thorough)  | 90s                 | Multiple sources to check    |
| Architect (component)  | 120s                | Design requires thought      |
| Architect (system)     | 180s                | Complex analysis             |

## Handling Partial Results

When some tasks timeout or fail:

1. **Proceed with available results** - Don't block on failed tasks
2. **Note which tasks failed** - Include in synthesis for transparency
3. **Escalate if critical** - If missing info blocks progress, escalate

Example handling:

```markdown
## Context Gathered

<codebase>
[From explorer - succeeded]
</codebase>

<research>
[Researcher timed out - proceeding without external research]
</research>

**Note**: Researcher task timed out. Proceeding with codebase context only.
If external best practices are critical, may need to retry or escalate.
```

## Examples

### Parallel Context Gathering

**Good** - Independent tasks in parallel:

```
1. Launch explorer (async: true) → task_id_1
2. Launch researcher (async: true) → task_id_2
3. Collect task_id_1 (timeout: 30s)
4. Collect task_id_2 (timeout: 45s)
5. Synthesize results
```

### Sequential with Dependencies

**Good** - Result feeds next task:

```
1. Launch explorer (async: false) → get codebase context
2. Launch architect with context (async: false) → get design
3. Launch planner with context + design (async: false) → get plan
```

### Multiple File Lookups

**Good** - Parallel exploration:

```
1. Launch explorer for "auth patterns" (async: true) → task_id_1
2. Launch explorer for "test patterns" (async: true) → task_id_2
3. Launch explorer for "config patterns" (async: true) → task_id_3
4. Collect all three with appropriate timeouts
5. Synthesize into comprehensive context
```

## Anti-Patterns

- ❌ **Don't launch async for dependent tasks** - If task B needs task A's output, run A first
- ❌ **Don't ignore timeouts** - Always specify timeout; tasks may hang
- ❌ **Don't launch more than 4 parallel tasks** - Diminishing returns, harder to synthesize
- ❌ **Don't use async for single quick lookups** - Overhead not worth it
- ❌ **Don't forget to collect** - Async tasks need explicit result collection
- ❌ **Don't block indefinitely** - Always use timeout parameter

## Agent-Specific Notes

### For Orchestrators

- Use async for initial context gathering (explorer + researcher)
- Collect and synthesize before delegating to downstream agents
- Pass synthesized context to avoid redundant delegation

### For Architects

- Use async to gather codebase patterns and external research in parallel
- Collect both before starting design analysis
- Note if research timed out - may affect confidence level

### For Executors

- Use async for multiple file lookups when implementing
- Example: Finding related test files, config files, and implementation files
- Keep async usage minimal - most executor work is sequential

### For Planners

- Use async to gather codebase structure and existing patterns
- Collect context before creating task breakdown
- Helps ensure accurate file paths in plan
