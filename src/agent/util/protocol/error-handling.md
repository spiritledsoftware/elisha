### Error Handling Protocol

Standard patterns for handling tool failures.

#### Error Categories

- **Tool Failure** (timeout, malformed response) → Retry once
- **Empty Result** (no matches, empty file) → Reformulate
- **Timeout** (slow command/API) → Increase limit, retry
- **Permission** (access denied, blocked) → Escalate immediately
- **Invalid Input** (bad path, missing param) → Fix and retry

#### Recovery

**Retry** (tool failure, timeout): Wait briefly → retry once → reformulate or escalate

**Reformulate** (empty result):

1. Broaden search terms
2. Try alternative patterns (camelCase → snake_case)
3. Check different locations (src/ → lib/ → app/)
4. If still empty: report honestly, don't fabricate

**Escalate** (permission, unrecoverable):

1. Document what you tried
2. Explain why it failed
3. Report to calling agent or user
4. Do NOT retry blocked operations

#### Error Reporting Format

```markdown
### Error: [Brief Description]

**Category**: [Tool Failure | Empty Result | Timeout | Permission]
**Action Taken**: [Recovery attempted]
**Result**: [Recovered | Escalating | Partial Success]
**Details**: [Error message]
**Next Steps**: [What calling agent should do]
```

#### Graceful Degradation

When partial results available:

1. Return what you have with clear indication of gaps
2. Note which parts failed and why
3. Suggest alternatives
