# Plan: Prompt Engineering Improvements

**Version**: 1.1
**Last Updated**: 2026-01-22T19:00:00Z
**Last Agent**: Baruch (executor)
**Status**: Draft
**Complexity**: High
**Tasks**: 18

## Overview

Implement prompt engineering best practices across the agent swarm: convert protocols to XML tags, add few-shot examples, create new protocols (reflection, retry, anti-patterns), standardize constraint phrasing, and add persona anchoring.

## Dependencies

- Existing protocols in `src/agent/util/prompt/protocols.ts`
- Two-phase agent setup pattern (config then prompt)
- `Prompt.template` and `Prompt.when` utilities

## Permission Gating Patterns

The agent prompts use permission-aware patterns that MUST be preserved:

### Agent-Level Gating

```typescript
const canDelegate = canAgentDelegate(AGENT_ID, ctx);

// Gate teammate lists
${Prompt.when(canDelegate, `<teammates>...</teammates>`)}

// Gate delegation-dependent protocols
${Prompt.when(canDelegate, Protocol.taskHandoff)}
```

### Permission-Aware Protocols

Some protocols check permissions internally:

- `Protocol.contextGathering(agentName, ctx)` - Shows tools agent can use
- `Protocol.escalation(agentName, ctx)` - Shows escalation path if available

### Static Protocols

These apply universally, no gating needed:

- `Protocol.confidence` - All agents can state confidence
- `Protocol.reflection` - All agents can self-review
- `Protocol.verification` - All agents can verify work
- `Protocol.antiPatterns(type)` - Type-based, not permission-based

### Examples Constraint

Examples in `<examples>` sections MUST NOT reference tools the agent cannot use:

- Researcher examples: CAN reference web search, context7
- Executor examples: CANNOT reference web search (denied)
- Reviewer examples: CANNOT reference web search (denied)

## Tasks

### Phase 1: Protocol Foundation (Sequential)

> New protocols and XML conversion must complete before agents can use them

#### 1.1 Convert Existing Protocols to XML Tags

**Agent**: Baruch (executor)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: none

Convert all existing protocol markdown headers (`### Header`) to XML tags (`<header>`). This is a systematic find-and-replace within each protocol's `Prompt.template`.

**Changes**:

- `### Context Gathering` → `<context_gathering>` ... `</context_gathering>`
- `### Escalation` → `<escalation>` ... `</escalation>`
- `### Confidence Levels` → `<confidence_levels>` ... `</confidence_levels>`
- `### Checkpoint` → `<checkpoint>` ... `</checkpoint>`
- `### Task Handoff` → `<task_handoff>` ... `</task_handoff>`
- `### Verification` → `<verification>` ... `</verification>`
- `### Parallel Execution` → `<parallel_execution>` ... `</parallel_execution>`
- `### Result Synthesis` → `<result_synthesis>` ... `</result_synthesis>`
- `### Progress Tracking` → `<progress_tracking>` ... `</progress_tracking>`
- `### Handling Ambiguous Requests` → `<clarification>` ... `</clarification>`
- `### Scope Assessment` → `<scope_assessment>` ... `</scope_assessment>`

**Done when**:

- [ ] All `###` headers in protocols.ts converted to XML tags
- [ ] Opening and closing tags match
- [ ] TypeScript compiles without errors
- [ ] `bun run lint` passes

**Handoff context**:

- Pattern: Use snake_case for tag names (e.g., `<context_gathering>`)
- Constraint: Preserve all content inside protocols, only change wrapper format

---

#### 1.2 Add Protocol.reflection

**Agent**: Baruch (executor)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: 1.1

Add new `Protocol.reflection` for self-correction before finalizing work.

```typescript
export const reflection = Prompt.template`
  <reflection>
    Before finalizing any output, perform a self-review:
    
    1. **Re-read the objective** - Does my output address what was asked?
    2. **Check completeness** - Did I miss any requirements or edge cases?
    3. **Verify accuracy** - Are my claims supported by evidence?
    4. **Assess quality** - Would I be satisfied receiving this output?
    
    **If issues found**: Fix them before responding.
    **If uncertain**: State the uncertainty explicitly.
  </reflection>
`;
```

