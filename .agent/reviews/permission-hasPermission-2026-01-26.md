# Review: Elisha hasPermission vs OpenCode Permission System

**Version**: 1.0
**Last Updated**: 2026-01-26T00:00:00Z
**Last Agent**: Elihu (reviewer)
**Verdict**: FAIL
**Target**: `src/permission/util.ts`, `src/agent/agent.ts`

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Wildcard behavior matches OpenCode | :x: | `*` uses `[^:]*` instead of `.*` (intentional design difference) |
| Special trailing space+wildcard case | :x: | Not implemented |
| dotAll flag for newline matching | :x: | Not implemented |
| Home expansion support | :x: | Not implemented |
| Default behavior matches OpenCode | :x: | Returns `false` instead of `"ask"` |
| Pattern matching direction correct | :white_check_mark: | Both use pattern-to-input matching |

## Summary

**Files**: 2 reviewed
**Issues**: 1 critical, 2 warnings, 1 nitpick

## Detailed Analysis

### 1. Wildcard Behavior Differences (DESIGN DIFFERENCE - NOT A BUG)

**OpenCode's approach:**

```typescript
// util/wildcard.ts
.replace(/\*/g, ".*") // * becomes .* (matches ANY characters)
```

**Elisha's approach:**

```typescript
// src/permission/util.ts:25-27
.replace(/\*\*/g, '.*') // ** matches any path
.replace(/\*/g, '[^:]*') // * matches any characters except colon
```

**Analysis**: The `[^:]*` pattern is **intentional** for segment matching in colon-separated permission strings. This is a reasonable design choice:

| Pattern | Input | OpenCode | Elisha |
|---------|-------|----------|--------|
| `mcp-openmemory*` | `mcp-openmemory_store` | :white_check_mark: | :white_check_mark: |
| `edit*` | `edit` | :white_check_mark: | :white_check_mark: |
| `edit*` | `editFile` | :white_check_mark: | :white_check_mark: |
| `bash:*` | `bash:rm -rf /` | :white_check_mark: | :white_check_mark: |

The `[^:]*` works correctly because permission patterns don't typically contain colons in the tool name segment. **Not a bug.**

### 2. Missing Special Case: Trailing Space+Wildcard (WARNING)

**OpenCode:**

```typescript
// Special case: "ls *" matches "ls" and "ls -la"
if (escaped.endsWith(" .*")) {
  escaped = escaped.slice(0, -3) + "( .*)?"
}
```

**Elisha**: Not implemented.

**Impact**: Bash permission patterns like `"rm *"` behave differently:

- OpenCode: `"rm *"` matches both `"rm"` and `"rm -rf /"`
- Elisha: `"rm *"` only matches `"rm -rf /"`, not `"rm"` alone

**Example from default permissions (src/permission/util.ts:38-47):**

```typescript
bash: {
  '*': 'allow',
  'rm * /': 'deny',  // Won't match "rm /" in Elisha
  'rm -rf *': 'deny',
}
```

### 3. Missing dotAll Flag (LOW)

**OpenCode:**

```typescript
return new RegExp("^" + escaped + "$", "s").test(str)
//                                      ^ dotAll flag
```

**Elisha (line 30):**

```typescript
const regex = new RegExp(`^${regexPattern}$`);
//                                          ^ no flags
```

**Impact**: `*` won't match newlines in Elisha. Unlikely to matter for permission strings but is a behavioral difference.

### 4. Default Behavior Mismatch (CRITICAL)

**OpenCode:**

```typescript
// Default to "ask" if no specific rule is found
return match ?? { action: "ask", permission, pattern: "*" }
```

**Elisha (line 143):**

```typescript
// Return last match result, or false if no matches
return lastMatchResult ?? false;
```

**Impact**: When no rule matches:

- OpenCode: Returns `"ask"` (prompts user)
- Elisha: Returns `false` (denies silently)

This is a **security-relevant difference**. Elisha is more restrictive (deny by default), which may be intentional, but differs from OpenCode's behavior and is **undocumented**.

### 5. Missing Home Expansion (WARNING)

**OpenCode** expands `~/`, `~`, `$HOME/`, `$HOME` to absolute paths before matching.

**Elisha**: No home expansion.

**Impact**: Patterns like `read:~/secrets.txt` won't match `read:/Users/user/secrets.txt`.

### 6. Pattern Matching Direction (CORRECT)

Both systems match pattern-to-input correctly:

- OpenCode: `Wildcard.match(permission, rule.permission)` - checks if permission matches rule pattern
- Elisha: `isPatternMatch(key, inputPattern)` - checks if key pattern matches input

