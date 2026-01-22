import { AGENT_CONSULTANT_ID } from '~/agent/consultant.ts';
import { AGENT_EXPLORER_ID } from '~/agent/explorer.ts';
import { AGENT_RESEARCHER_ID } from '~/agent/researcher.ts';
import {
  MCP_CONTEXT7_ID,
  MCP_EXA_ID,
  MCP_GREP_APP_ID,
  MCP_OPENMEMORY_ID,
} from '~/mcp/index.ts';
import { agentHasPermission } from '~/permission/agent/util.ts';
import type { ElishaConfigContext } from '~/types.ts';
import {
  canAgentDelegate,
  isAgentEnabled,
  isMcpAvailableForAgent,
} from '../index.ts';
import { Prompt } from './index.ts';

export namespace Protocol {
  export const contextGathering = (
    agentName: string,
    ctx: ElishaConfigContext,
  ) => {
    const hasMemory = isMcpAvailableForAgent(MCP_OPENMEMORY_ID, agentName, ctx);
    const hasWebSearch = isMcpAvailableForAgent(MCP_EXA_ID, agentName, ctx);
    const hasWebFetch = agentHasPermission('webfetch', agentName, ctx);
    const hasContext7 = isMcpAvailableForAgent(MCP_CONTEXT7_ID, agentName, ctx);
    const hasGrepApp = isMcpAvailableForAgent(MCP_GREP_APP_ID, agentName, ctx);

    const canDelegate = canAgentDelegate(agentName, ctx);
    const hasExplorer =
      agentName !== AGENT_EXPLORER_ID &&
      canDelegate &&
      isAgentEnabled(AGENT_EXPLORER_ID, ctx);
    const hasResearcher =
      agentName !== AGENT_RESEARCHER_ID &&
      canDelegate &&
      isAgentEnabled(AGENT_RESEARCHER_ID, ctx);

    return Prompt.template`
      <context_gathering>
      Always gather context before acting:
      ${Prompt.when(
        hasMemory,
        `- Use \`${MCP_OPENMEMORY_ID}*\` for relevant past sessions or info.`,
      )}
      ${Prompt.when(
        hasExplorer,
        `- Delegate to \`${AGENT_EXPLORER_ID}\` agent to search for files or patterns within the codebase.`,
        '- Search for files or patterns within the codebase.',
      )}
      ${Prompt.when(
        hasResearcher,
        `- Delegate to \`${AGENT_RESEARCHER_ID}\` agent to gather external information or perform research.`,
        Prompt.template`
          ${Prompt.when(
            hasWebSearch,
            `- Use \`${MCP_EXA_ID}*\` tools to gather external information from the web.`,
          )}
          ${Prompt.when(
            hasWebFetch,
            `- Use \`webfetch\` tool to retrieve content from specific URLs.`,
          )}
          ${Prompt.when(
            hasContext7,
            `- Use \`${MCP_CONTEXT7_ID}*\` tools to find up-to-date library/package documentation.`,
          )}
          ${Prompt.when(
            hasGrepApp,
            `- Use \`${MCP_GREP_APP_ID}*\` tools to find relevant code snippets or references.`,
          )}
        `,
      )}
      </context_gathering>
    `;
  };

  /**
   * Escalation protocol for agents that can delegate to consultant.
   * Use when the agent might get stuck and needs expert help.
   */
  export const escalation = (agentName: string, ctx: ElishaConfigContext) => {
    const canDelegate = canAgentDelegate(agentName, ctx);
    const hasConsultant =
      agentName !== AGENT_CONSULTANT_ID &&
      canDelegate &&
      isAgentEnabled(AGENT_CONSULTANT_ID, ctx);

    return Prompt.template`
      <escalation>
      If you encounter a blocker or need help:
      ${Prompt.when(
        hasConsultant,
        `
        - Delegate to \`${AGENT_CONSULTANT_ID}\` agent for specialized assistance.
        `,
        `
        - Report that you need help to proceed.
        `,
      )}
      </escalation>
    `;
  };

  /**
   * Standard confidence levels with recommended actions.
   */
  export const confidence = Prompt.template`
    <confidence_levels>
    State confidence level with findings and act accordingly:
    
    | Level | Meaning | Action |
    |-------|---------|--------|
    | **High** | Verified from authoritative source | Proceed confidently |
    | **Medium** | Multiple indicators support this | Proceed, note uncertainty |
    | **Low** | Best guess, limited information | State assumptions, suggest verification |
    </confidence_levels>
  `;

  /**
   * Checkpoint protocol for agents that update plans.
   */
  export const checkpoint = Prompt.template`
    <checkpoint>
    After completing tasks or when stopping, update the plan:
    \`\`\`markdown
    ## Checkpoint
    **Session**: [ISO timestamp]
    **Completed**: [Tasks done]
    **In Progress**: [Current task]
    **Notes**: [Context for next session]
    **Blockers**: [If any]
    \`\`\`
    </checkpoint>
  `;

  /**
   * Task handoff protocol for structured delegation.
   * Ensures context is preserved when passing work between agents.
   */
  export const taskHandoff = Prompt.template`
    <task_handoff>
    When delegating to another agent, provide structured context:
    
    **Required handoff information**:
    - **Objective**: What needs to be accomplished (1 sentence)
    - **Context**: Relevant background the agent needs
    - **Constraints**: Boundaries, patterns to follow, things to avoid
    - **Success criteria**: How to know when done
    - **Dependencies**: What must exist/complete first
    
    **Handoff format**:
    \`\`\`
    OBJECTIVE: [Clear goal statement]
    CONTEXT: [Background info, file paths, patterns observed]
    CONSTRAINTS: [Must follow X, avoid Y, use pattern Z]
    SUCCESS: [Specific, verifiable criteria]
    DEPENDENCIES: [Prior tasks, files that must exist]
    \`\`\`
    </task_handoff>
  `;

  /**
   * Verification protocol for quality gates.
   * Ensures work meets criteria before marking complete.
   */
  export const verification = Prompt.template`
    <verification>
    Before marking any task complete:
    
    1. **Check acceptance criteria** - Every "Done when" item must be satisfied
    2. **Verify no regressions** - Changes don't break existing functionality
    3. **Confirm patterns match** - Code follows codebase conventions
    4. **Test if applicable** - Run relevant tests, check they pass
    
    **Verification checklist**:
    - [ ] All acceptance criteria met
    - [ ] No TypeScript/lint errors introduced
    - [ ] Follows existing code patterns
    - [ ] No unintended side effects
    
    **If verification fails**: Report the specific failure, do NOT mark complete.
    </verification>
  `;

  /**
   * Parallel work protocol for concurrent task execution.
   * Guides when to parallelize and how to coordinate.
   */
  export const parallelWork = Prompt.template`
    <parallel_execution>
    Execute independent tasks concurrently when possible:
    
    **Parallelize when**:
    - Tasks have no data dependencies
    - Tasks modify different files
    - Tasks are read-only operations (search, research)
    
    **Do NOT parallelize when**:
    - Task B needs output from Task A
    - Tasks modify the same file
    - Order matters for correctness
    
    **Coordination pattern**:
    1. Identify independent task groups
    2. Launch parallel tasks in single batch
    3. Wait for all to complete
    4. Synthesize results before next phase
    </parallel_execution>
  `;

  /**
   * Result synthesis protocol for combining agent outputs.
   * Ensures coherent final output from parallel work.
   */
  export const resultSynthesis = Prompt.template`
    <result_synthesis>
    When combining outputs from multiple agents:
    
    1. **Collect all outputs** - Gather results from each delegated task
    2. **Identify conflicts** - Note any contradictions or overlaps
    3. **Resolve conflicts** - Use domain expert or ask user if unclear
    4. **Merge coherently** - Combine into unified response
    5. **Attribute sources** - Note which agent contributed what
    
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
    </result_synthesis>
  `;

  /**
   * Progress tracking protocol for multi-step workflows.
   * Maintains visibility into swarm execution state.
   */
  export const progressTracking = Prompt.template`
    <progress_tracking>
    For multi-step workflows, maintain execution state:
    
    **Track**:
    - Tasks completed with outcomes
    - Tasks in progress with current agent
    - Tasks pending with dependencies
    - Blockers encountered
    
    **Update frequency**: After each task completes or fails
    
    **Progress format**:
    \`\`\`markdown
    ## Workflow Progress
    **Started**: [timestamp]
    **Status**: In Progress | Blocked | Complete
    
    | Task | Agent | Status | Notes |
    |------|-------|--------|-------|
    | [task] | [agent] | ✅/🔄/⏳/❌ | [outcome] |
    \`\`\`
    </progress_tracking>
  `;

  /**
   * Clarification protocol for handling ambiguous requests.
   * Use when agents need to ask focused questions before proceeding.
   */
  export const clarification = Prompt.template`
    <clarification>
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
    </clarification>
  `;

  /**
   * Scope assessment protocol for quick complexity triage.
   * Use before starting work to determine appropriate approach.
   */
  export const scopeAssessment = Prompt.template`
    <scope_assessment>
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
    </scope_assessment>
  `;

  /**
   * Reflection protocol for self-review before finalizing.
   * Use to catch errors and improve output quality.
   */
  export const reflection = Prompt.template`
    <reflection>
    Before finalizing your output, perform a self-review:
    
    1. **Re-read the objective** - Does my output address what was asked?
    2. **Check completeness** - Did I miss any requirements or edge cases?
    3. **Verify accuracy** - Are my claims supported by evidence?
    4. **Assess quality** - Would I be satisfied receiving this output?
    
    **If issues found**: Fix them before responding.
    **If uncertain**: State the uncertainty explicitly.
    </reflection>
  `;

  /**
   * Retry strategy protocol for handling failures gracefully.
   * Static protocol - applies to all failure types.
   */
  export const retryStrategy = Prompt.template`
    <retry_strategy>
    When an operation fails:
    
    | Failure Type | First Action | If Still Fails |
    |--------------|--------------|----------------|
    | Not found | Broaden search, try variations | Report "not found" with what was tried |
    | Permission | Check path/credentials | Report blocker, suggest resolution |
    | Timeout | Reduce scope or break into parts | Report partial progress |
    | Parse error | Try alternate format | Report with raw data |
    
    **Retry limit**: 2 attempts per operation
    **Always report**: What failed, what was tried, what worked (if anything)
    </retry_strategy>
  `;
}