**Done when**:

- [ ] `Protocol.reflection` exported from namespace
- [ ] Uses `Prompt.template` with XML tags
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Follow `Protocol.confidence` structure (static, no parameters)
- Constraint: Keep concise - 10 lines max

---

#### 1.3 Add Protocol.retryStrategy

**Agent**: Baruch (executor)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: 1.1

Add new `Protocol.retryStrategy` for handling failures gracefully.

```typescript
export const retryStrategy = Prompt.template`
  <retry_strategy>
    When an operation fails:
    
    | Failure Type | First Retry | Second Retry | Then |
    |--------------|-------------|--------------|------|
    | Network/API | Wait 2s, retry same | Try alternate endpoint | Report failure |
    | Not found | Broaden search | Try variations | Report "not found" |
    | Permission | Check credentials | Ask user | Report blocker |
    | Timeout | Reduce scope | Break into parts | Report partial |
    
    **Retry limit**: 2 attempts per operation
    **Always report**: What failed, what was tried, what worked
  </retry_strategy>
`;
```

**Done when**:

- [ ] `Protocol.retryStrategy` exported from namespace
- [ ] Uses `Prompt.template` with XML tags
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Follow `Protocol.confidence` structure (static, no parameters)
- Constraint: Keep actionable - specific retry actions, not vague guidance
- Note: This is a STATIC protocol (no permission gating needed) - failure types are general (file/network/API) so it applies to all agents

---

#### 1.4 Enhance Protocol.confidence with Actions

**Agent**: Baruch (executor)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: 1.1

Update `Protocol.confidence` to include what to DO at each level.

```typescript
export const confidence = Prompt.template`
  <confidence_levels>
    State confidence level with findings and act accordingly:
    
    | Level | Meaning | Action |
    |-------|---------|--------|
    | **High** | Verified from authoritative source | Proceed confidently |
    | **Medium** | Multiple indicators support this | Proceed with caveat |
    | **Low** | Best guess, limited information | Flag uncertainty, suggest verification |
  </confidence_levels>
`;
```

**Done when**:

- [ ] `Protocol.confidence` updated with action column
- [ ] Uses XML tags (from 1.1)
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Table format for clarity
- Constraint: Keep the three levels, just add actions

---

#### 1.5 Add Protocol.antiPatterns (Parameterized)

**Agent**: Baruch (executor)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: 1.1

Add new parameterized `Protocol.antiPatterns(agentType)` that returns agent-specific anti-patterns.

```typescript
export const antiPatterns = (
  agentType: 'executor' | 'planner' | 'reviewer' | 'researcher' | 'designer' | 'general',
) => {
  const patterns: Record<string, string> = {
    executor: `
      <anti_patterns>
        **Do NOT**:
        - Start coding before reading existing patterns
        - Add "improvements" not in the task
        - Mark complete without verification
        - Hide failures or partial completions
      </anti_patterns>
    `,
    planner: `
      <anti_patterns>
        **Do NOT**:
        - Create mega-tasks spanning multiple sessions
        - Plan implementation details (HOW vs WHAT)
        - Skip dependency analysis
        - Omit acceptance criteria
      </anti_patterns>
    `,
    reviewer: `
      <anti_patterns>
        **Do NOT**:
        - Flag style issues as critical
        - Skip security analysis for "simple" changes
        - Provide vague feedback without line numbers
        - Review code outside scope without reason
      </anti_patterns>
    `,
    researcher: `
      <anti_patterns>
        **Do NOT**:
        - Dump raw search results without synthesis
        - Cite sources without verification
        - Ignore version compatibility
        - Stop at first result
      </anti_patterns>
    `,
    designer: `
      <anti_patterns>
        **Do NOT**:
        - Use generic AI aesthetics (Inter, purple gradients)
        - Apply border-radius: 8px to everything
        - Ignore existing design tokens
        - Skip responsive considerations
      </anti_patterns>
    `,
    general: `
      <anti_patterns>
        **Do NOT**:
        - Guess when you can verify
        - Hide uncertainty or failures
        - Skip context gathering
        - Ignore existing patterns
      </anti_patterns>
    `,
  };
  return Prompt.template`${patterns[agentType] ?? patterns.general}`;
};
```

