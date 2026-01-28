# Plan: Agent Swarm Improvements

**Version**: 1.0
**Last Updated**: 2026-01-22T14:00:00Z
**Last Agent**: planner
**Status**: Draft
**Complexity**: Medium
**Tasks**: 13

## Overview

Enable `mode: 'all'` agents to handle direct user requests without structured handoffs by adding new protocols, direct request handling sections, and temperature adjustments. Maintains backward compatibility with existing orchestrator workflows.

## Dependencies

- Spec: `.agent/specs/agent-swarm-improvements.md` (authoritative design source)
- Existing protocols in `src/agent/util/prompt/protocols.ts`
- Two-phase agent setup pattern (config then prompt)

## Tasks

### Phase 1: Protocol Foundation (Sequential)

> New protocols must exist before agents can use them

#### 1.1 Add Protocol.clarification and Protocol.scopeAssessment

**Agent**: Baruch (executor)
**File**: `src/agent/util/prompt/protocols.ts`
**Depends on**: none

Add two new protocol exports to the Protocol namespace:

1. `clarification` - Guidance for handling ambiguous requests with focused questions
2. `scopeAssessment` - Quick complexity assessment (Simple/Medium/Complex) with action guidance

Follow existing protocol patterns (use `Prompt.template`, export from namespace).

**Done when**:

- [ ] `Protocol.clarification` exported and follows spec format
- [ ] `Protocol.scopeAssessment` exported and follows spec format
- [ ] Both use `Prompt.template` like existing protocols
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern to follow: `Protocol.confidence` and `Protocol.verification` in same file
- Constraint: Keep concise - agents have limited context windows

---

### Phase 2: Temperature Adjustments (Parallel)

> Config-only changes, no prompt dependencies

#### 2.1 Adjust Explorer Temperature

**Agent**: Baruch (executor)
**File**: `src/agent/explorer.ts`
**Depends on**: none
**Parallel group**: A

Change `temperature` from `0.7` to `0.4` in `getDefaultConfig()`.

**Done when**:

- [ ] Temperature is `0.4` in explorer's default config
- [ ] No other changes to the file
- [ ] TypeScript compiles without errors

#### 2.2 Adjust Researcher Temperature

**Agent**: Baruch (executor)
**File**: `src/agent/researcher.ts`
**Depends on**: none
**Parallel group**: A

Change `temperature` from `0.7` to `0.5` in `getDefaultConfig()`.

**Done when**:

- [ ] Temperature is `0.5` in researcher's default config
- [ ] No other changes to the file
- [ ] TypeScript compiles without errors

---

### Phase 3: Agent Prompt Enhancements (Parallel)

> All depend on Phase 1 completion. Can run concurrently since they modify different files.

#### 3.1 Add Direct Request Handling to Executor

**Agent**: Baruch (executor)
**File**: `src/agent/executor.ts`
**Depends on**: 1.1
**Parallel group**: B

Add `<direct_request_handling>` section to `setupExecutorAgentPrompt()` after `<handoff_processing>`. Include:

- Request assessment (clear vs unclear)
- Clarification questions when needed
- Internal handoff construction

**Done when**:

- [ ] `<direct_request_handling>` section added to prompt
- [ ] Section covers: assess request, if clear proceed, if unclear ask questions, construct internal handoff
- [ ] Existing `<handoff_processing>` section unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Follow existing XML section structure in the prompt
- Constraint: Keep concise, use numbered lists

#### 3.2 Add Direct Request Handling and Missing Protocols to Planner

**Agent**: Baruch (executor)
**File**: `src/agent/planner.ts`
**Depends on**: 1.1
**Parallel group**: B

1. Add missing protocols to `<protocols>` section:
   - `${Protocol.confidence}`
   - `${Protocol.verification}`
   - `${Protocol.checkpoint}`

2. Add `<direct_request_handling>` section covering:
   - Complexity assessment (Simple/Medium/Complex)
   - Handling requests without specs
   - Lightweight plan creation
   - When to recommend spec first

**Done when**:

- [ ] `Protocol.confidence`, `Protocol.verification`, `Protocol.checkpoint` added to protocols section
- [ ] `<direct_request_handling>` section added with complexity assessment
- [ ] Existing planning workflow unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Protocols go in `<protocols>` section, new sections after `<planning_workflow>`
- Constraint: Planner already has `Protocol.contextGathering` and `Protocol.escalation`

#### 3.3 Add Ad-Hoc Review and Confidence Protocol to Reviewer

**Agent**: Baruch (executor)
**File**: `src/agent/reviewer.ts`
**Depends on**: 1.1
**Parallel group**: B

1. Add `${Protocol.confidence}` to `<protocols>` section

2. Add `<ad_hoc_review>` section covering:
   - Determining review scope when not from plan
   - Inferring acceptance criteria
   - Scope-based review approach

3. Add `<incremental_review>` section for large changesets (>500 lines or >10 files)

**Done when**:

- [ ] `Protocol.confidence` added to protocols section
- [ ] `<ad_hoc_review>` section added with scope determination
- [ ] `<incremental_review>` section added for large changesets
- [ ] Existing review workflow unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add new sections after `<review_workflow>`
- Note: Reviewer already has `<confidence_levels>` inline - Protocol.confidence is more standardized