This is correct. :white_check_mark:

## Issues

### Critical (must fix)

| File | Line | Issue | Confidence | Fix |
| ---- | ---- | ----- | ---------- | --- |
| `src/permission/util.ts` | 143 | Default returns `false` instead of `"ask"` equivalent - undocumented behavior difference | Definite | Document if intentional; if not, consider returning `true` for "ask" semantics |

### Warnings (should fix)

| File | Line | Issue | Confidence | Fix |
| ---- | ---- | ----- | ---------- | --- |
| `src/permission/util.ts` | 21-31 | Missing trailing space+wildcard special case | Definite | Add special case handling for patterns ending in `*` |
| `src/permission/util.ts` | 21-31 | Missing home expansion for file paths | Medium | Add home expansion before pattern matching if file paths are involved |

### Nitpicks (optional)

| File | Line | Issue | Fix |
| ---- | ---- | ----- | --- |
| `src/permission/util.ts` | 30 | Missing dotAll flag | Add `'s'` flag: `new RegExp(\`^${regexPattern}$\`, 's')` |

## Verdict Rationale

**FAIL** - Critical discrepancy in default behavior:

1. **Default deny vs ask**: Elisha returns `false` when no rule matches, while OpenCode returns `"ask"`. This could cause unexpected permission denials for tools not explicitly configured. This behavior difference is **undocumented**.

2. **Missing trailing space+wildcard**: Bash patterns like `"rm *"` won't match `"rm"` alone, potentially allowing dangerous commands to slip through if the pattern was intended to catch both forms.

The `[^:]*` vs `.*` difference is a reasonable design choice for segment-based matching and is **not** a bug.

## Actionable Items

- [ ] `src/permission/util.ts:143` - Document that Elisha uses deny-by-default (differs from OpenCode's ask-by-default), OR change to match OpenCode behavior
- [ ] `src/permission/util.ts:21-31` - Add trailing space+wildcard special case for bash command patterns
- [ ] `src/permission/util.ts:21-31` - Consider adding home expansion for file path patterns
- [ ] `src/permission/util.test.ts` - Add tests for edge cases:
  - Pattern `"rm *"` matching `"rm"` (currently fails)
  - Default behavior when no rules match
  - Patterns with colons

## Recommended Code Changes

### Fix 1: Trailing Space+Wildcard Special Case

```typescript
export const isPatternMatch = (pattern: string, input: string): boolean => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  let regexPattern = escaped
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^:]*')
    .replace(/\?/g, '.');

  // Special case: "cmd *" matches both "cmd" and "cmd args" (OpenCode compatibility)
  if (regexPattern.endsWith(' [^:]*')) {
    regexPattern = regexPattern.slice(0, -6) + '( [^:]*)?';
  }

  const regex = new RegExp(`^${regexPattern}$`, 's');
  return regex.test(input);
};
```

### Fix 2: Document Default Behavior

If deny-by-default is intentional, add a comment:

```typescript
// Return last match result, or false if no matches
// NOTE: Unlike OpenCode which defaults to "ask", Elisha defaults to deny
// for security. Explicitly configure permissions for all tools.
return lastMatchResult ?? false;
```

### Fix 3: Add Missing Tests

```typescript
describe('isPatternMatch', () => {
  describe('trailing space+wildcard (OpenCode compatibility)', () => {
    it('matches command without args', () => {
      // Currently FAILS - needs fix
      expect(isPatternMatch('rm *', 'rm')).toBe(true);
    });
    
    it('matches command with args', () => {
      expect(isPatternMatch('rm *', 'rm -rf /')).toBe(true);
    });
  });

  describe('colon-separated patterns', () => {
    it('handles single segment wildcards', () => {
      expect(isPatternMatch('edit:*', 'edit:file.ts')).toBe(true);
    });
  });
});

describe('hasPermission default behavior', () => {
  it('returns false when no rules match (deny-by-default)', () => {
    const config = { edit: 'allow' };
    // Requesting permission for unconfigured tool
    expect(hasPermission(config, ['bash'])).toBe(false);
  });
});
```

## Test Coverage Gap

The existing tests in `src/permission/util.test.ts` do not cover:

1. `isPatternMatch` function directly (no unit tests)
2. Edge cases for trailing space+wildcard patterns
3. Default behavior when no rules match
4. The agent's `hasPermission` method (in `src/agent/agent.ts`)

**Confidence Level**: High - verified from source code analysis.
