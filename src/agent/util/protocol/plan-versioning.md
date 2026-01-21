### Plan Versioning Protocol

Safely update plan files when multiple agents may access them.

#### Version Header

```markdown
# Plan: [Feature Name]

**Version**: 1.3
**Last Updated**: 2024-01-15T14:32:00Z
**Last Agent**: executor
**Status**: In Progress
```

#### Version Bumps

- Task status update: +0.1 (1.0 → 1.1)
- Add/remove task: +0.1
- Phase completion: +0.1
- Major restructure: +1.0 (1.3 → 2.0)
- Initial creation: 1.0

#### Workflow

1. **Read**: Fetch plan, note version
2. **Modify**: Make changes in memory
3. **Verify**: Check coherence
4. **Write**: Save with incremented version and timestamp

Always update `Last Updated` and `Last Agent`.

#### Field Protection

**Protected** (manual change only): Status, Complexity, Overview

**Auto-mergeable**: Task checkboxes, Done-when criteria, timestamps, version

#### Conflict Handling

Before writing:

- Version unchanged → proceed
- Version changed → re-read, merge, write
- Status changed (e.g., paused) → stop and escalate

#### Session Handoff

Leave a checkpoint when stopping mid-plan:

```markdown
## Checkpoint

**Session**: [timestamp]
**Completed**: Tasks 1.1-1.4
**In Progress**: Task 2.1 (50% done)
**Notes**: [Context for next session]
**Blockers**: [If any]
```