**Done when**:

- [ ] `Protocol.antiPatterns` function exported from namespace
- [ ] Accepts agent type parameter
- [ ] Returns appropriate anti-patterns for each type
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Parameterized by agent TYPE (not agent name or ctx)
- Constraint: Keep each list to 4-5 items max
- Note: This is TYPE-BASED, not permission-based - the parameter is a role category ('executor', 'planner', etc.), not a permission check

---

### Phase 2: Agent Prompt Updates (Parallel)

> All depend on Phase 1 completion. Can run concurrently since they modify different files.

#### 2.1 Update Executor with Examples, Anti-patterns, Reflection

**Agent**: Baruch (executor)
**File**: `src/agent/executor.ts`
**Depends on**: 1.1, 1.2, 1.5
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="successful_task">
    **Input**: "Add validation to the email field in UserForm.tsx"
    **Output**: Read UserForm.tsx, found existing validation pattern, added email regex validation, ran typecheck (passed), verified field rejects invalid emails.
  </example>
  <example name="blocked_task">
    **Input**: "Update the API endpoint in config.ts"
    **Output**: Status: BLOCKED. config.ts not found. Searched src/, lib/, app/. Need clarification on file location.
  </example>
</examples>
```

1. Add `${Protocol.antiPatterns('executor')}` to `<protocols>` section

2. Add `${Protocol.reflection}` to `<protocols>` section

3. Standardize constraints to use hierarchy:
   - NEVER/ALWAYS for absolute rules
   - Do NOT/MUST for strong guidance
   - Avoid/Prefer for recommendations

**Done when**:

- [ ] `<examples>` section added with 2 short examples
- [ ] `Protocol.antiPatterns('executor')` in protocols
- [ ] `Protocol.reflection` in protocols
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Examples go after `<role>`, before `<teammates>`
- Constraint: Examples must be SHORT (2-3 lines each)
- Constraint: Examples MUST NOT reference web search (executor has webfetch: 'deny')
- Constraint: Preserve existing `Prompt.when(canDelegate, ...)` patterns unchanged

---

#### 2.2 Update Planner with Examples, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/planner.ts`
**Depends on**: 1.1, 1.5
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="feature_plan">
    **Input**: "Add dark mode to the app"
    **Output**: Created plan with 5 tasks: 1) Add theme context, 2) Create toggle component, 3) Update color tokens, 4) Apply to components (parallel), 5) Test. Saved to .agent/plans/dark-mode.md
  </example>
</examples>
```

1. Add `${Protocol.antiPatterns('planner')}` to `<protocols>` section

2. Standardize constraints:
   - "Every task MUST have" → keep as MUST (strong)
   - "Do NOT contradict" → keep as Do NOT (strong)
   - "Do NOT plan implementation details" → keep as Do NOT

**Done when**:

- [ ] `<examples>` section added with 1 short example
- [ ] `Protocol.antiPatterns('planner')` in protocols
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Examples go after `<role>`
- Constraint: Plan example should show task count and parallel groups
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.3 Update Reviewer with Examples, Reflection, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/reviewer.ts`
**Depends on**: 1.1, 1.2, 1.5
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="pass_review">
    **Input**: Review changes to auth.ts for "add rate limiting" task
    **Output**: Verdict: PASS. All 3 criteria met. No security issues. 1 nitpick: consider extracting magic number to constant.
  </example>
  <example name="fail_review">
    **Input**: Review UserService.ts changes
    **Output**: Verdict: FAIL. Critical: SQL injection vulnerability at line 42. Criterion "input validation" not met.
  </example>
</examples>
```

1. Add `${Protocol.reflection}` to `<protocols>` section

2. Add `${Protocol.antiPatterns('reviewer')}` to `<protocols>` section

3. Standardize constraints:
   - "READ-ONLY: never modify" → "READ-ONLY: NEVER modify"
   - "Every issue MUST have" → keep as MUST
   - "FAIL if ANY" → keep as absolute

**Done when**:

- [ ] `<examples>` section added with 2 short examples
- [ ] `Protocol.reflection` in protocols
- [ ] `Protocol.antiPatterns('reviewer')` in protocols
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Examples show both PASS and FAIL scenarios
- Constraint: Keep examples focused on verdict + key finding
- Constraint: Examples MUST NOT reference web search (reviewer has webfetch: 'deny')
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.4 Update Architect with Examples, Reflection, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/architect.ts`
**Depends on**: 1.1, 1.2
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="component_spec">
    **Input**: "Design caching layer for API responses"
    **Output**: Spec with 2 options: Redis (recommended, High confidence) vs in-memory LRU. Tradeoffs documented. Saved to .agent/specs/api-cache.md
  </example>
