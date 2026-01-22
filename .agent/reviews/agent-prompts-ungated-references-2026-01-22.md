# Review: Agent Prompts - Ungated References

**Version**: 1.0
**Last Updated**: 2026-01-22T00:00:00Z
**Last Agent**: reviewer
**Verdict**: PASS WITH NOTES
**Target**: `src/agent/*.ts`, `src/agent/util/prompt/protocols.ts`

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All agent references gated with availability checks | ✅ | All `<teammates>` sections use `Prompt.when(canDelegate, ...)` |
| All MCP references gated with `isMcpAvailableForAgent()` | ✅ | designer.ts uses `isMcpAvailableForAgent()` for chrome-devtools |
| All tool references gated with permission checks | ✅ | Protocols use `agentHasPermission()` for tool checks |
| Conditional sections only appear when capabilities available | ⚠️ | Minor issues found - see below |

## Summary

**Files**: 13 reviewed
**Issues**: 0 critical, 3 warnings, 2 nitpicks

## Analysis by File

### orchestrator.ts

**Status**: ✅ Well-gated

- Line 50-57: `<teammates>` gated with `canDelegate` ✅
- Line 60-66: Protocols use `Protocol.contextGathering()` and `Protocol.escalation()` which are dynamically gated ✅
- Line 62-65: Delegation protocols gated with `Prompt.when(canDelegate, ...)` ✅
- Line 112-121: `<task_matching>` section gated with `canDelegate` ✅

### executor.ts

**Status**: ✅ Well-gated

- Line 54-61: `<teammates>` gated with `canDelegate` ✅
- Line 64-68: Protocols dynamically gated ✅

### planner.ts

**Status**: ✅ Well-gated

- Line 65-72: `<teammates>` gated with `canDelegate` ✅
- Line 207-214: `<task_assignment_guide>` gated with `canDelegate` ✅
- Line 226-229: Explorer reference gated with `hasExplorer` check ✅

### reviewer.ts

**Status**: ✅ Well-gated

- Line 58-65: `<teammates>` gated with `canDelegate` ✅
- Line 67-70: Protocols dynamically gated ✅

### explorer.ts

**Status**: ✅ Well-gated

- Line 57-64: `<teammates>` gated with `canDelegate` ✅
- Line 66-70: Protocols dynamically gated ✅

### researcher.ts

**Status**: ✅ Well-gated

- Line 59-66: `<teammates>` gated with `canDelegate` ✅
- Line 68-72: Protocols dynamically gated ✅

### architect.ts

**Status**: ✅ Well-gated

- Line 58-65: `<teammates>` gated with `canDelegate` ✅
- Line 67-71: Protocols dynamically gated ✅

### consultant.ts

**Status**: ✅ Well-gated

- Line 55-62: `<teammates>` gated with `canDelegate` ✅
- Line 64-66: Only `contextGathering` protocol (no escalation - consultant IS the escalation target) ✅

### brainstormer.ts

**Status**: ✅ Well-gated

- Line 55-62: `<teammates>` gated with `canDelegate` ✅
- Line 64-67: Protocols dynamically gated ✅

### designer.ts

**Status**: ✅ Exemplary - Best practices followed

- Line 55-59: Uses `isMcpAvailableForAgent()` for chrome-devtools check ✅
- Line 63-67: Chrome DevTools reference in role gated with `hasChromeDevtools` ✅
- Line 69-76: `<teammates>` gated with `canDelegate` ✅
- Line 87: Capability reference gated ✅
- Line 108-117: Instructions gated ✅
- Line 148-151: Constraints gated ✅

### documenter.ts

**Status**: ✅ Well-gated

- Line 65-72: `<teammates>` gated with `canDelegate` ✅
- Line 130: Explorer delegation reference gated with `hasExplorer` ✅

### compaction.ts

**Status**: ✅ N/A - No prompt template

- This agent only sets model config, no prompt to review.

### protocols.ts

**Status**: ✅ Well-gated

- Line 24-38: All MCP/agent checks use proper availability functions ✅
- Line 43-73: All protocol content dynamically gated based on availability ✅
- Line 81-101: Escalation protocol properly checks consultant availability ✅

## Issues

### Critical (must fix)

*None found*

### Warnings (should fix)

| File | Line | Issue | Confidence | Fix |
| ---- | ---- | ----- | ---------- | --- |
| `protocols.ts` | 28 | `hasGrepApp` uses `isAgentEnabled()` instead of `isMcpAvailableForAgent()` | Definite | Change to `isMcpAvailableForAgent(MCP_GREP_APP_ID, agentName, ctx)` |
| `protocols.ts` | 26 | `hasWebFetch` checks `websearch` permission instead of `webfetch` | Definite | Change to `agentHasPermission('webfetch', agentName, ctx)` |
| `orchestrator.ts` | 123-135 | `<parallel_patterns>` section mentions "explorer tasks" without gating | Likely | Consider gating with `Prompt.when(isAgentEnabled(AGENT_EXPLORER_ID, ctx), ...)` or make generic |

### Nitpicks (optional)

| File | Line | Issue | Fix |
| ---- | ---- | ----- | --- |
| `orchestrator.ts` | 154 | Hardcoded "consultant" reference in constraints | Gate with `Prompt.when(hasConsultant, 'Escalate to consultant when stuck, don\'t spin')` |
| `executor.ts` | 114-115 | Hardcoded `bun run` commands | Consider gating based on project type detection or making generic |

## Verdict Rationale

**PASS WITH NOTES**: The codebase demonstrates excellent practices for gating agent and MCP references. All major sections (`<teammates>`, `<task_matching>`, `<task_assignment_guide>`) are properly gated with `Prompt.when()` and appropriate availability checks.

The `protocols.ts` file is particularly well-designed, dynamically building protocol content based on what's available to each agent.

Three warnings were found:

1. `hasGrepApp` incorrectly uses `isAgentEnabled()` instead of `isMcpAvailableForAgent()` - this is a bug since `MCP_GREP_APP_ID` is an MCP, not an agent
2. `hasWebFetch` checks the wrong permission (`websearch` instead of `webfetch`)
3. The `<parallel_patterns>` section in orchestrator mentions "explorer tasks" without checking if explorer is available

These are minor issues that don't break functionality but could cause confusion or incorrect behavior in edge cases.

## Actionable Items

- [ ] `protocols.ts:28` - Change `isAgentEnabled(MCP_GREP_APP_ID, ctx)` to `isMcpAvailableForAgent(MCP_GREP_APP_ID, agentName, ctx)`
- [ ] `protocols.ts:26` - Change `agentHasPermission('websearch', agentName, ctx)` to `agentHasPermission('webfetch', agentName, ctx)`
- [ ] `orchestrator.ts:123-135` - Consider making parallel_patterns section more generic or gating explorer reference

## Positive Observations

1. **Consistent pattern**: All agents follow the same pattern of checking `canAgentDelegate()` before showing teammates
2. **Dynamic protocols**: The `Protocol` namespace elegantly handles per-agent capability differences
3. **Designer as exemplar**: `designer.ts` shows best practices for MCP-specific gating with `isMcpAvailableForAgent()`
4. **Proper fallbacks**: `Protocol.contextGathering()` provides fallback text when delegation isn't available (line 50-51)
5. **Self-exclusion**: Protocols correctly exclude agents from delegating to themselves (e.g., explorer can't delegate to explorer)
