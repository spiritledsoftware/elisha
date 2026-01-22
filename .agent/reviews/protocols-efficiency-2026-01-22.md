# Review: Protocol Token Efficiency

**Version**: 1.0
**Last Updated**: 2026-01-22T20:00:00Z
**Last Agent**: Elihu (reviewer)
**Verdict**: PASS WITH NOTES
**Target**: `src/agent/util/prompt/protocols.ts`

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Redundancies identified with line numbers | Done | See Issues section |
| Recommendations for condensing provided | Done | See Recommendations section |
| No code changes made | Done | READ-ONLY review |

## Summary

**File Stats**: 436 lines, ~1679 words
**Issues**: 0 critical, 5 warnings, 3 nitpicks
**Estimated Token Savings**: ~200-300 tokens (15-20% reduction possible)

## Issues

### Critical (must fix)

None.

### Warnings (should fix)

| ID | Lines | Issue | Confidence | Estimated Savings |
|----|-------|-------|------------|-------------------|
| W1 | 141-161, 216-243 | **Duplicate format templates**: `taskHandoff` and `resultSynthesis` both include markdown code block templates with similar structure | Definite | ~50 tokens |
| W2 | 123-135, 249-272 | **Overlapping tracking guidance**: `checkpoint` and `progressTracking` both track task status with similar fields (completed, in progress, blockers) | Definite | ~40 tokens |
| W3 | 167-184, 331-343 | **Redundant verification concepts**: `verification` and `reflection` both check completeness and quality before finalizing | Likely | ~30 tokens |
| W4 | 308-325, 278-302 | **Overlapping scope/clarity guidance**: `scopeAssessment` and `clarification` both address "when to proceed vs ask" | Likely | ~40 tokens |
| W5 | 378-435 | **Verbose anti-patterns**: Each agent type has 4 items with full sentences; could use terse phrasing | Definite | ~60 tokens |

### Nitpicks (optional)

| ID | Lines | Issue | Estimated Savings |
|----|-------|-------|-------------------|
| N1 | 108-118 | `confidence` table has redundant "Meaning" column - action implies meaning | ~15 tokens |
| N2 | 190-210 | `parallelWork` lists both "when to" and "when NOT to" - negative list is redundant | ~25 tokens |
| N3 | 349-363 | `retryStrategy` table has 4 failure types but only 2 actions per type are distinct | ~20 tokens |

## Detailed Analysis

### W1: Duplicate Format Templates (Lines 141-161, 216-243)

**Current State**:

```typescript
// taskHandoff (lines 152-159)
**Handoff format**:
\`\`\`
OBJECTIVE: [Clear goal statement]
CONTEXT: [Background info, file paths, patterns observed]
CONSTRAINTS: [Must follow X, avoid Y, use pattern Z]
SUCCESS: [Specific, verifiable criteria]
DEPENDENCIES: [Prior tasks, files that must exist]
\`\`\`

// resultSynthesis (lines 226-241)
**Synthesis format**:
\`\`\`markdown
## Combined Results
### From [Agent 1]
[Key findings/outputs]
### From [Agent 2]
[Key findings/outputs]
### Synthesis
[Unified conclusion/next steps]
### Conflicts (if any)
[What disagreed and how resolved]
\`\`\`
```

**Recommendation**: These serve different purposes (handoff vs synthesis) but both use verbose markdown templates. Consider:

1. Extract common "structured output" pattern
2. Use inline format hints instead of full templates

**Condensed Alternative for taskHandoff**:

```typescript
export const taskHandoff = Prompt.template`
  <task_handoff>
  Delegate with: OBJECTIVE (1 sentence), CONTEXT (files/patterns), CONSTRAINTS, SUCCESS criteria, DEPENDENCIES.
  </task_handoff>
`;
```

**Savings**: ~80 tokens (from ~120 to ~40)

---

### W2: Overlapping Tracking (Lines 123-135, 249-272)

**Current State**:

- `checkpoint`: Tracks session, completed, in progress, notes, blockers
- `progressTracking`: Tracks tasks completed, in progress, pending, blockers

**Recommendation**: Merge into single `progressTracking` with checkpoint as a subset, or make `checkpoint` reference `progressTracking` format.

**Condensed Alternative**:

```typescript
export const checkpoint = Prompt.template`
  <checkpoint>
  Update plan with: **Session** (ISO), **Completed**, **In Progress**, **Blockers**, **Notes**.
  </checkpoint>
`;
```

**Savings**: ~40 tokens

---

### W3: Redundant Verification (Lines 167-184, 331-343)

**Current State**:

- `verification`: Check criteria, regressions, patterns, tests before marking complete
- `reflection`: Re-read objective, check completeness, verify accuracy, assess quality

**Overlap**: Both check "completeness" and "quality" before finalizing.

