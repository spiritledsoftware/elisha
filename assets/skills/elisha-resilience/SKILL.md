---
name: elisha-resilience
description: Use when handling operation failures, recovering from errors, deciding when to escalate blockers, or preserving progress across sessions.
---

# Error Handling & Recovery

## Overview

Resilient agents handle failures gracefully through structured retry strategies, know when to escalate blockers, and preserve progress for session continuity. The goal is to maximize successful outcomes while minimizing wasted effort.

## When to Use

**Triggering conditions:**

- Operation failed (not found, permission denied, timeout, parse error)
- Stuck on a problem after multiple attempts
- Need to preserve progress before stopping
- Uncertain whether to retry or escalate

**Don't use for:**

- First-time operations (try normally first)
- User-requested stops (no recovery needed)
- Successful operations (no error handling required)

## Quick Reference

| Failure Type | First Action                     | If Still Fails                     |
| ------------ | -------------------------------- | ---------------------------------- |
| Not found    | Broaden search, try variations   | Report with what was tried         |
| Permission   | Check path/credentials           | Report blocker, suggest resolution |
| Timeout      | Reduce scope or break into parts | Report partial progress            |
| Parse error  | Try alternate format             | Report with raw data               |

**Retry limit**: 2 attempts per operation

See [references/retry-strategy.md](references/retry-strategy.md) for detailed patterns.

## Escalation Decision Tree

```
Operation failed?
├── Can I retry with different approach?
│   ├── Yes → Retry (max 2 attempts)
│   └── No → Continue below
├── Is this a blocker I can't resolve?
│   ├── Yes → Escalate to Ahithopel (consultant)
│   └── No → Continue below
├── Do I have partial progress?
│   ├── Yes → Report partial results
│   └── No → Report failure with details
```

See [references/escalation.md](references/escalation.md) for escalation protocols.

## Checkpoint Format

When stopping or completing significant work, preserve progress:

```markdown
## Checkpoint

**Session**: [ISO timestamp]
**Completed**: [Tasks done]
**In Progress**: [Current task]
**Notes**: [Context for next session]
**Blockers**: [If any]
```

See [references/checkpoint.md](references/checkpoint.md) for checkpoint guidelines.

## Recovery Patterns

| Situation                     | Recovery Action                             |
| ----------------------------- | ------------------------------------------- |
| File not found                | Search with glob patterns, check variations |
| API returned error            | Check credentials, retry with backoff       |
| Command timed out             | Break into smaller operations               |
| Parse failed                  | Try alternate parser, request raw format    |
| Multiple failures in sequence | Stop, assess root cause, escalate if needed |

## Complete Example

**Scenario**: Agent searching for configuration file that doesn't exist at expected path.

```
# Attempt 1: Direct path
Read: src/config/settings.json
Result: File not found

# Attempt 2: Broaden search (retry 1)
Glob: **/settings.json
Result: Found at config/settings.json (different location)

# Success: Proceed with correct path
```

**Scenario**: Agent stuck on complex debugging problem.

```
# Attempt 1: Standard debugging
Analyzed stack trace, checked common causes
Result: Root cause unclear

# Attempt 2: Different approach (retry 1)
Added logging, reproduced issue
Result: Still unclear

# Escalation decision
- Exceeded retry limit
- Blocker: Cannot proceed without resolution
- Action: Delegate to Ahithopel (consultant)

elisha_task_create({
  title: "Debug authentication failure",
  agent: "Ahithopel (consultant)",
  prompt: `
    OBJECTIVE: Identify root cause of auth failure.
    CONTEXT: [Stack trace, logs, what was tried]
    CONSTRAINTS: Production system, cannot restart.
    SUCCESS: Root cause identified with fix recommendation.
    DEPENDENCIES: None.
  `
})
```

## Common Mistakes

| Mistake                              | Fix                                           |
| ------------------------------------ | --------------------------------------------- |
| Retrying same approach repeatedly    | Vary the approach on each retry               |
| Exceeding retry limit (> 2 attempts) | Escalate or report after 2 failures           |
| Not reporting what was tried         | Always include attempted approaches in report |
| Escalating too early                 | Try at least one alternative approach first   |
| Escalating too late                  | Don't exceed 2 retries before escalating      |
| Losing progress on session end       | Write checkpoint before stopping              |
| Vague checkpoint notes               | Include specific context for next session     |

## Validation Checklist

- [ ] Failure type correctly identified
- [ ] Appropriate first action taken
- [ ] Retry used different approach (not same action)
- [ ] Retry limit (2) not exceeded
- [ ] Escalation includes full context of what was tried
- [ ] Checkpoint written before stopping (if applicable)
- [ ] Report includes what failed, what was tried, what worked
