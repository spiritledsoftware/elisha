# Spec: Agent Swarm Improvements

**Version**: 1.0
**Last Updated**: 2026-01-22T12:00:00Z
**Last Agent**: architect
**Status**: Draft
**Scope**: system

## Executive Summary

This specification addresses critical gaps in the agent swarm that prevent `mode: 'all'` agents from operating independently when users interact with them directly. Currently, these agents are optimized for structured handoffs from the orchestrator but lack guidance for handling raw user requests, asking clarifying questions, and operating without pre-existing context.

## Requirements

### Functional Requirements

1. **FR-1**: All `mode: 'all'` agents MUST handle direct user requests without structured handoffs
2. **FR-2**: Agents MUST ask clarifying questions when requests are ambiguous
3. **FR-3**: The swarm MUST handle simple questions without over-delegation
4. **FR-4**: Changes MUST be backward compatible - structured handoffs continue to work
5. **FR-5**: Protocol coverage MUST be consistent across agents
6. **FR-6**: Temperature settings MUST match agent roles (lower for deterministic tasks)

### Non-Functional Requirements

1. **NFR-1**: Prompts must remain concise - agents have limited context windows
2. **NFR-2**: New protocols MUST follow existing patterns in `protocols.ts`
3. **NFR-3**: Agent IDs and existing functionality MUST NOT change

## Current State Analysis

### Agent Mode Distribution

| Agent        | Mode  | Can Handle Direct Requests?               | Protocol Gaps                                 |
| ------------ | ----- | ----------------------------------------- | --------------------------------------------- |
| Executor     | `all` | No - expects structured handoffs          | Missing: ambiguity handling                   |
| Planner      | `all` | No - expects spec or clear requirements   | Missing: confidence, verification, checkpoint |
| Reviewer     | `all` | Partial - has workflow but no ad-hoc mode | Missing: confidence                           |
| Designer     | `all` | No - expects design requirements          | Missing: confidence, design system discovery  |
| Documenter   | `all` | No - expects clear scope                  | Missing: scope clarification                  |
| Brainstormer | `all` | Yes - adequate as-is                      | None                                          |

### Temperature Analysis

| Agent        | Current | Recommended | Rationale                                                    |
| ------------ | ------- | ----------- | ------------------------------------------------------------ |
| Explorer     | 0.7     | 0.3-0.5     | Search should be deterministic                               |
| Researcher   | 0.7     | 0.5         | Research benefits from some creativity but needs reliability |
| Designer     | 0.7     | 0.7         | Creative work benefits from higher temperature               |
| Brainstormer | 1.0     | 1.0         | Maximum creativity appropriate                               |

### Missing Capabilities

1. **Question-Answering**: No agent optimized for answering codebase or programming questions
2. **Orchestrator Fast Path**: No mechanism to handle simple requests without full decomposition
3. **Error Recovery**: No protocol for when delegated tasks fail

## Options Considered

### Option A: Dual-Mode Prompts

**Approach**: Add conditional sections to each agent's prompt that detect whether they received a structured handoff or a raw user request, with different workflows for each mode.

**Implementation**:

- Add `<direct_request_handling>` section to each `mode: 'all'` agent
- Include `Protocol.clarification` for ambiguous requests
- Add `Protocol.scopeAssessment` for determining request complexity
- Keep existing handoff processing for backward compatibility

**Pros**:

- Minimal structural changes - extends existing agents
- Backward compatible by design
- Single agent handles both modes
- No new agent IDs to manage

**Cons**:

- Increases prompt length for all agents
- Agents must detect which mode they're in
- May lead to inconsistent behavior between modes

### Option B: New Assistant Agent + Protocol Enhancements

**Approach**: Add a new "assistant" agent optimized for question-answering and simple requests, while enhancing existing agents with clarification protocols.

**Implementation**:

- Create `assistant.ts` agent for Q&A and simple tasks
- Add `Protocol.clarification` and `Protocol.scopeAssessment`
- Update orchestrator with "fast path" for simple requests
- Add missing protocols to existing agents