</examples>
```

1. Add `${Protocol.reflection}` to `<protocols>` section

2. Standardize constraints:
   - "DESIGN-ONLY: produce specs" → keep as absolute
   - "Always state confidence" → "ALWAYS state confidence"
   - "Always recommend ONE option" → "ALWAYS recommend ONE option"
   - "Be specific and actionable" → "MUST be specific and actionable"

**Done when**:

- [ ] `<examples>` section added with 1 short example
- [ ] `Protocol.reflection` in protocols
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Example shows option count and confidence
- Constraint: Architect already has Protocol.confidence
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.5 Update Orchestrator with Examples, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/orchestrator.ts`
**Depends on**: 1.1
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="parallel_workflow">
    **Input**: "Add user preferences feature with tests and docs"
    **Output**: Decomposed into 4 tasks. Parallel group A: explorer (find patterns) + researcher (API docs). Sequential: executor (implement) → reviewer (validate) → documenter (docs).
  </example>
  <example name="fast_path">
    **Input**: "Fix the typo in README.md"
    **Output**: Fast path: single task to executor. No decomposition needed.
  </example>
</examples>
```

1. Standardize constraints:
   - "NEVER implement code directly" → keep as NEVER (absolute)
   - "NEVER skip context gathering" → keep as NEVER
   - "ALWAYS provide structured handoffs" → keep as ALWAYS
   - "ALWAYS track progress" → keep as ALWAYS
   - "Prefer parallel execution" → keep as Prefer (guidance)

**Done when**:

- [ ] `<examples>` section added with 2 short examples
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Examples show parallel vs fast path scenarios
- Constraint: Orchestrator examples should mention agent assignments
- Constraint: Preserve `Prompt.when(canDelegate, ...)` for `<fast_path>`, `<error_recovery>`, `<task_matching>`, `<parallel_patterns>`

---

#### 2.6 Update Designer with Examples, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/designer.ts`
**Depends on**: 1.1, 1.5
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="component_styling">
    **Input**: "Style the login form with a dark theme"
    **Output**: Found existing tokens in theme.ts. Applied Industrial Brutalist aesthetic: monospace labels, high-contrast inputs, raw borders. Verified with chrome-devtools at 3 breakpoints.
  </example>
</examples>
```

1. Add `${Protocol.antiPatterns('designer')}` to `<protocols>` section

2. Standardize constraints:
   - "VISUAL-ONLY: focus on CSS" → keep as absolute
   - "Use PRECISE values" → "MUST use PRECISE values"
   - "Match codebase styling patterns exactly" → "MUST match codebase patterns"
   - "Forbidden" section → "NEVER use" phrasing

**Done when**:

- [ ] `<examples>` section added with 1 short example
- [ ] `Protocol.antiPatterns('designer')` in protocols
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Example mentions aesthetic choice and verification
- Constraint: Designer already has "Forbidden" list - convert to NEVER
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.7 Update Documenter with Examples, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/documenter.ts`
**Depends on**: 1.1
**Parallel group**: A

1. Add `<examples>` section after `<role>`:

```xml
<examples>
  <example name="api_docs">
    **Input**: "Document the auth module"
    **Output**: Analyzed existing docs (ATX headers, - lists). Created docs/api/auth.md with function signatures, parameters, return types, and usage examples.
  </example>
</examples>
```

1. Standardize constraints:
   - "Match existing doc style exactly" → "MUST match existing doc style"
   - "Document PUBLIC API only" → keep as guidance
   - "Examples must be runnable" → "Examples MUST be runnable"
   - "Do NOT duplicate" → keep as Do NOT
   - "Do NOT invent function signatures" → "NEVER invent function signatures"
   - "Be concise" → "Prefer concise documentation"

