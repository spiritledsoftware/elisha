# Review: Elisha Agent Swarm Security and Robustness

**Version**: 1.0
**Last Updated**: 2026-01-21T00:00:00Z
**Last Agent**: reviewer
**Status**: Open
**Target**: src/permission/, src/mcp/hooks.ts, src/util/hooks.ts, src/task/, src/agent/
**Scope**: standard

## Summary

**Files**: 15+ files reviewed across permission, mcp, task, util, and agent domains
**Issues**: 2 critical, 4 warnings, 3 nitpicks

---

## Issues

### Critical

| File                         | Line  | Issue                                                                                                         | Confidence | Suggestion                                                                                              |
| ---------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `src/permission/defaults.ts` | 16-24 | Bash command denylist is easily bypassed with variations (e.g., `rm -r -f`, `\rm`, `$(rm)`, backticks, pipes) | Definite   | Consider allowlist approach or integrate with shell parser; current patterns are trivially circumvented |
| `src/mcp/hooks.ts`           | 21-27 | Suspicious pattern detection is incomplete and easily bypassed (case variations, unicode, obfuscation)        | Likely     | Expand pattern list, add unicode normalization, or document this as defense-in-depth only               |

### Warnings

| File                            | Line | Issue                                                                                                 | Confidence | Suggestion                                                               |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `src/instruction/hooks.ts`      | 8    | Session tracking uses unbounded `Set<string>` with no TTL cleanup                                     | Definite   | Add TTL-based cleanup like `src/mcp/hooks.ts` and `src/task/hooks.ts` do |
| `src/task/tools.ts`             | 13   | `activeTasks` Set is module-level singleton - won't work correctly across multiple plugin instances   | Likely     | Consider using session-scoped or context-scoped storage                  |
| `src/agent/researcher/index.ts` | 3    | Uses tilde import alias `~/mcp/chrome-devtools.ts` inconsistent with other files using relative paths | Definite   | Use relative import `../../mcp/chrome-devtools.ts` for consistency       |
| `src/agent/util/index.ts`       | 24   | Checks `config?.disabled` but agents use `config?.disable` (without 'd')                              | Definite   | Change to `config?.disable !== true` to match actual property name       |

### Nitpicks

| File                               | Line  | Issue                                                                           | Confidence | Suggestion                                                         |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `src/mcp/hooks.ts`                 | 48-49 | Magic numbers for SESSION_TTL_MS and MAX_SESSIONS duplicated in task/hooks.ts   | Potential  | Extract to shared constants in util/                               |
| `src/util/hooks.ts`                | 8-24  | `runHooksWithIsolation` logs errors but doesn't include hook name for debugging | Potential  | Include hook type in error message for easier debugging            |
| `src/agent/util/protocol/index.ts` | 20    | `expandProtocols` throws on unknown protocol but doesn't validate at build time | Potential  | Consider compile-time validation or graceful fallback with warning |

---

## Detailed Analysis

### 1. Security: Permission System

**Location**: `src/permission/`

**Strengths**:

- Layered permission model (global → agent → tool)
- Uses `defu` for proper config merging
- Denies sensitive file reads (`.env*`)
- Requires `ask` for external operations (webfetch, websearch)

**Concerns**:

1. **Bash Denylist Bypass (Critical)**: The patterns in `defaults.ts:16-24` are trivially bypassed:

   ```typescript
   bash: {
     '*': 'allow',
     'rm * /': 'deny',      // Bypassed by: rm -r -f /, \rm /, $(rm -rf /)
     'rm -rf *': 'deny',    // Bypassed by: rm -r -f, rm --recursive --force
     // ...
   }
   ```

   Shell command matching via glob patterns cannot reliably prevent dangerous commands.

2. **No Path Traversal Protection**: The `read` permission allows `*` but only denies `.env*`. Attackers could read `/etc/passwd`, `~/.ssh/id_rsa`, etc. if `external_directory` is allowed.

### 2. Security: Memory Validation

**Location**: `src/mcp/hooks.ts`

**Strengths**:

- Wraps memory content in `<untrusted-memory>` tags
- Strips HTML comments that could hide instructions
- Detects some suspicious imperative patterns
- Applies validation to both initial injection and query results

**Concerns**:

1. **Pattern Detection Bypass (Critical)**: The suspicious patterns are easily bypassed:

   ```typescript
   const suspiciousPatterns = [
     /ignore previous/i, // Bypassed: "1gnore prev1ous", "ignore\u200Bprevious"
     /execute/i, // Too broad (matches "execute" in legitimate code)
     // ...
   ];
   ```

   This provides false sense of security. Consider documenting as defense-in-depth only.