**Pros**:

- Clean separation of concerns
- Assistant handles Q&A without burdening specialists
- Orchestrator can route simple requests efficiently
- Specialists stay focused on their domain

**Cons**:

- Adds another agent to the swarm
- Requires orchestrator changes for routing
- More complex agent selection logic

### Option C: Protocol-First Enhancement

**Approach**: Focus on adding new protocols that all agents can use, with minimal prompt changes. Let agents self-determine when to use clarification vs. execution.

**Implementation**:

- Add `Protocol.clarification` - when and how to ask questions
- Add `Protocol.scopeAssessment` - determine request complexity
- Add `Protocol.directRequest` - workflow for handling raw requests
- Add missing protocols (confidence, verification) to agents that lack them
- Standardize constraint phrasing across all agents

**Pros**:

- Reusable protocols reduce duplication
- Consistent behavior across agents
- Minimal prompt size increase
- Easy to add to new agents

**Cons**:

- Agents still need prompt changes to use protocols
- Doesn't address Q&A gap directly
- May not provide enough agent-specific guidance

## Recommendation

**Option A: Dual-Mode Prompts** because it provides the most direct solution to the core problem (agents can't handle direct requests) with minimal structural changes and guaranteed backward compatibility.

**Confidence**: High

**Rationale**:

1. The primary issue is that agents lack guidance for direct requests - this directly addresses it
2. Adding a new assistant agent (Option B) adds complexity without solving the specialist agent gaps
3. Protocol-only changes (Option C) don't provide enough agent-specific context
4. Dual-mode is already partially implemented in some agents (reviewer has ad-hoc workflow hints)

**Hybrid Enhancement**: Combine Option A with key elements from Option C:

- Add `Protocol.clarification` and `Protocol.scopeAssessment` as reusable components
- Use these protocols within the dual-mode prompt sections
- This gives consistency (Option C benefit) with agent-specific guidance (Option A benefit)

## Detailed Design

### New Protocols

#### Protocol.clarification

```typescript
export const clarification = Prompt.template`
  ### Handling Ambiguous Requests
  When a request is unclear or missing critical information:
  
  1. **Identify what's missing** - scope, target files, success criteria, constraints
  2. **Ask focused questions** - 1-3 specific questions, not open-ended
  3. **Provide options when possible** - "Did you mean A or B?"
  4. **Suggest a default** - "If you don't specify, I'll assume X"
  
  **Question format**:
  \`\`\`markdown
  Before I proceed, I need to clarify:
  
  1. [Specific question about scope/target/criteria]
  2. [Optional: second question if truly needed]
  
  **Default assumption**: If you don't respond, I'll [default action].
  \`\`\`
  
  **Do NOT ask when**:
  - Request is clear enough to make reasonable assumptions
  - You can infer intent from context
  - Asking would be pedantic (obvious answers)
`;
```

#### Protocol.scopeAssessment

```typescript
export const scopeAssessment = Prompt.template`
  ### Scope Assessment
  Before starting work, quickly assess the request:
  
  | Complexity | Indicators | Action |
  |------------|------------|--------|
  | **Simple** | Single file, clear change, no dependencies | Execute directly |
  | **Medium** | Multiple files, some ambiguity, clear scope | Clarify if needed, then execute |
  | **Complex** | Cross-cutting, unclear scope, many dependencies | Recommend planning phase |
  
  **Quick assessment questions**:
  - Can I complete this in one focused session?
  - Do I know which files to modify?
  - Are the success criteria clear?
  
  If any answer is "no", either clarify or recommend escalation.
`;
```

### Agent-Specific Changes

#### Executor (`executor.ts`)

Add `<direct_request_handling>` section:

```typescript
<direct_request_handling>
  When receiving a direct user request (not a structured handoff): ### 1. Assess
  the Request - Is this a clear, actionable code change? - Do I know which files
  to modify? - Are success criteria implied or explicit? ### 2. If Clear -
  Identify target files from context or by searching - Infer acceptance criteria
  from the request - Proceed with implementation workflow ### 3. If Unclear Ask
  focused clarifying questions: - "Which file should I modify?" (if multiple
  candidates) - "What should happen when [edge case]?" (if behavior unclear) -
  "Should I also [related change]?" (if scope ambiguous) ### 4. Construct
  Internal Handoff Before implementing, mentally structure: - OBJECTIVE: [what
  user wants] - CONTEXT: [what I learned from codebase] - CONSTRAINTS: [patterns
  I must follow] - SUCCESS: [how I'll verify completion]
</direct_request_handling>
```

#### Planner (`planner.ts`)

Add direct request handling and missing protocols:

```typescript
// Add to protocols section:
${Protocol.confidence}
${Protocol.verification}
${Protocol.checkpoint}

// Add new section:
<direct_request_handling>
  When receiving a direct user request (not from a spec):

  ### 1. Assess Complexity
  - **Simple** (1-2 tasks): Execute directly or recommend executor
  - **Medium** (3-5 tasks): Create lightweight plan
  - **Complex** (6+ tasks or unclear scope): Full planning workflow

  ### 2. If No Spec Exists
  - Gather requirements from the request
  - Identify implicit requirements (testing, docs, etc.)
  - If scope is unclear, ask: "Should this include [X]?"

  ### 3. For Lightweight Plans
  Skip formal spec, create plan directly with:
  - Clear task breakdown
  - Dependencies identified
  - Acceptance criteria per task

  ### 4. When to Recommend Spec First
  - Architectural decisions needed
  - Multiple valid approaches exist
  - Scope is genuinely unclear after clarification
</direct_request_handling>
```

#### Reviewer (`reviewer.ts`)

Add ad-hoc review workflow and confidence protocol:

```typescript
// Add to protocols:
${Protocol.confidence}

// Add new section:
<ad_hoc_review>
  When asked to review without a plan/task context:

  ### 1. Determine Review Scope
  Ask if unclear:
  - "Review what specifically?" (file, PR, recent changes)
  - "What criteria matter most?" (security, performance, style)

  ### 2. Infer Acceptance Criteria
  If no explicit criteria:
  - Code compiles without errors
  - No obvious security vulnerabilities
  - Follows codebase patterns
  - No logic bugs in changed code

  ### 3. Scope-Based Review
  - **Single file**: Full review with all categories
  - **Multiple files**: Focus on critical issues, note patterns
  - **Large changeset**: Incremental review, prioritize by risk
</ad_hoc_review>

<incremental_review>
  For large changesets (>500 lines or >10 files):

  1. **Triage first**: Identify highest-risk files
  2. **Review in batches**: 3-5 files per pass
  3. **Track progress**: Note which files reviewed
  4. **Synthesize**: Combine findings at end
</incremental_review>
```

#### Designer (`designer.ts`)

Add direct request handling, confidence, and fallback:

```typescript
// Add to protocols:
${Protocol.confidence}

// Add new section:
<direct_request_handling>
  When receiving a direct design request:

  ### 1. Discover Design System
  Before implementing, search for:
  - Design tokens (colors, spacing, typography)
  - Existing component patterns
  - CSS methodology (modules, Tailwind, styled-components)

  ### 2. Clarify If Needed
  - "What aesthetic direction?" (if no existing system)
  - "Which component to style?" (if multiple candidates)
  - "Desktop, mobile, or both?" (if responsive unclear)

  ### 3. When Chrome DevTools Unavailable
  - Rely on code inspection for current state
  - Make changes based on CSS analysis
  - Note: "Visual verification recommended after changes"
</direct_request_handling>

<design_system_discovery>
  Look for design system artifacts:
  - \`**/tokens/**\`, \`**/theme/**\` - design tokens
  - \`tailwind.config.*\` - Tailwind configuration
  - \`**/styles/variables.*\` - CSS custom properties
  - Component library patterns in existing code

  **If no design system found**:
  - Propose one based on existing styles
  - Or ask user for aesthetic direction
</design_system_discovery>
```

#### Documenter (`documenter.ts`)

Add scope clarification:

```typescript
<direct_request_handling>
  When asked to "document this" without clear scope: ### 1. Clarify Scope Ask
  focused questions: - "Document the API, architecture, or usage?" - "For
  developers, users, or both?" - "Update existing docs or create new?" ### 2.
  Infer from Context If context provides hints: - New feature → Usage
  documentation - Complex code → Architecture/design docs - Public API → API
  reference ### 3. Default Behavior If user doesn't specify: - Check for
  existing docs to update - Default to README-style overview - Note: "Let me
  know if you need different documentation type"
</direct_request_handling>
```

#### Architect (`architect.ts`)

Add spec iteration and scope assessment:

```typescript
<spec_iteration>
  When updating an existing spec:

  1. **Read current spec** from \`.agent/specs/\`
  2. **Identify what changed** - new requirements, feedback, constraints
  3. **Update version** - increment and note changes
  4. **Preserve decisions** - don't contradict without explicit reason

  **Version format**:
  \`\`\`markdown
  **Version**: 1.1
  **Changes from 1.0**: [What changed and why]
  \`\`\`
</spec_iteration>

<scope_assessment>
  Before designing, assess scope:

  | Scope | Indicators | Approach |
  |-------|------------|----------|
  | **Component** | Single module, clear boundaries | Focused spec, 1-2 options |
  | **System** | Multiple modules, integration | Full spec, 2-3 options |
  | **Strategic** | Cross-cutting, long-term impact | Recommend stakeholder input |

  For strategic scope, recommend user involvement before finalizing.
</scope_assessment>
```

#### Consultant (`consultant.ts`)

Add escalation path for truly stuck situations:

```typescript
<escalation_path>
  When you cannot resolve a problem: 1. **Document thoroughly** - What was
  tried, what failed, hypotheses exhausted 2. **Recommend user involvement** -
  Some problems need human judgment 3. **Suggest external resources** -
  Documentation, community, support channels **Escalation output**:
  \`\`\`markdown ## Escalation Required **Problem**: [Summary] **Attempted**:
  [What was tried] **Blocked by**: [Specific blocker] **Recommendation**: [What
  human input is needed] **Resources**: [Relevant docs, forums, etc.] \`\`\`
</escalation_path>
```

#### Orchestrator (`orchestrator.ts`)

Add fast path and error recovery:

```typescript
<fast_path>
  For simple requests, skip full decomposition:

  ### Simple Request Indicators
  - Single, clear action ("fix this bug", "add this feature")
  - Obvious specialist match
  - No cross-cutting concerns
  - User explicitly wants quick action

  ### Fast Path Workflow
  1. Identify the single specialist needed
  2. Delegate directly with minimal context
  3. Return result without synthesis overhead

  ### When NOT to Fast Path
  - Request spans multiple domains
  - Scope is unclear
  - Quality gates needed (review, testing)
</fast_path>

<error_recovery>
  When a delegated task fails:

  ### 1. Assess Failure Type
  - **Blocker**: Missing dependency, unclear requirements
  - **Error**: Implementation failed, tests broke
  - **Timeout**: Task took too long

  ### 2. Recovery Actions
  | Failure | Recovery |
  |---------|----------|
  | Blocker | Gather missing info, retry with context |
  | Error | Delegate to consultant, then retry |
  | Timeout | Break into smaller tasks |

  ### 3. User Communication
  - Report failure clearly
  - Explain recovery attempt
  - Ask for guidance if recovery fails
</error_recovery>
```

### Temperature Adjustments

| Agent      | Current | New | Change |
| ---------- | ------- | --- | ------ |
| Explorer   | 0.7     | 0.4 | -0.3   |
| Researcher | 0.7     | 0.5 | -0.2   |

### Constraint Standardization

Standardize on `NEVER` for absolute prohibitions, `Do NOT` for strong guidance:

```typescript
// Pattern to follow:
- NEVER [absolute prohibition that would break things]
- Do NOT [strong guidance that has exceptions]
- Avoid [preference, not rule]
```

## Acceptance Criteria

### AC-1: Direct Request Handling

- [ ] Executor can implement a code change from "fix the bug in X" without structured handoff
- [ ] Planner can create a plan from "add feature Y" without a spec
- [ ] Reviewer can review code from "review this file" without plan context
- [ ] Designer can style a component from "make this look better"
- [ ] Documenter can document from "document this module"

### AC-2: Clarification Behavior

- [ ] Agents ask focused questions (1-3) when requests are ambiguous
- [ ] Agents provide default assumptions when asking questions
- [ ] Agents do NOT ask unnecessary questions for clear requests

### AC-3: Protocol Coverage

- [ ] Planner has confidence, verification, checkpoint protocols
- [ ] Reviewer has confidence protocol
- [ ] Designer has confidence protocol
- [ ] Consultant has escalation path

### AC-4: Orchestrator Improvements

- [ ] Simple requests route directly to specialist (fast path)
- [ ] Failed tasks trigger recovery workflow
- [ ] User is informed of failures and recovery attempts

### AC-5: Consistency

- [ ] Temperature settings match agent roles
- [ ] Constraint phrasing is standardized
- [ ] Output formats are consistent within agent types

### AC-6: Backward Compatibility

- [ ] Structured handoffs continue to work unchanged
- [ ] Agent IDs are unchanged
- [ ] Existing workflows produce same results

## Risks

| Risk                                        | Impact | Likelihood | Mitigation                                      |
| ------------------------------------------- | ------ | ---------- | ----------------------------------------------- |
| Prompt length increases degrade performance | High   | Medium     | Keep additions minimal, use protocols for reuse |
| Agents over-clarify, annoying users         | Medium | Medium     | Clear "do NOT ask when" guidance                |
| Dual-mode detection fails                   | Medium | Low        | Structured handoffs have clear format markers   |
| Temperature changes affect output quality   | Medium | Low        | Test before/after, adjust incrementally         |
| Backward compatibility breaks               | High   | Low        | Explicit testing of existing workflows          |

## Implementation Notes

### File Changes Required

1. `src/agent/util/prompt/protocols.ts` - Add `clarification`, `scopeAssessment`
2. `src/agent/executor.ts` - Add `<direct_request_handling>`
3. `src/agent/planner.ts` - Add direct handling + missing protocols
4. `src/agent/reviewer.ts` - Add ad-hoc review + confidence
5. `src/agent/designer.ts` - Add direct handling + design system discovery
6. `src/agent/documenter.ts` - Add scope clarification
7. `src/agent/architect.ts` - Add spec iteration + scope assessment
8. `src/agent/consultant.ts` - Add escalation path
9. `src/agent/orchestrator.ts` - Add fast path + error recovery
10. `src/agent/explorer.ts` - Adjust temperature (0.7 → 0.4)
11. `src/agent/researcher.ts` - Adjust temperature (0.7 → 0.5)

### Testing Strategy

1. **Unit**: Verify prompt generation includes new sections
2. **Integration**: Test each agent with direct requests
3. **Regression**: Verify structured handoffs still work
4. **E2E**: Full workflow tests with orchestrator

## Open Questions

1. Should `Protocol.clarification` use the `mcp_question` tool or natural language questions?
   - **Recommendation**: Natural language for flexibility, tool for structured choices

2. Should we add a dedicated "assistant" agent for Q&A in a future iteration?
   - **Recommendation**: Defer - see if dual-mode addresses the need first

3. How should agents detect structured handoff vs. direct request?
   - **Recommendation**: Check for `OBJECTIVE:` marker in input