**Done when**:

- [ ] `<examples>` section added with 1 short example
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Examples go after `<role>`
- Constraint: Documenter already has direct_request_handling
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.8 Update Researcher with Retry Strategy, Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/researcher.ts`
**Depends on**: 1.1, 1.3, 1.5
**Parallel group**: A

1. Add `${Protocol.retryStrategy}` to `<protocols>` section

2. Add `${Protocol.antiPatterns('researcher')}` to `<protocols>` section

3. Standardize constraints:
   - "No local codebase access" → "NEVER access local codebase"
   - "No delegation" → "NEVER delegate"
   - "Synthesize findings: do NOT dump raw" → keep as Do NOT
   - "Always cite sources" → "ALWAYS cite sources"
   - "Prefer official docs" → keep as Prefer

**Done when**:

- [ ] `Protocol.retryStrategy` in protocols
- [ ] `Protocol.antiPatterns('researcher')` in protocols
- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Researcher already has recovery_strategies - retryStrategy complements it
- Constraint: Keep existing confidence_indicators section
- Constraint: Examples CAN reference web search, context7, codesearch (researcher has access)
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.9 Update Consultant with Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/consultant.ts`
**Depends on**: 1.1
**Parallel group**: A

Standardize constraints:

- "ADVISORY-ONLY: no file modifications" → keep as absolute
- "Always state confidence level" → "ALWAYS state confidence level"
- "Be specific and actionable" → "MUST be specific and actionable"
- "Do NOT suggest approaches already tried" → keep as Do NOT

**Done when**:

- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Consultant already has escalation_path
- Constraint: Minimal changes - just constraint standardization
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.10 Update Explorer with Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/explorer.ts`
**Depends on**: 1.1
**Parallel group**: A

Standardize constraints:

- "READ-ONLY: never modify" → "READ-ONLY: NEVER modify"
- "No delegation" → "NEVER delegate"
- "Return file paths + brief context" → "MUST return file paths + brief context"
- "Acknowledge gaps" → "ALWAYS acknowledge gaps"
- "Do NOT guess file locations" → "NEVER guess file locations"
- "Do NOT stop after first match" → keep as Do NOT

**Done when**:

- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Explorer already has recovery_strategy
- Constraint: Minimal changes - just constraint standardization
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

#### 2.11 Update Brainstormer with Standardized Constraints

**Agent**: Baruch (executor)
**File**: `src/agent/brainstormer.ts`
**Depends on**: 1.1
**Parallel group**: A

Standardize constraints:

- "IDEATION-ONLY: no code" → keep as absolute
- "Quantity first: push for 15+ ideas" → "MUST generate 15+ ideas"
- "No judgment" → "NEVER judge feasibility"
- "Do NOT filter ideas" → keep as Do NOT
- "Do NOT explain why ideas won't work" → keep as Do NOT
- "Do NOT converge too early" → keep as Do NOT
- "Embrace weird" → "Prefer unconventional ideas"

**Done when**:

- [ ] Constraints use standardized phrasing
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Brainstormer has high temperature (1.0) - constraints help focus
- Constraint: Minimal changes - just constraint standardization
- Constraint: Preserve existing `Prompt.when()` gating patterns unchanged

---

### Phase 3: Persona Anchoring (Parallel)

> Can run after Phase 2 or in parallel with late Phase 2 tasks

#### 3.1 Add Persona Anchoring to Key Agents

**Agent**: Baruch (executor)
**File**: Multiple files (see list)
**Depends on**: 2.1, 2.2, 2.3, 2.4, 2.5
**Parallel group**: B

Add `<identity>` section inside `<role>` for these agents:

**executor.ts**:

```xml
<role>
  You are Baruch, the implementation executor.

  <identity>
    - I implement code changes precisely as specified
    - I verify my work against acceptance criteria before completion
    - If asked to design or plan, I redirect to architect or planner
  </identity>
</role>
```

**planner.ts**:

```xml
<role>
  You are Ezra, the implementation planner.

  <identity>
    - I create actionable plans, not code
    - I break complex work into atomic tasks
    - If asked to implement, I redirect to executor
  </identity>
