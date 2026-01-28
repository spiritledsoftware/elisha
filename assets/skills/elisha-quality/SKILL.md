---
name: elisha-quality
description: Use when ensuring output quality before completion, performing self-review, or determining confidence levels for findings and recommendations.
---

# Quality Assurance

## Overview

Quality assurance ensures outputs meet acceptance criteria before marking tasks complete. The agent performs verification checks, self-reflection, and states confidence levels to maintain high-quality, reliable results.

## When to Use

**Triggering conditions:**

- About to mark a task as complete
- Finalizing output before responding to user
- Making claims or recommendations that need confidence assessment
- Reviewing own work for errors or omissions

**Don't use for:**

- Initial exploration or research phases
- Draft outputs explicitly marked as work-in-progress
- Simple informational responses with no implementation

## Quick Reference

| Protocol     | When to Apply                | Key Question                              |
| ------------ | ---------------------------- | ----------------------------------------- |
| Verification | Before marking task complete | "Do all acceptance criteria pass?"        |
| Reflection   | Before finalizing any output | "Does this address what was asked?"       |
| Confidence   | When stating findings/claims | "How certain am I, and what's the basis?" |

## Quality Gates

Every task completion requires passing these gates:

| Gate                | Check                                      | Fail Action         |
| ------------------- | ------------------------------------------ | ------------------- |
| Acceptance criteria | All "Done when" items satisfied            | List unmet criteria |
| No regressions      | Changes don't break existing functionality | Identify what broke |
| Pattern conformance | Code follows codebase conventions          | Note deviations     |
| Test verification   | Relevant tests pass (if applicable)        | Report failures     |

See [references/verification.md](references/verification.md) for full checklist.

## Self-Review Process

Before finalizing output:

1. **Re-read objective** - Does output address what was asked?
2. **Check completeness** - Any missed requirements or edge cases?
3. **Verify accuracy** - Are claims supported by evidence?
4. **Assess quality** - Would you be satisfied receiving this output?

See [references/reflection.md](references/reflection.md) for detailed process.

## Confidence Levels

| Level      | Meaning                            | Action                                  |
| ---------- | ---------------------------------- | --------------------------------------- |
| **High**   | Verified from authoritative source | Proceed confidently                     |
| **Medium** | Multiple indicators support this   | Proceed, note uncertainty               |
| **Low**    | Best guess, limited information    | State assumptions, suggest verification |

See [references/confidence.md](references/confidence.md) for usage guidelines.

## Complete Example

**Scenario**: Agent completing a code implementation task.

```markdown
## Pre-Completion Checklist

### Verification

- [x] Acceptance criteria: Add pagination to users list
  - [x] Pagination component renders
  - [x] Page size configurable (10, 25, 50)
  - [x] URL params update on page change
- [x] No regressions: Existing user list tests pass
- [x] Pattern conformance: Uses existing Pagination component
- [x] Tests: Added 3 new tests, all passing

### Reflection

- [x] Objective addressed: Pagination fully implemented
- [x] Completeness: Handled edge cases (empty list, single page)
- [x] Accuracy: Verified against API response structure
- [x] Quality: Code is clean, well-typed, documented

### Confidence

- **Implementation**: High - followed existing patterns, tests pass
- **Performance**: Medium - pagination reduces load, but no benchmarks run
- **Edge cases**: Medium - covered common cases, may miss rare scenarios

## Result

Task complete. All quality gates passed.
```

## Common Mistakes

| Mistake                                    | Fix                                                |
| ------------------------------------------ | -------------------------------------------------- |
| Marking complete without checking criteria | Always run verification checklist                  |
| Skipping reflection for "simple" tasks     | Every output benefits from quick self-review       |
| Stating findings without confidence level  | Always indicate High/Medium/Low with basis         |
| Ignoring verification failures             | Report failures, do NOT mark complete              |
| Over-confidence without evidence           | Base confidence on verifiable sources              |
| Under-confidence despite verification      | If tests pass and criteria met, confidence is High |

## Validation Checklist

- [ ] All acceptance criteria explicitly checked
- [ ] No TypeScript/lint errors introduced
- [ ] Code follows existing patterns
- [ ] Self-review performed before finalizing
- [ ] Confidence levels stated for key findings
- [ ] Verification failures reported (not hidden)
