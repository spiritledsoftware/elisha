import type { ElishaAgent } from '~/agent/agent';
import { consultantAgent } from '~/features/agents/consultant';
import { documenterAgent } from '~/features/agents/documenter';
import { executorAgent } from '~/features/agents/executor';
import { explorerAgent } from '~/features/agents/explorer';
import { orchestratorAgent } from '~/features/agents/orchestrator';
import { researcherAgent } from '~/features/agents/researcher';
import { context7Mcp } from '~/features/mcps/context7';
import { exaMcp } from '~/features/mcps/exa';
import { grepAppMcp } from '~/features/mcps/grep-app';
import { openmemoryMcp } from '~/features/mcps/openmemory';
import {
  taskBroadcastsReadTool,
  taskBroadcastTool,
  taskSendMessageTool,
} from '~/features/tools/tasks';
import { Prompt } from '.';

export namespace Protocol {
  export function contextGathering(agent: ElishaAgent) {
    const hasMemory = agent.hasMcp(openmemoryMcp.id);
    const hasWebSearch = agent.hasMcp(exaMcp.id);
    const hasWebFetch = agent.hasPermission('webfetch');
    const hasContext7 = agent.hasMcp(context7Mcp.id);
    const hasGrepApp = agent.hasMcp(grepAppMcp.id);

    const hasExplorer =
      agent.id !== explorerAgent.id &&
      agent.canDelegate &&
      explorerAgent.isEnabled;
    const hasResearcher =
      agent.id !== researcherAgent.id &&
      agent.canDelegate &&
      researcherAgent.isEnabled;

    return Prompt.template`
      <context_gathering>
      Always gather context before acting:
      ${Prompt.when(
        hasMemory,
        `- Use \`${openmemoryMcp.id}*\` tools to gather relevant past sessions or info.`,
      )}
      ${Prompt.when(
        hasExplorer,
        `- Delegate to \`${explorerAgent.id}\` agent to search for files or patterns within the codebase.`,
        '- Search for files or patterns within the codebase.',
      )}
      ${Prompt.when(
        hasResearcher,
        `- Delegate to \`${researcherAgent.id}\` agent to gather external information or perform research.`,
        Prompt.template`
          ${Prompt.when(
            hasWebSearch,
            `- Use \`${exaMcp.id}*\` tools to gather external information from the web.`,
          )}
          ${Prompt.when(
            hasWebFetch,
            `- Use \`webfetch\` tool to retrieve content from specific URLs.`,
          )}
          ${Prompt.when(
            hasContext7,
            `- Use \`${context7Mcp.id}*\` tools to find up-to-date library/package documentation.`,
          )}
          ${Prompt.when(
            hasGrepApp,
            `- Use \`${grepAppMcp.id}*\` tools to find relevant code snippets or references.`,
          )}
        `,
      )}
      </context_gathering>
    `;
  }

  /**
   * Escalation protocol for agents that can delegate to consultant.
   * Use when the agent might get stuck and needs expert help.
   */
  export function escalation(agent: ElishaAgent) {
    const canDelegate = agent.canDelegate;
    const hasConsultant =
      agent.id !== consultantAgent.id &&
      canDelegate &&
      consultantAgent.isEnabled;

    return Prompt.template`
      <escalation>
      If you encounter a blocker or need help:
      ${Prompt.when(
        hasConsultant,
        `
        - Delegate to \`${consultantAgent.id}\` agent for specialized assistance.
        `,
        `
        - Report that you need help to proceed.
        `,
      )}
      </escalation>
    `;
  }

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
   * Task handoff protocol for structured delegation and lifecycle management.
   * Covers initial handoff, monitoring, steering, and resurrection.
   */
  export const taskHandoff = Prompt.template`
    <task_handoff>
    When delegating to another agent, manage the full task lifecycle:
    
    ### 1. Initial Handoff
    Provide structured context:
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
    
    ### 2. Monitor Progress (async tasks)
    For long-running tasks, check progress periodically:
    - Use \`task_output(wait=false)\` to get partial results
    - Check more frequently for complex tasks or less capable models
    - Early detection prevents wasted effort
    
    ### 3. Steer if Off-Track
    Use \`task_send_message\` to redirect running tasks:
    - "Stop X, focus on Y instead"
    - "Add constraint: must also handle Z"
    - "Narrow scope to only files in /src"
    
    ### 4. Refine via Resurrection
    Completed tasks can be continued with follow-up messages:
    - **Critique**: "Issues found: [list]. Please fix."
    - **Elaborate**: "Expand section X with examples"
    - **Iterate**: "Good, now also add Y"
    
    **Key insight**: Resurrection preserves context - more efficient than starting new tasks.
    
    ### When to Intervene
    | Situation | Action |
    |-----------|--------|
    | Task going wrong direction | Steer immediately via \`task_send_message\` |
    | Output incomplete | Resurrect with specific gaps to fill |
    | Output has errors | Resurrect with specific fixes needed |
    | Need related follow-up | Resurrect same task (preserves context) |
    </task_handoff>
  `;

  export const handoffProcessing = Prompt.template`
    <handoff_processing>
      When receiving a task, extract and validate:
      
      1. **OBJECTIVE** - What to accomplish (must be clear and specific)
      2. **CONTEXT** - Background info, file paths, patterns to follow
      3. **CONSTRAINTS** - Boundaries, things to avoid
      4. **SUCCESS** - Criteria to verify completion
      5. **DEPENDENCIES** - Prerequisites that must exist
      
      If any required information is missing, request clarification before starting.
    </handoff_processing>
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
   * Maintains visibility into swarm execution state and guides intervention.
   */
  export const progressTracking = Prompt.template`
    <progress_tracking>
    For multi-step workflows, maintain execution state and respond to it:
    
    ### Track State
    - Tasks completed with outcomes
    - Tasks in progress with current agent
    - Tasks pending with dependencies
    - Blockers encountered
    
    ### Progress Table Format
    \`\`\`markdown
    ## Workflow Progress
    **Started**: [timestamp]
    **Status**: In Progress | Blocked | Complete
    
    | Task | Agent | Status | Health | Notes |
    |------|-------|--------|--------|-------|
    | [task] | [agent] | ✅/🔄/⏳/❌ | 🟢/🟡/🔴 | [outcome] |
    \`\`\`
    
    ### Health Indicators
    | Health | Meaning | Action |
    |--------|---------|--------|
    | 🟢 | On track | Continue monitoring |
    | 🟡 | Slow or partial progress | Check output, consider steering |
    | 🔴 | Stuck, off-track, or failed | Intervene immediately |
    
    ### Respond to State
    When tracking reveals issues:
    
    | Observed State | Response |
    |----------------|----------|
    | Task running too long | Fetch partial output, assess health |
    | Partial output off-track | Send steering message via \`task_send_message\` |
    | Task completed but incomplete | Resurrect with gaps to fill |
    | Task failed | Assess cause, retry or escalate |
    | Multiple tasks blocked | Re-evaluate dependencies, parallelize differently |
    
    ### Update Frequency
    - After each task completes or fails
    - Periodically for long-running async tasks
    - Immediately when blockers detected
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

  /**
   * Sibling communication protocol for task coordination.
   * Dynamic based on agent type - orchestrators vs subagents.
   */
  export function agentCommunication(agent: ElishaAgent) {
    const isOrchestrator = agent.id === orchestratorAgent.id;

    return Prompt.template`
      <agent_communication>
        ${Prompt.when(
          agent.canDelegate,
          `
        ### Orchestrator Communication
        As an orchestrator, you can:
        - **Broadcast to children**: \`${taskBroadcastTool.id}({ target: 'children', ... })\` to share context with all delegated tasks
        - **Read child broadcasts**: \`${taskBroadcastsReadTool.id}({ source: 'children' })\` to see what tasks discovered
        `,
        )}
        
        ${Prompt.when(
          !isOrchestrator,
          `
        ### Sibling Communication
        You can share discoveries with sibling tasks using \`${taskBroadcastTool.id}\`.
        
        #### When to Broadcast
        - **Discovery**: Found important file, pattern, or configuration
        - **Warning**: Encountered a gotcha or anti-pattern to avoid
        - **Context**: Background info that helps understand the codebase
        - **Blocker**: Stuck and need sibling awareness (not help request)
        
        #### Broadcast Guidelines
        - Be concise: 2-5 lines, actionable information
        - Include specifics: file paths, function names, patterns
        - Don't broadcast obvious things (e.g., "found package.json")
        - Don't broadcast your task progress (that's for parent)
        
        #### Reading Broadcasts
        Use \`${taskBroadcastsReadTool.id}\` at the start of complex tasks to sync context.
        Sibling discoveries may save you from redundant searches.
        
        #### Direct Sibling Messages
        Use \`${taskSendMessageTool.id}\` with a sibling's task ID for directed communication.
        Sibling IDs are provided in your \`<sibling_tasks>\` context.
        `,
        )}
        
        ### Example Good Broadcast
        \`\`\`
        ${taskBroadcastTool.id}({
          message: "Config pattern: Use ConfigContext.use() not direct import. File: src/context.ts",
          category: "discovery",
          target: "siblings"
        })
        \`\`\`
      </agent_communication>
    `;
  }

  export const agentsMdMaintenance = (self: ElishaAgent) => {
    const canEdit = self.hasPermission('edit:**/AGENTS.md');
    const hasDocumenter =
      self.id !== documenterAgent.id &&
      self.canDelegate &&
      documenterAgent.isEnabled;
    const hasExecutor =
      self.id !== executorAgent.id &&
      self.canDelegate &&
      executorAgent.isEnabled;

    const updaterAgent = hasDocumenter
      ? documenterAgent.id
      : hasExecutor
        ? executorAgent.id
        : undefined;

    return Prompt.template`
      <agents_md_maintenance>
        Update AGENTS.md files when you discover knowledge that would help future AI agents working on this codebase.

        **When to Update**:

        - Discovered a pattern not documented (e.g., "services always use dependency injection")
        - Learned from a mistake (e.g., "don't import X directly, use the re-export from Y")
        - Found a non-obvious convention (e.g., "test files must end with \`.spec.ts\`, not \`.test.ts\`")
        - Encountered a gotcha that wasted time (e.g., "build must run before tests")
        - Identified a critical constraint (e.g., "never modify files in \`generated/\`")

        **How to Update**:

        1. Read the existing AGENTS.md file first
        2. ${Prompt.when(
          canEdit,
          'Add new information in the appropriate section',
          Prompt.when(
            Boolean(updaterAgent),
            `Delegate the update to \`${updaterAgent}\` agent`,
            'Report the needed update in your final output',
          ),
        )}
        3. Keep it concise—every line should earn its place
        4. Use specific examples from the codebase

        **What NOT to Add**:

        - Generic programming advice (agents already know this)
        - One-off debugging notes (use memory for session-specific context)
        - Information already in README or other docs (reference instead)
        - Speculative patterns (only document confirmed conventions)

        **Update Triggers**:

        - "I wish I had known this when I started"
        - "This would have saved me from that error"
        - "Future agents will make this same mistake"
        - User explicitly asks to remember something for the project
      </agents_md_maintenance>
    `;
  };
}