#### 3.4 Add Direct Request Handling and Confidence to Designer

**Agent**: Baruch (executor)
**File**: `src/agent/designer.ts`
**Depends on**: 1.1
**Parallel group**: B

1. Add `${Protocol.confidence}` to `<protocols>` section

2. Add `<direct_request_handling>` section covering:
   - Design system discovery
   - Clarification questions
   - Fallback when Chrome DevTools unavailable

3. Add `<design_system_discovery>` section with artifact locations

**Done when**:

- [ ] `Protocol.confidence` added to protocols section
- [ ] `<direct_request_handling>` section added
- [ ] `<design_system_discovery>` section added with file patterns
- [ ] Existing design philosophy unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add sections after `<design_philosophy>`
- Constraint: Designer already has Chrome DevTools conditional logic - preserve it

#### 3.5 Add Direct Request Handling to Documenter

**Agent**: Baruch (executor)
**File**: `src/agent/documenter.ts`
**Depends on**: 1.1
**Parallel group**: B

Add `<direct_request_handling>` section covering:

- Scope clarification questions
- Inferring documentation type from context
- Default behavior when user doesn't specify

**Done when**:

- [ ] `<direct_request_handling>` section added
- [ ] Section covers: clarify scope, infer from context, default behavior
- [ ] Existing documentation types unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add section after `<documentation_types>`
- Constraint: Keep questions focused (1-3 specific questions)

#### 3.6 Add Spec Iteration and Scope Assessment to Architect

**Agent**: Baruch (executor)
**File**: `src/agent/architect.ts`
**Depends on**: 1.1
**Parallel group**: B

Add two new sections:

1. `<spec_iteration>` - Guidance for updating existing specs:
   - Read current spec
   - Identify changes
   - Update version
   - Preserve decisions

2. `<scope_assessment>` - Scope classification:
   - Component vs System vs Strategic
   - When to recommend stakeholder input

**Done when**:

- [ ] `<spec_iteration>` section added with version format
- [ ] `<scope_assessment>` section added with scope table
- [ ] Existing spec format unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add sections after `<spec_format>`
- Note: Architect already has `Protocol.confidence` - no need to add

#### 3.7 Add Escalation Path to Consultant

**Agent**: Baruch (executor)
**File**: `src/agent/consultant.ts`
**Depends on**: 1.1
**Parallel group**: B

Add `<escalation_path>` section for truly stuck situations:

- Document thoroughly what was tried
- Recommend user involvement
- Suggest external resources
- Escalation output format

**Done when**:

- [ ] `<escalation_path>` section added
- [ ] Section includes structured escalation output format
- [ ] Existing consultation output unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add section after `<consultation_output>`
- Constraint: Consultant is advisory-only - escalation is to user, not other agents

#### 3.8 Add Fast Path and Error Recovery to Orchestrator

**Agent**: Baruch (executor)
**File**: `src/agent/orchestrator.ts`
**Depends on**: 1.1
**Parallel group**: B

Add two new sections:

1. `<fast_path>` - Skip full decomposition for simple requests:
   - Simple request indicators
   - Fast path workflow
   - When NOT to fast path

2. `<error_recovery>` - Handle delegated task failures:
   - Assess failure type (Blocker/Error/Timeout)
   - Recovery actions table
   - User communication

**Done when**:

- [ ] `<fast_path>` section added with indicators and workflow
- [ ] `<error_recovery>` section added with failure types and recovery table
- [ ] Existing workflow unchanged
- [ ] TypeScript compiles without errors

**Handoff context**:

- Pattern: Add sections after `<workflow>`, before `<task_matching>`
- Constraint: Orchestrator already has parallel patterns - these are complementary

---

### Phase 4: Verification (Sequential)

> Final verification after all changes complete

#### 4.1 Run Verification Suite

**Agent**: Baruch (executor)
**File**: N/A (verification only)
**Depends on**: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8

Run verification commands to ensure all changes are valid:

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
- [ ] Executor can handle direct "fix this bug" request
- [ ] Planner can create plan without spec
- [ ] Reviewer can review without plan context
- [ ] Designer can style without design requirements
- [ ] Documenter can document without clear scope
- [ ] Orchestrator fast-paths simple requests

## Risks

| Risk                                        | Impact | Mitigation                                                 |
| ------------------------------------------- | ------ | ---------------------------------------------------------- |
| Prompt length increases degrade performance | High   | Keep additions minimal, use protocols for reuse            |
| Agents over-clarify, annoying users         | Medium | Clear "do NOT ask when" guidance in Protocol.clarification |
| Temperature changes affect output quality   | Low    | Changes are conservative (0.7→0.4, 0.7→0.5)                |
| Backward compatibility breaks               | High   | Existing sections unchanged, only additions                |

## Checkpoint

**Session**: 2026-01-22T14:00:00Z
**Completed**: None
**In Progress**: None
**Notes**: Plan created from spec. Ready for execution.
**Blockers**: None
