# Verification Protocol

Quality gates that must pass before marking any task complete.

## Core Principle

Never mark a task complete without explicitly verifying each acceptance criterion. Verification failures must be reported, not hidden.

## Verification Checklist

Before marking any task complete, check each item:

### 1. Acceptance Criteria

Every "Done when" or SUCCESS item must be satisfied:

| Check                      | How to Verify                           |
| -------------------------- | --------------------------------------- |
| Criteria explicitly listed | Review task handoff for SUCCESS section |
| Each item addressed        | Map output to each criterion            |
| Criteria actually met      | Verify, don't assume                    |
| No criteria skipped        | Account for every item                  |

**Template:**

```markdown
### Acceptance Criteria Check

- [ ] [Criterion 1]: [How verified]
- [ ] [Criterion 2]: [How verified]
- [ ] [Criterion 3]: [How verified]
```

### 2. No Regressions

Changes must not break existing functionality:

| Check                      | How to Verify                   |
| -------------------------- | ------------------------------- |
| Existing tests still pass  | Run test suite                  |
| Related features work      | Manual verification if no tests |
| No unintended side effects | Review change scope             |
| Dependencies not broken    | Check imports and consumers     |

**Regression indicators:**

- Test failures after changes
- TypeScript errors in unchanged files
- Broken imports or missing exports
- Changed behavior in unrelated features

### 3. Pattern Conformance

Code must follow codebase conventions:

| Check              | How to Verify                               |
| ------------------ | ------------------------------------------- |
| Naming conventions | Match existing file/function/variable names |
| Code organization  | Follow existing directory structure         |
| Import patterns    | Use established import style (e.g., `~/`)   |
| Error handling     | Match existing error patterns               |
| Type definitions   | Follow existing type conventions            |

**Common pattern violations:**

- Using relative imports when alias exists
- Different naming style than codebase
- Inconsistent error handling approach
- Missing types where codebase uses them

### 4. Test Verification

Run relevant tests when applicable:

| Situation                    | Action                                |
| ---------------------------- | ------------------------------------- |
| Tests exist for changed code | Run those tests                       |
| New functionality added      | Verify tests were added (if required) |
| No tests exist               | Note this in output                   |
| Tests fail                   | Report failures, do NOT mark complete |

## Verification Workflow

```
1. Gather acceptance criteria from task handoff
   ↓
2. Map each criterion to implementation
   ↓
3. Verify each criterion is actually met
   ↓
4. Run tests (if applicable)
   ↓
5. Check for regressions
   ↓
6. Verify pattern conformance
   ↓
7. If ALL pass → Mark complete
   If ANY fail → Report failure
```

## Handling Verification Failures

When verification fails:

| Failure Type        | Response                           |
| ------------------- | ---------------------------------- |
| Criterion not met   | List unmet criteria, explain gap   |
| Test failure        | Report which tests failed and why  |
| Regression detected | Identify what broke, suggest fix   |
| Pattern violation   | Note deviation, ask if intentional |

**Never:**

- Mark complete despite failures
- Hide or minimize failures
- Assume failures are acceptable
- Skip verification for "simple" changes

## Verification Report Template

```markdown
## Verification Report

### Acceptance Criteria

| Criterion     | Status | Evidence       |
| ------------- | ------ | -------------- |
| [Criterion 1] | ✅/❌  | [How verified] |
| [Criterion 2] | ✅/❌  | [How verified] |

### Regression Check

- Tests run: [Yes/No/N/A]
- Tests passed: [Yes/No]
- Related features verified: [Yes/No]

### Pattern Conformance

- Naming: ✅/❌
- Organization: ✅/❌
- Imports: ✅/❌
- Types: ✅/❌

### Result

[PASS: All checks passed / FAIL: Issues found]

### Issues (if any)

- [Issue 1]
- [Issue 2]
```
