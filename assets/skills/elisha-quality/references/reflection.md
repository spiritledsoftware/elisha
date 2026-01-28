# Reflection Protocol

Self-review process to catch errors and improve output quality before finalizing.

## Core Principle

Every output benefits from a moment of reflection. Catching issues before responding is more efficient than fixing them after.

## The Four Questions

Before finalizing any output, answer these questions:

### 1. Re-read the Objective

**Question:** Does my output address what was asked?

| Check                        | How to Verify                           |
| ---------------------------- | --------------------------------------- |
| Understood the request       | Restate the objective in your own words |
| Addressed the core need      | Map output to the original request      |
| Didn't drift off-topic       | Check for tangential content            |
| Answered the actual question | Not a related but different question    |

**Common drift patterns:**

- Answering what you wanted to answer, not what was asked
- Over-explaining context instead of providing the solution
- Solving a related but different problem
- Missing the implicit "why" behind the request

### 2. Check Completeness

**Question:** Did I miss any requirements or edge cases?

| Check                      | How to Verify                          |
| -------------------------- | -------------------------------------- |
| All requirements addressed | List each requirement, verify coverage |
| Edge cases considered      | Think through boundary conditions      |
| Error scenarios handled    | What happens when things go wrong?     |
| Dependencies noted         | Are there prerequisites not mentioned? |

**Completeness checklist:**

- [ ] Every explicit requirement addressed
- [ ] Implicit requirements considered
- [ ] Edge cases identified and handled
- [ ] Error paths documented or implemented
- [ ] Assumptions stated explicitly

### 3. Verify Accuracy

**Question:** Are my claims supported by evidence?

| Check                   | How to Verify                          |
| ----------------------- | -------------------------------------- |
| Facts are correct       | Trace claims to sources                |
| Code actually works     | Verify syntax, logic, types            |
| References are valid    | Check file paths, function names exist |
| No hallucinated details | Distinguish known from assumed         |

**Accuracy red flags:**

- Stating specifics without verification (file paths, function names)
- Confident claims about code not actually read
- Assuming behavior without testing
- Mixing up similar but different concepts

### 4. Assess Quality

**Question:** Would I be satisfied receiving this output?

| Check                    | How to Verify                       |
| ------------------------ | ----------------------------------- |
| Clear and understandable | Read as if seeing it for first time |
| Well-organized           | Logical flow, easy to follow        |
| Appropriate detail level | Not too verbose, not too sparse     |
| Actionable               | Recipient knows what to do next     |

**Quality indicators:**

- Can be understood without re-reading
- Key information is easy to find
- Examples clarify rather than confuse
- Next steps are clear

## Reflection Workflow

```
1. Pause before finalizing
   ↓
2. Re-read the original objective
   ↓
3. Compare output to objective
   ↓
4. Check for missing requirements
   ↓
5. Verify factual claims
   ↓
6. Assess overall quality
   ↓
7. If issues found → Fix before responding
   If uncertain → State uncertainty explicitly
```

## Handling Issues Found

| Issue Type          | Response                                  |
| ------------------- | ----------------------------------------- |
| Missed requirement  | Add the missing content                   |
| Factual error       | Correct it, note the correction           |
| Unclear explanation | Rewrite for clarity                       |
| Missing edge case   | Add handling or note the gap              |
| Uncertainty         | State it explicitly, suggest verification |

## When to Reflect

| Situation                  | Reflection Depth                         |
| -------------------------- | ---------------------------------------- |
| Simple informational query | Quick scan (30 seconds)                  |
| Code implementation        | Full checklist (2-3 minutes)             |
| Complex analysis           | Thorough review (3-5 minutes)            |
| High-stakes output         | Multiple passes, consider second opinion |

## Reflection Template

```markdown
## Self-Review

### Objective Check

- Original request: [Restate in own words]
- Output addresses: [Yes/Partially/No]
- Drift detected: [None/Minor/Significant]

### Completeness Check

- Requirements covered: [List]
- Edge cases considered: [List]
- Gaps identified: [None/List]

### Accuracy Check

- Claims verified: [Yes/Partially]
- Sources: [List evidence]
- Assumptions: [List any]

### Quality Check

- Clarity: [Good/Needs work]
- Organization: [Good/Needs work]
- Actionability: [Good/Needs work]

### Issues to Fix

- [Issue 1]: [Fix]
- [Issue 2]: [Fix]

### Uncertainties to State

- [Uncertainty 1]
- [Uncertainty 2]
```
