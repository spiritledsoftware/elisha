# Context Gathering Strategies

Comprehensive guide to gathering context before acting on tasks.

## Core Principle

Effective agents gather context before acting. The right context sources depend on what tools and agents are available, but the goal is always the same: make informed decisions based on past sessions, existing code, and external knowledge.

## Context Sources

### 1. Memory (Past Sessions)

Use `openmemory*` tools to retrieve relevant past sessions and decisions.

**When to use:**

- Starting a task that may have been discussed before
- Need to understand user preferences or prior decisions
- Looking for context from previous work sessions

**Example queries:**

| Query Type           | Example                                   |
| -------------------- | ----------------------------------------- |
| Feature context      | "authentication implementation decisions" |
| User preferences     | "code style preferences"                  |
| Prior decisions      | "database schema choices"                 |
| Past implementations | "how we handled error logging"            |

### 2. Codebase Exploration

Delegate to `Caleb (explorer)` for finding files, patterns, and project structure.

**When to use:**

- Need to understand existing code patterns
- Looking for files related to a feature
- Mapping dependencies or project structure
- Finding usage examples within the codebase

**Exploration patterns:**

| Goal                   | Exploration Focus                           |
| ---------------------- | ------------------------------------------- |
| Find existing patterns | "Find all implementations of X pattern"     |
| Understand structure   | "Map the directory structure for feature Y" |
| Find dependencies      | "What files import module Z"                |
| Locate related code    | "Find all files related to authentication"  |

**Handoff template for exploration:**

```markdown
OBJECTIVE: [What to find - specific files, patterns, or structure]
CONTEXT: [Why this exploration is needed]
CONSTRAINTS: [Directories to focus on, file types to include/exclude]
SUCCESS: [What the output should contain - file list, pattern summary, etc.]
DEPENDENCIES: None (exploration is typically independent)
```

### 3. External Research

Delegate to `Berean (researcher)` for external documentation, best practices, and examples.

**When to use:**

- Need documentation for a library or framework
- Looking for best practices or patterns
- Researching solutions to a specific problem
- Finding implementation examples from external sources

**Research patterns:**

| Goal                    | Research Focus                        |
| ----------------------- | ------------------------------------- |
| Library documentation   | "How to use library X for Y"          |
| Best practices          | "Current best practices for Z"        |
| Problem solutions       | "How to solve error X in framework Y" |
| Implementation examples | "Examples of implementing pattern Z"  |

**Handoff template for research:**

```markdown
OBJECTIVE: [What information to find]
CONTEXT: [Why this research is needed, what problem it solves]
CONSTRAINTS: [Focus areas, recency requirements, sources to prefer/avoid]
SUCCESS: [Summary format, number of examples, specific details needed]
DEPENDENCIES: None (research is typically independent)
```

### 4. Direct Tool Access (Fallback)

When specialized agents are unavailable, use tools directly:

| Tool        | Purpose                                   |
| ----------- | ----------------------------------------- |
| `exa*`      | Web search for current information        |
| `webfetch`  | Retrieve content from specific URLs       |
| `context7*` | Up-to-date library/package documentation  |
| `grep-app*` | Find relevant code snippets or references |

## Gathering Strategy

### Phase 1: Memory Check

Always start by checking memory for relevant past context:

```typescript
// Search for relevant past sessions
openmemory_search({ query: 'relevant topic or feature' });
```

### Phase 2: Parallel Exploration & Research

Launch independent context-gathering tasks in parallel:

```typescript
// Codebase exploration (async)
elisha_task_create({
  title: 'Find existing patterns',
  agent: 'Caleb (explorer)',
  prompt: '...',
  async: true,
});

// External research (async)
elisha_task_create({
  title: 'Research best practices',
  agent: 'Berean (researcher)',
  prompt: '...',
  async: true,
});
```

### Phase 3: Synthesize

Wait for all context sources and combine:

1. **Collect outputs** from memory, exploration, and research
2. **Identify overlaps** where multiple sources agree
3. **Note conflicts** where sources disagree
4. **Prioritize** codebase patterns over external suggestions (match existing style)

### Phase 4: Act with Context

Use synthesized context to inform decisions:

- Follow existing codebase patterns when they exist
- Apply external best practices where codebase has no precedent
- Reference past decisions when making similar choices

## Context Prioritization

When sources conflict, prioritize in this order:

| Priority | Source              | Rationale                                |
| -------- | ------------------- | ---------------------------------------- |
| 1        | Explicit user input | User knows their requirements best       |
| 2        | Codebase patterns   | Consistency with existing code           |
| 3        | Past session memory | Prior decisions were made for a reason   |
| 4        | External research   | Best practices may not fit this codebase |

## When to Skip Context Gathering

Context gathering can be skipped when:

- Task is fully specified in the handoff with all needed context
- Task is trivial and doesn't require codebase understanding
- Task is a direct follow-up to recent work (context already loaded)
- User explicitly provides all necessary context

## Retry Strategy

When context gathering fails:

| Failure Type      | First Action                       | If Still Fails                 |
| ----------------- | ---------------------------------- | ------------------------------ |
| Memory not found  | Broaden search query               | Proceed without memory context |
| Exploration fails | Try different directories/patterns | Report what was searched       |
| Research fails    | Try alternate search terms         | Note gap in external context   |
| Tool unavailable  | Use fallback tool if available     | Report limitation              |
