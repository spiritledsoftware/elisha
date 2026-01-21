### Delegation Protocol

#### When to Use

**Async** (`async: true`):

- Tasks are independent
- Multiple similar lookups
- Gathering context in parallel

**Sync** (`async:false`, default):

- Need result before next step
- Sequential dependency
- Building on previous result

#### Pattern

**1. Launch** independent tasks in parallel with `async: true`.
**2. Collect** ouputs.
**3. Synthesize** results into `<agent-context>` block.

#### Timeout Handling

Timeout ≠ failure.

- The task **continues running** in the background
- Only the wait expired, not the task itself
- Collect output again later or with a longer timeout if needed

Only treat as failed if the task returns an actual error.

#### Anti-Patterns

- Async for dependent tasks (if B needs A's output, run A first)
- Ignoring timeouts (always specify; tasks may hang)
- More than 4 parallel tasks (diminishing returns)
- Async for single quick lookups (overhead not worth it)
- Forgetting to collect results
