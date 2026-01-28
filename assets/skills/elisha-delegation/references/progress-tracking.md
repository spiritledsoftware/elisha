# Progress Tracking Protocol

Maintaining visibility into swarm execution state and guiding intervention.

## Track State

For multi-step workflows, maintain awareness of:

- **Completed tasks** - With outcomes and key outputs
- **In-progress tasks** - Current agent and elapsed time
- **Pending tasks** - With dependencies blocking them
- **Blockers** - Issues preventing progress

## Progress Table Format

```markdown
## Workflow Progress

**Started**: 2024-01-15T10:30:00Z
**Status**: In Progress | Blocked | Complete

| Task              | Agent  | Status | Health | Notes               |
| ----------------- | ------ | ------ | ------ | ------------------- |
| Research patterns | Berean | ✅     | 🟢     | Found 5 patterns    |
| Explore codebase  | Caleb  | 🔄     | 🟡     | Running 3 min       |
| Implement feature | Baruch | ⏳     | -      | Waiting on research |
| Write tests       | Elihu  | ⏳     | -      | Waiting on impl     |
```

### Status Icons

| Icon | Meaning                           |
| ---- | --------------------------------- |
| ✅   | Completed successfully            |
| 🔄   | In progress                       |
| ⏳   | Pending (waiting on dependencies) |
| ❌   | Failed                            |
| ⏸️   | Paused/blocked                    |

## Health Indicators

| Health    | Meaning                         | Action                          |
| --------- | ------------------------------- | ------------------------------- |
| 🟢 Green  | On track, progressing normally  | Continue monitoring             |
| 🟡 Yellow | Slow progress or partial output | Check output, consider steering |
| 🔴 Red    | Stuck, off-track, or failed     | Intervene immediately           |

### Health Assessment Criteria

**🟢 Green (Healthy):**

- Task running within expected time
- Partial output (if available) looks correct
- No error indicators

**🟡 Yellow (Needs Attention):**

- Task running 50%+ longer than expected
- Partial output shows minor drift
- Agent asking clarifying questions

**🔴 Red (Intervention Required):**

- Task running 2x+ expected time
- Partial output completely off-track
- Error messages or failures
- Agent stuck in loop

## Respond to State

When tracking reveals issues:

| Observed State                | Response                                             |
| ----------------------------- | ---------------------------------------------------- |
| Task running too long         | Fetch partial output, assess health                  |
| Partial output off-track      | Send steering message via `elisha_task_send_message` |
| Task completed but incomplete | Resurrect with specific gaps to fill                 |
| Task failed                   | Assess cause, retry with fixes or escalate           |
| Multiple tasks blocked        | Re-evaluate dependencies, parallelize differently    |
| Agent asking questions        | Provide clarification via `elisha_task_send_message` |

## Update Frequency

| Trigger                | Action                                     |
| ---------------------- | ------------------------------------------ |
| Task completes         | Update status, record outcome              |
| Task fails             | Update status, record error, plan response |
| Periodic check (async) | Assess health, update if changed           |
| Blocker detected       | Update immediately, plan intervention      |
| Phase transition       | Summarize completed phase, plan next       |

## Retry Strategy

When an operation fails:

| Failure Type | First Action                     | If Still Fails                         |
| ------------ | -------------------------------- | -------------------------------------- |
| Not found    | Broaden search, try variations   | Report "not found" with what was tried |
| Permission   | Check path/credentials           | Report blocker, suggest resolution     |
| Timeout      | Reduce scope or break into parts | Report partial progress                |
| Parse error  | Try alternate format             | Report with raw data                   |
| Agent error  | Retry with clearer instructions  | Escalate to consultant                 |

**Retry limit**: 2 attempts per operation

**Always report**: What failed, what was tried, what worked (if anything)

## Escalation Triggers

Escalate to `Ahithopel (consultant)` when:

- Same failure after 2 retry attempts
- Blocker requires domain expertise
- Conflicting requirements discovered
- Architectural decision needed
- Security or critical path concern

## Example Progress Update

```markdown
## Workflow: Add User Authentication

**Started**: 2024-01-15T10:30:00Z
**Status**: In Progress
**Current Phase**: 2 of 4

| Task                    | Agent  | Status | Health | Notes                            |
| ----------------------- | ------ | ------ | ------ | -------------------------------- |
| Research auth patterns  | Berean | ✅     | 🟢     | JWT + refresh tokens recommended |
| Find existing auth code | Caleb  | ✅     | 🟢     | Found middleware in src/auth/    |
| Implement auth service  | Baruch | 🔄     | 🟡     | Running 8 min, checking output   |
| Add auth middleware     | Baruch | ⏳     | -      | Blocked by auth service          |
| Write auth tests        | Elihu  | ⏳     | -      | Blocked by implementation        |
| Update API docs         | Luke   | ⏳     | -      | Blocked by implementation        |

### Recent Activity

- 10:30 - Started research and exploration (parallel)
- 10:35 - Both completed, synthesized findings
- 10:36 - Started auth service implementation
- 10:44 - Checked progress, output looks correct but slow

### Next Actions

- Monitor auth service task (currently 🟡)
- If not complete by 10:50, check partial output
- Once complete, launch middleware task
```
