# Review: Task Tool Refactored (Sessions-Only)

**Version**: 1.1
**Last Updated**: 2026-01-20T16:00:00Z
**Last Agent**: executor
**Status**: Resolved
**Target**: `src/tools/task/index.ts`
**Scope**: standard

## Summary

**Files**: 1 file reviewed
**Issues**: 1 critical, 3 warnings, 2 nitpicks

The refactored task tool removes in-memory task tracking in favor of using the sessions primitive directly. This is a significant improvement that eliminates the memory leak from the previous implementation. However, the sessions-based approach introduces new edge cases around API resilience and has one critical gap in async task error handling.

## Architecture Assessment

### What's Better

1. **No memory leak** - Tasks are now tracked by the session system, not in-memory
2. **Simpler state model** - Session status is the source of truth
3. **Exponential backoff** - Polling now backs off properly (lines 64-86)
4. **Try-catch in `isTaskComplete`** - API errors handled gracefully (line 58-61)
5. **Race condition in cancel handled** - Re-checks completion after abort failure (lines 288-291)

### What's Missing or Risky

The sessions-only approach relies entirely on the session API being available and consistent. Several edge cases need attention.

## Issues

### Critical

| File            | Line    | Issue                                                                                                                                   | Confidence | Suggestion                                                           |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `task/index.ts` | 166-177 | **Fire-and-forget promise still exists**: Async task's prompt promise is never awaited or error-handled - errors are silently swallowed | Definite   | Add `.catch()` handler that logs or stores error in session metadata |

### Warnings

| File            | Line    | Issue                                                                                                                                                                        | Confidence | Suggestion                                                                      |
| --------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `task/index.ts` | 42-45   | **Session not in status map assumed complete**: If session is missing from status, it's assumed complete - but could be API error, rate limit, or session not yet registered | Likely     | Add secondary check via `session.messages()` or `session.children()` to confirm |
| `task/index.ts` | 244-257 | **Wait logic doesn't return result after waiting**: If `wait=true` and task completes, returns "still running" instead of the result                                         | Definite   | After successful wait, fetch and return the result                              |
| `task/index.ts` | 96-99   | **50-message limit may miss result**: Long agent conversations could exceed 50 messages, causing result retrieval to miss the final assistant response                       | Potential  | Iterate with pagination or use `limit: 1` with reverse order if API supports it |

### Nitpicks

| File            | Line | Issue                                                                                                                        | Confidence | Suggestion                                                         |
| --------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `task/index.ts` | 129  | **Schema field name mismatch**: Tool uses `title` but description says "description"                                         | Definite   | Align naming - use `title` consistently or rename to `description` |
| `task/index.ts` | 7    | **Unused constant naming**: `TOOL_TASK_ID` is `'elisha_task'` but tool is conceptually "task" - consider if prefix is needed | Potential  | Keep as-is if namespace collision is a concern, otherwise simplify |

## Detailed Analysis

### 1. Fire-and-Forget Promise (Critical)

```typescript
// Lines 166-177
const promise = ctx.client.session.prompt({
  path: { id: session.id },
  body: {
    agent: args.agent,
    parts: [{ type: 'text', text: args.prompt }],
  },
  query: { directory: ctx.directory },
});

if (args.async) {
  return `Task(${session.id}) started asynchronously.`;
  // promise is never awaited or error-handled!
}
```

**Impact**: If the async prompt fails (network error, invalid agent, etc.), the error is silently swallowed. The task appears "started" but the session will never have any messages, causing `getTaskResult` to return "No assistant response was found" with no indication of what went wrong.

**Recommendation**:

```typescript
if (args.async) {
  // Log errors for debugging - can't store in session metadata easily
  promise.catch((error) => {
    console.error(`Task(${session.id}) failed to start: ${error}`);
  });
  return `Task(${session.id}) started asynchronously.`;
}
```

Or consider adding a `session.metadata` API if available to store error state.

### 2. Session Not in Status Map (Warning)

```typescript
// Lines 42-45
// Session not found in status map - may have completed and been cleaned up
if (!sessionStatus) {
  return true;
}
```

**Risk scenarios**:

- API returned partial data due to rate limiting
- Session was just created and not yet registered in status
- Network error caused empty response (though caught by try-catch)

