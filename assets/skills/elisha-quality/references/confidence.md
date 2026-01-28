# Confidence Levels Protocol

Standard confidence levels for stating findings and recommendations with appropriate certainty.

## Core Principle

Always state confidence level with findings. This helps recipients understand how much to trust the information and whether additional verification is needed.

## Confidence Levels

| Level      | Meaning                            | Evidence Required                           |
| ---------- | ---------------------------------- | ------------------------------------------- |
| **High**   | Verified from authoritative source | Direct observation, official docs, tests    |
| **Medium** | Multiple indicators support this   | Consistent patterns, reasonable inference   |
| **Low**    | Best guess, limited information    | Single indicator, extrapolation, assumption |

## Recommended Actions by Level

| Level      | Action                            | Communication                             |
| ---------- | --------------------------------- | ----------------------------------------- |
| **High**   | Proceed confidently               | State as fact                             |
| **Medium** | Proceed, note uncertainty         | "This appears to be..." or "Based on..."  |
| **Low**    | State assumptions, suggest verify | "I believe... but recommend verifying..." |

## Determining Confidence Level

### High Confidence Indicators

The finding is **High** confidence when:

- Directly observed in code or documentation
- Verified by running tests or commands
- Confirmed by official/authoritative source
- Multiple independent sources agree
- Behavior tested and confirmed

**Examples:**

- "The function returns a Promise (verified in source code)"
- "Tests pass (ran `bun test`, all 47 passed)"
- "API endpoint is `/v2/users` (confirmed in OpenAPI spec)"

### Medium Confidence Indicators

The finding is **Medium** confidence when:

- Inferred from consistent patterns
- Based on documentation that may be outdated
- Supported by multiple but not definitive indicators
- Follows from reasonable assumptions
- Similar to verified cases

**Examples:**

- "This likely uses the same pattern as other services (based on codebase conventions)"
- "The timeout appears to be 30 seconds (based on config file, not tested)"
- "This should work with the existing auth (follows same pattern as other endpoints)"

### Low Confidence Indicators

The finding is **Low** confidence when:

- Based on a single indicator
- Extrapolated from limited information
- Relies on assumptions that may not hold
- No direct verification possible
- Contradictory signals present

**Examples:**

- "I believe this is the correct approach, but I haven't found documentation"
- "This might be the issue, based on the error message pattern"
- "Assuming the API follows REST conventions, the endpoint would be..."

## Confidence in Different Contexts

### Code Analysis

| Claim Type         | High                    | Medium                  | Low                     |
| ------------------ | ----------------------- | ----------------------- | ----------------------- |
| Function behavior  | Read the implementation | Inferred from name/docs | Guessed from context    |
| File location      | Found via search        | Pattern-based guess     | Assumed from convention |
| Dependency version | Read package.json       | Inferred from lockfile  | Assumed from error      |

### Recommendations

| Recommendation Type     | High                       | Medium                 | Low                  |
| ----------------------- | -------------------------- | ---------------------- | -------------------- |
| Bug fix                 | Tested and verified        | Addresses likely cause | Might help           |
| Architecture decision   | Proven pattern in codebase | Common best practice   | Theoretical benefit  |
| Performance improvement | Benchmarked                | Expected from theory   | Possible improvement |

### Research Findings

| Finding Type  | High                           | Medium                | Low                    |
| ------------- | ------------------------------ | --------------------- | ---------------------- |
| API behavior  | Official documentation         | Community examples    | Inferred from errors   |
| Library usage | Verified in source             | README examples       | Stack Overflow answers |
| Best practice | Multiple authoritative sources | Single expert opinion | Personal preference    |

## Stating Confidence

### Format

Always include:

1. The finding or claim
2. The confidence level
3. The basis for that confidence

**Template:**

```
[Finding]. Confidence: [High/Medium/Low] - [Basis].
```

**Examples:**

```
The API rate limit is 100 requests/minute. Confidence: High - verified in API documentation.

This appears to be a caching issue. Confidence: Medium - symptoms match known caching problems, but not directly verified.

The migration might require downtime. Confidence: Low - based on similar migrations, but this codebase may differ.
```

### In Reports

```markdown
## Findings

### [Finding 1]

**Confidence**: High
**Basis**: [Evidence]
**Details**: [Explanation]

### [Finding 2]

**Confidence**: Medium
**Basis**: [Evidence]
**Uncertainty**: [What's not certain]
**Details**: [Explanation]

### [Finding 3]

**Confidence**: Low
**Basis**: [Limited evidence]
**Assumptions**: [What's assumed]
**Verification needed**: [How to confirm]
**Details**: [Explanation]
```

## Common Mistakes

| Mistake                               | Fix                                        |
| ------------------------------------- | ------------------------------------------ |
| Stating Low confidence as fact        | Use hedging language, suggest verification |
| Over-confidence without evidence      | Downgrade to Medium, note missing evidence |
| Under-confidence despite verification | Upgrade to High, cite the verification     |
| No confidence level stated            | Always include level and basis             |
| Vague basis ("I think...")            | Specific basis ("Based on line 42...")     |
