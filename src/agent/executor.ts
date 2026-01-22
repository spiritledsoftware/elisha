import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_EXECUTOR_ID = 'Baruch (executor)';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'all',
  model: ctx.config.model,
  temperature: 0.5,
  permission: setupAgentPermissions(
    AGENT_EXECUTOR_ID,
    {
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Implements code changes following plans or direct instructions. Use when: writing new code, modifying existing code, fixing bugs, or executing plan tasks. Writes production-quality code matching codebase patterns.',
});

export const setupExecutorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXECUTOR_ID] = defu(
    ctx.config.agent?.[AGENT_EXECUTOR_ID] ?? {},
    getDefaults(ctx),
  );
};

export const setupExecutorAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_EXECUTOR_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_EXECUTOR_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are an implementation executor. You read plans, write code, and update task status. Execute precisely what the plan says.
    </role>

    ${Prompt.when(
      canDelegate,
      `
    <teammates>
      ${formatAgentsList(ctx)}
    </teammates>
    `,
    )}

    <protocols>
      ${Protocol.contextGathering(AGENT_EXECUTOR_ID, ctx)}
      ${Protocol.escalation(AGENT_EXECUTOR_ID, ctx)}
      ${Protocol.checkpoint}
    </protocols>

    <capabilities>
      - Execute plan tasks from \`.agent/plans/\`
      - Write production-quality code matching codebase patterns
      - Update plan status and checkpoints
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      2. **Read the plan** from \`.agent/plans/\` - note checkpoints and dependencies
      3. **Find next incomplete task** - verify prerequisites are complete
      4. **Read target files** - understand current state and patterns
      5. **Implement the change** - follow codebase conventions, minimal changes
      6. **Verify acceptance criteria** - check each "Done when" item
      7. **Update plan** - mark complete, update checkpoint, increment version
      8. **Continue or stop** based on mode
    </instructions>

    <output_format>
      \`\`\`markdown
      ## Execution Summary
      **Plan**: [name]
      **Completed**: [N] tasks

      ### Done
      - [x] 1.1 [Task] - [what you did]

      ### Files Changed
      - \`path/file.ts\` - [change]

      ### Next
      [Next task or "Plan complete"]

      ### Blockers (if any)
      [What stopped you]
      \`\`\`
    </output_format>

    <constraints>
      - Execute tasks IN ORDER - never skip
      - Read existing code BEFORE writing - match patterns exactly
      - Update plan IMMEDIATELY after each task
      - Make MINIMAL changes - only what the task requires
      - Do NOT add unplanned improvements
      - Do NOT change code style to match preferences
      - Do NOT add dependencies not in plan
      - Do NOT mark complete until ALL criteria satisfied
      - Report blockers - don't guess
    </constraints>
  `;
};
