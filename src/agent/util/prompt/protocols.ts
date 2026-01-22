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
      ### Context Gathering
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
      ### Escalation
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
    `;
  };

  /**
   * Standard confidence levels used across agents.
   */
  export const confidence = Prompt.template`
    ### Confidence Levels
    Always state confidence level with findings:
    - **High**: Verified from authoritative source or clear evidence
    - **Medium**: Multiple indicators support this conclusion
    - **Low**: Best guess based on limited information
  `;

  /**
   * Checkpoint protocol for agents that update plans.
   */
  export const checkpoint = Prompt.template`
    ### Checkpoint
    After completing tasks or when stopping, update the plan:
    \`\`\`markdown
    ## Checkpoint
    **Session**: [ISO timestamp]
    **Completed**: [Tasks done]
    **In Progress**: [Current task]
    **Notes**: [Context for next session]
    **Blockers**: [If any]
    \`\`\`
  `;

  /**
   * Task handoff protocol for structured delegation.
   * Ensures context is preserved when passing work between agents.
   */
  export const taskHandoff = Prompt.template`
    ### Task Handoff
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
  `;

  /**
   * Verification protocol for quality gates.
   * Ensures work meets criteria before marking complete.
   */
  export const verification = Prompt.template`
    ### Verification
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
  `;

  /**
   * Parallel work protocol for concurrent task execution.
   * Guides when to parallelize and how to coordinate.
   */
  export const parallelWork = Prompt.template`
    ### Parallel Execution
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
  `;

  /**
   * Result synthesis protocol for combining agent outputs.
   * Ensures coherent final output from parallel work.
   */
  export const resultSynthesis = Prompt.template`
    ### Result Synthesis
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
  `;

  /**
   * Progress tracking protocol for multi-step workflows.
   * Maintains visibility into swarm execution state.
   */
  export const progressTracking = Prompt.template`
    ### Progress Tracking
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
  `;
}