**Recommendation**: Add a secondary confirmation:

```typescript
if (!sessionStatus) {
  // Confirm by checking if session has messages
  const { data: messages } = await ctx.client.session.messages({
    path: { id },
    query: { limit: 1 },
  });
  // If session has messages and no status, likely completed
  // If no messages either, session may not exist or just started
  return messages && messages.length > 0;
}
```

### 3. Wait Logic Doesn't Return Result (Warning)

```typescript
// Lines 244-257
if (args.wait) {
  const waitResult = await waitForTaskCompletion(task.id, args.timeout, ctx);

  if (!waitResult) {
    return `Reached timeout. Task(${args.task_id}) is still running.`;
  }
}

return `Task(${args.task_id}) is still running.`; // BUG: Returns this even after successful wait!
```

**Impact**: User calls `task_output` with `wait=true`, task completes, but they get "still running" message instead of the result.

**Fix**:

```typescript
if (args.wait) {
  const waitResult = await waitForTaskCompletion(task.id, args.timeout, ctx);

  if (!waitResult) {
    return `Reached timeout. Task(${args.task_id}) is still running.`;
  }

  // Task completed after waiting - fetch and return result
  const sessionResult = await getTaskResult(task.id, ctx);
  if (!sessionResult.success) {
    return `Task(${args.task_id}) completed with error: ${sessionResult.error.toLowerCase()}`;
  }

  return dedent`
    Task(${args.task_id}) completed.
    
    Title: ${task.title}
    
    Result:
    ${sessionResult.result}
  `;
}

return `Task(${args.task_id}) is still running.`;
```

### 4. 50-Message Limit (Warning)

```typescript
// Lines 96-99
const { data: messages } = await ctx.client.session.messages({
  path: { id: id },
  query: { limit: 50 },
});
```

For complex tasks with many tool calls, 50 messages may not be enough. The code reverses and finds the last assistant message, but if there are 100+ messages, the actual last assistant message won't be in the first 50.

**Options**:

1. Increase limit (e.g., 200) with performance consideration
2. Use pagination to fetch from the end
3. Document the limitation

## Sessions-Based Approach Completeness

### What Works Well

| Aspect               | Status | Notes                                               |
| -------------------- | ------ | --------------------------------------------------- |
| Task creation        | ✅     | Uses `session.create` with `parentID` for hierarchy |
| Task execution       | ✅     | Uses `session.prompt` to trigger agent              |
| Completion detection | ⚠️     | Works but has edge case with missing status         |
| Result retrieval     | ⚠️     | Works but has 50-message limit                      |
| Task cancellation    | ✅     | Uses `session.abort` with race condition handling   |
| Task discovery       | ✅     | Uses `session.children` to find tasks by parent     |

### Missing Capabilities

1. **No task metadata storage** - Can't store custom state (error messages, progress) on the session
2. **No task listing** - No `task_list` tool to see all tasks for current session
3. **No task history** - Completed tasks are only discoverable via `session.children`

### Robustness Considerations

| Scenario                                | Current Behavior                   | Recommendation              |
| --------------------------------------- | ---------------------------------- | --------------------------- |
| API timeout during polling              | Returns `false`, continues polling | ✅ Good                     |
| Session deleted externally              | Assumed complete                   | ⚠️ Could add explicit check |
| Multiple concurrent `task_output` calls | Each polls independently           | ✅ Acceptable               |
| Parent session compacted                | Child sessions still accessible    | ✅ Good                     |

## Actionable Items

Tasks for executor to address (Critical and Warning issues):

- [x] `task/index.ts:166-177` - Add `.catch()` handler to async prompt promise to log errors
- [x] `task/index.ts:42-45` - Add secondary confirmation when session missing from status map
- [x] `task/index.ts:244-257` - Return result after successful wait instead of "still running"
- [x] `task/index.ts:96-99` - Increase message limit or add pagination for result retrieval

## Resolution Log

| Version | Agent    | Action                                                | Timestamp            |
| ------- | -------- | ----------------------------------------------------- | -------------------- |
| 1.0     | reviewer | Initial review of refactored implementation           | 2026-01-20T15:30:00Z |
| 1.1     | executor | Fixed all 4 actionable items (1 critical, 3 warnings) | 2026-01-20T16:00:00Z |