**Recommendation**:

- `verification` = external checks (tests, lint, criteria)
- `reflection` = internal checks (did I answer the question?)

Make distinction clearer or merge into single protocol with two phases.

**Condensed Alternative for reflection**:

```typescript
export const reflection = Prompt.template`
  <reflection>
  Before responding: Does output address objective? Missing requirements? Claims supported? Fix issues or state uncertainty.
  </reflection>
`;
```

**Savings**: ~30 tokens

---

### W4: Overlapping Scope/Clarity (Lines 278-302, 308-325)

**Current State**:

- `clarification`: When request is unclear, ask focused questions
- `scopeAssessment`: Assess complexity before starting

**Overlap**: Both address "should I proceed or ask first?"

**Recommendation**: Merge into single `requestTriage` protocol:

1. Assess complexity (simple/medium/complex)
2. If unclear, ask focused questions
3. Proceed or escalate

**Condensed Alternative**:

```typescript
export const requestTriage = Prompt.template`
  <request_triage>
  **Assess**: Simple (1 file, clear) -> execute. Medium (some ambiguity) -> clarify if needed. Complex (cross-cutting) -> recommend planning.
  **If unclear**: Ask 1-3 focused questions with default assumption.
  </request_triage>
`;
```

**Savings**: ~80 tokens (merging two protocols)

---

### W5: Verbose Anti-Patterns (Lines 378-435)

**Current State**: Each agent type has 4 bullet points with full sentences.

**Example (executor)**:

```typescript
- Starting before reading existing patterns
- Adding unrequested "improvements"
- Marking complete without verification
- Hiding failures or partial completions
```

**Recommendation**: Use terse noun phrases:

```typescript
executor: `
  <anti_patterns>
  Avoid: coding before reading patterns, unrequested changes, unverified completion, hidden failures.
  </anti_patterns>
`,
```

**Savings per type**: ~15 tokens x 6 types = ~90 tokens total

---

### N1: Confidence Table Redundancy (Lines 108-118)

**Current**:

```
| Level | Meaning | Action |
| **High** | Verified from authoritative source | Proceed confidently |
```

**Condensed**:

```
| Level | Action |
| **High** (verified) | Proceed confidently |
```

---

### N2: Parallel Work Negative List (Lines 190-210)

**Current**: Lists both "Parallelize when" and "Do NOT parallelize when"

**Recommendation**: Negative list is inverse of positive. Keep only positive list with note: "If dependencies exist, run sequentially."

---

### N3: Retry Strategy Table (Lines 349-363)

**Current**: 4 failure types with 2 columns of actions

**Observation**: "First Action" and "If Still Fails" often follow same pattern (try variation -> report). Could condense to single action column.

---

## Recommendations Summary

| Priority | Recommendation | Estimated Savings | Effort |
|----------|----------------|-------------------|--------|
| High | Condense `antiPatterns` to terse phrases | ~90 tokens | Low |
| High | Merge `clarification` + `scopeAssessment` into `requestTriage` | ~80 tokens | Medium |
| Medium | Condense `taskHandoff` format template | ~80 tokens | Low |
| Medium | Condense `checkpoint` to single line | ~40 tokens | Low |
| Medium | Condense `reflection` to single line | ~30 tokens | Low |
| Low | Simplify `confidence` table | ~15 tokens | Low |
| Low | Remove negative list from `parallelWork` | ~25 tokens | Low |

**Total Estimated Savings**: ~360 tokens (conservative: ~200 tokens)

## Compact Variants Opportunity

Consider creating `Protocol.compact` namespace with minimal versions for token-constrained contexts:

```typescript
export namespace Protocol {
  export namespace compact {
    export const confidence = `State confidence: High (verified), Medium (likely), Low (guess).`;
    export const reflection = `Before responding: objective met? complete? accurate?`;
    export const verification = `Before complete: criteria met, no regressions, patterns match.`;
  }
}
```

This would allow agents to choose verbose vs compact based on context window pressure.

## Verdict Rationale

**PASS WITH NOTES**: The protocols are well-structured and serve distinct purposes. The redundancies identified are minor and don't affect correctness. However, implementing the condensing recommendations could save 200-300 tokens per agent prompt, which compounds across the 11-agent swarm.

## Actionable Items

- [ ] `protocols.ts:378-435` - Condense antiPatterns to terse noun phrases
- [ ] `protocols.ts:278-325` - Consider merging clarification + scopeAssessment
- [ ] `protocols.ts:141-161` - Condense taskHandoff format template
- [ ] `protocols.ts:123-135` - Condense checkpoint to single-line format
- [ ] `protocols.ts:331-343` - Condense reflection to single-line format
- [ ] Consider adding `Protocol.compact` namespace for token-constrained contexts
