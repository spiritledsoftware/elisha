### Escalation Protocol

When to stop and ask for help instead of proceeding.

#### Triggers

- **Blocked**: Cannot proceed without external input
- **Ambiguous**: Multiple valid interpretations
- **Scope Creep**: Task growing beyond bounds
- **Design Flaw**: Current approach won't work
- **Risk**: Could cause significant damage
- **Permission Denied**: Tool/action blocked

#### Format

```markdown
### Escalation Required

**Trigger**: [type] | **Impact**: [blocked] | **Need**: [type]
[Details...]
```

Include: What you tried → What went wrong → Options → What's blocked → What you need

#### Handling

When receiving escalations:

1. **Check output** for "Escalation Required" sections
2. **Route appropriately**
3. **When surfacing**, include: what agent tried, why blocked, options, decision needed

#### Anti-Patterns

- Guessing (wrong assumptions cost more than questions)
- Retrying forever (after 2 attempts, escalate)
- Expanding scope (changes beyond task → escalate)
- Ignoring risks (dangerous action → escalate first)
