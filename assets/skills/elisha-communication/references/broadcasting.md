# Broadcasting Guidelines

Detailed guidelines for broadcasting discoveries and coordinating between agents in the swarm.

## Communication Tools

| Tool                          | Purpose                         | Direction                 |
| ----------------------------- | ------------------------------- | ------------------------- |
| `elisha_task_broadcast`       | Share discoveries broadly       | To siblings or children   |
| `elisha_task_broadcasts_read` | Read shared discoveries         | From siblings or children |
| `elisha_task_send_message`    | Direct message to specific task | To any task by ID         |

## Orchestrator Communication

As an orchestrator delegating tasks:

### Broadcast to Children

Share context with all delegated tasks:

```typescript
elisha_task_broadcast({
  message: 'All tasks: The API base URL changed to /api/v2/. Update your assumptions.',
  category: 'context',
  target: 'children',
});
```

### Read Child Discoveries

See what delegated tasks have found:

```typescript
elisha_task_broadcasts_read({
  source: 'children',
  category: 'all',
  limit: 10,
});
```

## Sibling Communication

As a subagent working alongside other tasks:

### When to Broadcast

| Category      | When to Use                               | Example                                            |
| ------------- | ----------------------------------------- | -------------------------------------------------- |
| **discovery** | Found important file, pattern, or config  | "Config pattern: Use ConfigContext.use()"          |
| **warning**   | Encountered gotcha or anti-pattern        | "Don't import from /internal, use re-exports"      |
| **context**   | Background that helps understand codebase | "Auth uses JWT with 1hr expiry"                    |
| **blocker**   | Stuck and need sibling awareness          | "API endpoint returning 500, may affect your task" |

### Broadcast Guidelines

**Do broadcast:**

- Specific file paths and function names
- Patterns that affect multiple areas
- Gotchas that wasted your time
- Configuration discoveries

**Don't broadcast:**

- Obvious things ("found package.json")
- Your task progress (that's for parent)
- Requests for help (use escalation instead)
- Speculative information

### Broadcast Format

Keep broadcasts concise (2-5 lines) and actionable:

```typescript
elisha_task_broadcast({
  message: 'Config pattern: Use ConfigContext.use() not direct import. File: src/context.ts',
  category: 'discovery',
  target: 'siblings',
});
```

### Reading Sibling Broadcasts

Sync context at the start of complex tasks:

```typescript
// Check what siblings have discovered
elisha_task_broadcasts_read({
  source: 'self', // reads broadcasts sent to you
  category: 'all',
  limit: 10,
});
```

**Why read broadcasts:**

- Avoid redundant searches
- Learn from sibling discoveries
- Catch warnings about gotchas
- Stay aware of blockers

## Direct Sibling Messages

For directed communication to a specific sibling:

```typescript
elisha_task_send_message({
  task_id: 'sibling-task-id', // from <sibling_tasks> context
  message: 'I found the auth middleware you were looking for: src/middleware/auth.ts',
});
```

**Use direct messages when:**

- Information is only relevant to one sibling
- Responding to a sibling's blocker
- Coordinating on shared resource

## Broadcast Categories Reference

| Category    | Purpose                | Example Message                               |
| ----------- | ---------------------- | --------------------------------------------- |
| `discovery` | Found something useful | "API client is in src/lib/api.ts, uses axios" |
| `warning`   | Gotcha to avoid        | "Tests fail if DB not seeded first"           |
| `context`   | Background info        | "Project uses pnpm, not npm"                  |
| `blocker`   | Stuck, FYI to siblings | "Auth service down, can't test login flow"    |

## Communication Anti-Patterns

| Anti-Pattern                         | Problem                | Better Approach                   |
| ------------------------------------ | ---------------------- | --------------------------------- |
| Broadcasting progress updates        | Noise, not actionable  | Report to parent only             |
| Vague broadcasts ("found something") | Not useful             | Include specifics                 |
| Requesting help via broadcast        | Wrong channel          | Use escalation protocol           |
| Broadcasting before verifying        | Spreads misinformation | Confirm before sharing            |
| Over-broadcasting                    | Signal lost in noise   | Only share high-value discoveries |
