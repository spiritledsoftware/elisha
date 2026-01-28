---
name: elisha-context
description: Use when gathering context before acting, maintaining AGENTS.md knowledge files, or deciding what information sources to consult for a task.
---

# Context Gathering & Knowledge Maintenance

## Overview

Effective agents gather context before acting and maintain knowledge for future agents. Context gathering ensures informed decisions; AGENTS.md maintenance captures discoveries that prevent repeated mistakes.

## When to Use

**Triggering conditions:**

- Starting a new task that requires understanding existing code or patterns
- Need to find relevant past sessions or decisions
- Searching for files, patterns, or external documentation
- Discovered knowledge that would help future agents
- Encountered a gotcha or non-obvious convention

**Don't use for:**

- Tasks where context is already fully provided in the handoff
- Trivial operations that don't require codebase understanding
- Generic programming knowledge (agents already know this)

## Quick Reference

| Context Source | Tool/Agent            | Use Case                                 |
| -------------- | --------------------- | ---------------------------------------- |
| Past sessions  | `openmemory*` tools   | Prior decisions, user preferences        |
| Codebase files | `Caleb (explorer)`    | Find files, patterns, project structure  |
| External docs  | `Berean (researcher)` | Library docs, best practices, examples   |
| Web search     | `exa*` tools          | Current information, recent developments |
| Specific URLs  | `webfetch` tool       | Retrieve content from known URLs         |
| Library docs   | `context7*` tools     | Up-to-date package documentation         |
| Code snippets  | `grep-app*` tools     | Find relevant code references            |

## Context Gathering Strategy

Before acting on any non-trivial task:

1. **Check memory** - Use `openmemory*` tools for relevant past sessions
2. **Explore codebase** - Delegate to `Caleb (explorer)` for files and patterns
3. **Research externally** - Delegate to `Berean (researcher)` for documentation

See [references/context-gathering.md](references/context-gathering.md) for detailed strategies.

## AGENTS.md Maintenance

Update AGENTS.md when discovering knowledge that helps future agents:

| Update Trigger                  | Example                                               |
| ------------------------------- | ----------------------------------------------------- |
| Discovered undocumented pattern | "Services always use dependency injection"            |
| Learned from a mistake          | "Don't import X directly, use re-export from Y"       |
| Found non-obvious convention    | "Test files must end with `.spec.ts`, not `.test.ts`" |
| Encountered time-wasting gotcha | "Build must run before tests"                         |
| Identified critical constraint  | "Never modify files in `generated/`"                  |

See [references/agents-md.md](references/agents-md.md) for maintenance guidelines.

## What NOT to Add to AGENTS.md

| Don't Add                  | Why                                 | Alternative                    |
| -------------------------- | ----------------------------------- | ------------------------------ |
| Generic programming advice | Agents already know this            | Skip entirely                  |
| One-off debugging notes    | Session-specific, not reusable      | Use memory tools               |
| Info already in README     | Avoid duplication                   | Reference existing docs        |
| Speculative patterns       | Only document confirmed conventions | Wait until pattern is verified |

## Complete Example

**Scenario**: Agent needs to implement a new API endpoint.

```
# Step 1: Gather Context

## Check memory for prior decisions
openmemory_search({ query: "API endpoint patterns" })

## Explore codebase for existing patterns
elisha_task_create({
  title: "Find API endpoint patterns",
  agent: "Caleb (explorer)",
  prompt: `
    OBJECTIVE: Find all existing API endpoint implementations.
    CONTEXT: Need to understand patterns before adding new endpoint.
    CONSTRAINTS: Focus on src/api and src/routes directories.
    SUCCESS: List of files with endpoints, grouped by pattern used.
    DEPENDENCIES: None.
  `,
  async: false
})

## Research external best practices if needed
elisha_task_create({
  title: "Research REST API best practices",
  agent: "Berean (researcher)",
  prompt: `
    OBJECTIVE: Find current best practices for REST API design.
    CONTEXT: Building a new endpoint for user management.
    CONSTRAINTS: Focus on error handling and validation patterns.
    SUCCESS: Summary of 3-5 patterns with code examples.
    DEPENDENCIES: None.
  `,
  async: true
})

# Step 2: Synthesize and Act

[Use gathered context to implement the endpoint]

# Step 3: Maintain Knowledge

## If discovered a non-obvious pattern during implementation:
elisha_task_create({
  title: "Update AGENTS.md with API pattern",
  agent: "Luke (documenter)",
  prompt: `
    OBJECTIVE: Add discovered API pattern to AGENTS.md.
    CONTEXT: Found that all endpoints must use validateRequest middleware.
    CONSTRAINTS: Keep concise, add to existing patterns section.
    SUCCESS: AGENTS.md updated with new pattern.
    DEPENDENCIES: None.
  `,
  async: false
})
```

**Key patterns demonstrated:**

1. **Memory first**: Check past sessions for relevant decisions
2. **Parallel research**: Codebase exploration and external research can run together
3. **Synthesize before acting**: Combine context sources before implementation
4. **Maintain knowledge**: Capture discoveries for future agents

## Common Mistakes

| Mistake                                 | Fix                                                |
| --------------------------------------- | -------------------------------------------------- |
| Acting without gathering context        | Always check memory and explore codebase first     |
| Adding generic advice to AGENTS.md      | Only add project-specific, non-obvious discoveries |
| Duplicating README content in AGENTS.md | Reference existing docs instead                    |
| Not delegating exploration/research     | Use specialized agents for better results          |
| Adding speculative patterns             | Wait until pattern is confirmed through use        |
| Forgetting to check memory              | Start with `openmemory*` tools for past context    |

## Validation Checklist

- [ ] Checked memory for relevant past sessions
- [ ] Explored codebase for existing patterns
- [ ] Researched external sources when needed
- [ ] Synthesized context before acting
- [ ] Captured non-obvious discoveries in AGENTS.md
- [ ] Avoided adding generic or speculative content
