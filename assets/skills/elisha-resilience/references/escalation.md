# Escalation Protocol

When to escalate blockers and how to request specialized assistance.

## Core Principle

Escalation is not failure—it's efficient resource allocation. Agents should escalate when:

1. Retry attempts are exhausted (2 attempts)
2. The problem requires specialized expertise
3. Continuing would waste effort without progress

## When to Escalate

| Situation                              | Escalate? | Reasoning                         |
| -------------------------------------- | --------- | --------------------------------- |
| First failure                          | No        | Try alternative approach first    |
| Second failure with different approach | Yes       | Retry limit reached               |
| Problem outside agent's expertise      | Yes       | Specialist will be more efficient |
| Blocker with no clear resolution       | Yes       | Fresh perspective needed          |
| User explicitly requests help          | Yes       | User knows they need assistance   |
| Simple error with obvious fix          | No        | Handle directly                   |

## Escalation Decision Tree

```
Problem encountered
│
├── Is this within my expertise?
│   ├── No → Escalate immediately
│   └── Yes → Continue
│
├── Have I tried an alternative approach?
│   ├── No → Try alternative (retry 1)
│   └── Yes → Continue
│
├── Did the alternative work?
│   ├── Yes → Problem solved, no escalation
│   └── No → Continue
│
├── Have I reached retry limit (2)?
│   ├── No → Try another alternative (retry 2)
│   └── Yes → Escalate
│
└── Escalate to Ahithopel (consultant)
```

## How to Escalate

Escalation uses the standard task delegation format with emphasis on what was already tried:

```typescript
elisha_task_create({
  title: '[Problem summary]',
  agent: 'Ahithopel (consultant)',
  prompt: `
    OBJECTIVE: [What needs to be resolved]
    
    CONTEXT:
    - Problem: [Detailed description]
    - Environment: [Relevant system/codebase info]
    - Error messages: [Exact errors if applicable]
    
    CONSTRAINTS:
    - [Any limitations on solutions]
    
    SUCCESS:
    - [ ] Root cause identified
    - [ ] Resolution path recommended
    
    DEPENDENCIES:
    - Attempted approaches:
      1. [First approach] → [Result]
      2. [Second approach] → [Result]
  `,
  async: false,
});
```

## Escalation Context Requirements

Every escalation must include:

| Element             | Purpose                | Example                                               |
| ------------------- | ---------------------- | ----------------------------------------------------- |
| **Problem summary** | Quick understanding    | "Authentication failing after token refresh"          |
| **What was tried**  | Avoid duplicate effort | "Checked token expiry, verified credentials"          |
| **Error details**   | Enable diagnosis       | Stack trace, error codes, log excerpts                |
| **Environment**     | Context for solution   | "Node 18, production, AWS Lambda"                     |
| **Constraints**     | Limit solution space   | "Cannot restart service, must be backward compatible" |

## Escalation Examples

### Example 1: Debugging Blocker

```
OBJECTIVE: Identify root cause of intermittent test failures.

CONTEXT:
- Problem: Tests pass locally but fail 30% of time in CI
- Environment: Jest, GitHub Actions, Node 18
- Error: "Connection refused" on database calls
- Pattern: Failures cluster in parallel test runs

CONSTRAINTS:
- Cannot modify CI infrastructure
- Tests must remain parallelized for speed

SUCCESS:
- [ ] Root cause identified
- [ ] Fix recommendation provided

DEPENDENCIES:
- Attempted approaches:
  1. Added retry logic to DB connections → Still failing
  2. Increased connection pool size → No improvement
```

### Example 2: Architecture Question

```
OBJECTIVE: Recommend approach for real-time updates.

CONTEXT:
- Problem: Need to push updates to 10K concurrent users
- Current: REST polling every 5 seconds
- Requirements: < 1 second latency, minimal server load

CONSTRAINTS:
- Must work behind corporate proxies
- Budget for managed services limited

SUCCESS:
- [ ] Recommended architecture with tradeoffs
- [ ] Implementation approach outlined

DEPENDENCIES:
- Considered approaches:
  1. WebSockets → Proxy compatibility concerns
  2. Server-Sent Events → Simpler but one-way only
```

## After Escalation

When receiving consultant response:

1. **Validate understanding**: Ensure the recommendation makes sense
2. **Apply recommendation**: Implement the suggested fix
3. **Verify resolution**: Confirm the problem is solved
4. **Document learning**: Update AGENTS.md if broadly applicable

## Escalation Anti-Patterns

| Anti-Pattern                   | Why It's Wrong                       | Correct Approach                      |
| ------------------------------ | ------------------------------------ | ------------------------------------- |
| Escalate on first failure      | Misses easy self-resolution          | Try at least one alternative first    |
| Escalate without context       | Consultant lacks info to help        | Include all required context elements |
| Escalate vague problems        | "It doesn't work" is not actionable  | Be specific about symptoms and errors |
| Skip escalation, keep retrying | Wastes effort after retry limit      | Escalate after 2 failed attempts      |
| Escalate user-facing questions | Consultant is for technical blockers | Ask user directly for clarification   |

## Agents That Can Escalate

All agents can escalate to `Ahithopel (consultant)` when:

- They have delegation capability (`canDelegate: true`)
- The consultant agent is enabled
- They've exhausted their retry attempts

Agents without delegation capability should report the blocker in their output for the orchestrator to handle.