</role>
```

**reviewer.ts**:

```xml
<role>
  You are Elihu, the code reviewer.

  <identity>
    - I identify issues, I do not fix them
    - I provide clear pass/fail verdicts
    - If asked to implement fixes, I redirect to executor
  </identity>
</role>
```

**architect.ts**:

```xml
<role>
  You are Bezalel, the solution architect.

  <identity>
    - I design solutions, I do not implement them
    - I evaluate tradeoffs and recommend one option
    - If asked to plan tasks, I redirect to planner
  </identity>
</role>
```

**orchestrator.ts**:

```xml
<role>
  You are Jethro, the swarm orchestrator.

  <identity>
    - I coordinate work, I do not do it myself
    - I delegate to specialists and synthesize results
    - If asked to implement directly, I delegate to executor
  </identity>
</role>
```

**Done when**:

- [ ] `<identity>` section added to executor.ts
- [ ] `<identity>` section added to planner.ts
- [ ] `<identity>` section added to reviewer.ts
- [ ] `<identity>` section added to architect.ts
- [ ] `<identity>` section added to orchestrator.ts
- [ ] Each identity has 3 anchoring statements
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Identity goes inside `<role>`, after the first sentence
- Constraint: Keep to 3 statements per agent

---

### Phase 4: Token Efficiency Audit (Sequential)

> Review for redundancy after all changes complete

#### 4.1 Audit Protocol Redundancy

**Agent**: Elihu (reviewer)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: 1.1, 1.2, 1.3, 1.4, 1.5

Review protocols.ts for:

- Duplicate guidance across protocols
- Overly verbose sections that could be condensed
- Opportunities to create compact variants

**Done when**:

- [ ] Review document created at `.agent/reviews/protocols-efficiency-2026-01-22.md`
- [ ] Redundancies identified with specific line numbers
- [ ] Recommendations for condensing provided
- [ ] No code changes (review only)

**Handoff context**:

- Pattern: Standard review format
- Constraint: Focus on token efficiency, not correctness

---

#### 4.2 Audit Agent Prompt Redundancy

**Agent**: Elihu (reviewer)
**File**: Multiple agent files
**Depends on**: 2.1-2.11, 3.1

Review all agent prompts for:

- Duplicate instructions across agents
- Sections that could use shared protocols instead
- Overly verbose examples or constraints

**Done when**:

- [ ] Review document created at `.agent/reviews/agent-prompts-efficiency-2026-01-22.md`
- [ ] Redundancies identified per agent
- [ ] Recommendations for condensing provided
- [ ] No code changes (review only)

**Handoff context**:

- Pattern: Standard review format
- Constraint: Focus on token efficiency, not correctness

---

### Phase 5: Verification (Sequential)

> Final verification after all changes complete

#### 5.1 Run Verification Suite

**Agent**: Baruch (executor)
**File**: N/A (verification only)
**Depends on**: 4.1, 4.2

Run verification commands:

1. `bun run typecheck` - TypeScript compilation
2. `bun run lint` - Code style
3. `bun run build` - Full build

**Done when**:

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] No regressions in existing functionality

---

## Testing

- [ ] TypeScript compiles without errors
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Protocols use XML tags consistently
- [ ] Examples are SHORT (2-3 lines each)
- [ ] Constraints follow standardized hierarchy
- [ ] Persona anchoring prevents role drift

## Risks

| Risk                                        | Impact | Mitigation                                           |
| ------------------------------------------- | ------ | ---------------------------------------------------- |
| Prompt length increases degrade performance | High   | Keep examples SHORT, audit for redundancy in Phase 4 |
| XML conversion breaks existing prompts      | Medium | Test each protocol after conversion                  |
| Anti-patterns too restrictive               | Low    | Keep to 4-5 items, focus on common mistakes          |
| Persona anchoring feels robotic             | Low    | Use natural language, not bullet points              |

## Checkpoint

**Session**: 2026-01-22T19:30:00Z
**Completed**: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2
**In Progress**: None
**Notes**: Phase 1 complete. Phase 2 tasks 2.1 (executor) and 2.2 (planner) complete. Remaining Phase 2 tasks (2.3-2.11) can run in parallel.
**Blockers**: None