2. **No Content Length Limit**: Large memory payloads could cause context overflow or performance issues.

### 3. Robustness: Error Handling in Hooks

**Location**: `src/util/hooks.ts`

**Strengths**:

- Uses `Promise.allSettled` for isolation - one failing hook doesn't crash others
- Logs errors with context
- Covers all hook types

**Concerns**:

1. **Error Context**: Logged errors don't include which hook type failed, making debugging harder.

2. **No Return Value Handling**: Some hooks may return values that need merging; current implementation discards all returns.

### 4. Robustness: Task Concurrency and TTL

**Location**: `src/task/`

**Strengths**:

- Concurrency limit (MAX_CONCURRENT_TASKS = 5)
- Exponential backoff for polling
- Proper cleanup in finally blocks
- Session TTL cleanup (24 hours)

**Concerns**:

1. **Module-Level Singleton**: `activeTasks` Set is module-scoped. If plugin is instantiated multiple times, they share state incorrectly.

2. **Race Condition**: Between checking `activeTasks.size` and adding to set, another task could be added.

3. **No Task Timeout Enforcement**: While `waitForTask` has timeout, the task itself can run indefinitely.

### 5. Robustness: Config Merging

**Location**: Throughout codebase

**Strengths**:

- Consistent use of `defu` for config merging
- Proper null coalescing (`ctx.config.agent ??= {}`)
- User overrides preserved correctly

**Concerns**:

1. **Property Name Mismatch**: `src/agent/util/index.ts:24` checks `disabled` but agents use `disable`:

   ```typescript
   .filter(([_, config]) => config?.disabled !== true)  // Wrong property!
   ```

   Should be `config?.disable !== true`.

### 6. Code Quality: Import Consistency

**Location**: Throughout codebase

**Strengths**:

- Most files use `.ts` extensions correctly
- Barrel exports used appropriately

**Concerns**:

1. **Tilde Import Alias**: `src/agent/researcher/index.ts:3` uses `~/mcp/chrome-devtools.ts` while all other files use relative paths. This inconsistency could cause issues.

### 7. Code Quality: Synthetic Message Marking

**Location**: All hook files

**Strengths**:

- All injected messages properly marked with `synthetic: true`
- Consistent pattern across mcp/hooks.ts, task/hooks.ts, instruction/hooks.ts

### 8. Code Quality: Hook Isolation

**Location**: `src/instruction/hooks.ts`

**Concerns**:

1. **Unbounded Session Set**: Unlike mcp/hooks.ts and task/hooks.ts which have TTL cleanup, instruction/hooks.ts uses a plain `Set<string>` that grows unbounded:

   ```typescript
   const injectedSessions = new Set<string>(); // No cleanup!
   ```

   This is a memory leak for long-running processes.

---

## Actionable Items

Tasks for executor to address (Critical and Warning issues):

- [ ] `src/permission/defaults.ts:16-24` - Document bash denylist limitations; consider allowlist or shell parsing approach
- [ ] `src/mcp/hooks.ts:21-27` - Document pattern detection as defense-in-depth; add content length limit
- [ ] `src/instruction/hooks.ts:8` - Add TTL-based cleanup matching mcp/hooks.ts pattern
- [ ] `src/task/tools.ts:13` - Consider session-scoped storage for activeTasks
- [ ] `src/agent/researcher/index.ts:3` - Change tilde import to relative path
- [ ] `src/agent/util/index.ts:24` - Fix property name from `disabled` to `disable`

---

## Security Recommendations

### Short-term (High Priority)

1. **Document Bash Limitations**: Add clear documentation that bash denylist is not a security boundary - it's defense-in-depth only. The real protection is the `ask` permission for dangerous operations.

2. **Fix Property Name Bug**: The `disabled` vs `disable` mismatch could cause agents to appear in lists when they shouldn't.

3. **Add Memory Leak Fix**: The instruction hooks session tracking will grow unbounded.

### Medium-term

1. **Consider Shell Parsing**: For bash restrictions, consider using a proper shell parser to normalize commands before matching.

2. **Add Content Limits**: Memory content should have size limits to prevent context overflow attacks.

3. **Improve Error Context**: Include hook type in error logs for easier debugging.

### Long-term

1. **Allowlist Approach**: Consider moving from denylist to allowlist for bash commands, especially for sensitive agents.

2. **Formal Security Audit**: The prompt injection mitigations are good defense-in-depth but shouldn't be relied upon as primary security controls.

---

## Resolution Log

| Version | Agent    | Action                                 | Timestamp            |
| ------- | -------- | -------------------------------------- | -------------------- |
| 1.0     | reviewer | Initial security and robustness review | 2026-01-21T00:00:00Z |
