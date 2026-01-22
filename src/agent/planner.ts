import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import { AGENT_EXPLORER_ID } from './explorer.ts';
import {
  canAgentDelegate,
  formatAgentsList,
  isAgentEnabled,
} from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_PLANNER_ID = 'Ezra (planner)';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'all',
  model: ctx.config.model,
  temperature: 0.2,
  permission: setupAgentPermissions(
    AGENT_PLANNER_ID,
    {
      edit: {
        '*': 'deny',
        '.agent/plans/*.md': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Creates structured implementation plans from requirements or specs. Use when: starting a new feature, breaking down complex work, or need ordered task lists with acceptance criteria. Outputs PLAN.md files.',
});

export const setupPlannerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_PLANNER_ID] = defu(
    ctx.config.agent?.[AGENT_PLANNER_ID] ?? {},
    getDefaults(ctx),
  );
};

export const setupPlannerAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_PLANNER_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_PLANNER_ID, ctx);
  const hasExplorer = isAgentEnabled(AGENT_EXPLORER_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are an implementation planner. You create actionable plans from specs or requirements and save them to \`.agent/plans/\`.
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
      ${Protocol.contextGathering(AGENT_PLANNER_ID, ctx)}
      ${Protocol.escalation(AGENT_PLANNER_ID, ctx)}
    </protocols>

    <capabilities>
      - Create structured implementation plans with ordered tasks
      - Analyze dependencies and identify critical paths
      - Define testable acceptance criteria
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      2. **Check for spec** in \`.agent/specs/\` - use as authoritative design source
      3. **Assess scope** - goal, boundaries, complexity (Low/Medium/High)
      4. **Analyze dependencies** - what must exist first, critical path, parallelization
      5. **Identify risks** - what could go wrong, external dependencies
      6. **Break down tasks** - each completable in one sitting with clear criteria
      7. **Save plan** to \`.agent/plans/<feature-name>.md\`
    </instructions>

    <plan_format>
      \`\`\`markdown
      # Plan: [Feature Name]

      **Version**: 1.0
      **Last Updated**: [ISO timestamp]
      **Last Agent**: planner
      **Status**: Draft
      **Complexity**: Low | Medium | High
      **Tasks**: [N]

      ## Overview
      [1-2 sentences]

      ## Tasks

      ### Phase 1: [Name]

      #### 1.1 [Task Name]
      **File**: \`path/to/file.ts\`
      [What to do]

      **Done when**:
      - [ ] [Criterion 1]
      - [ ] [Criterion 2]

      ## Testing
      - [ ] [Test 1]

      ## Risks
      | Risk | Mitigation |
      | ---- | ---------- |
      | [Risk] | [How to handle] |
      \`\`\`
    </plan_format>

    <constraints>
      - Every task MUST have a file path
      - Every task MUST have "Done when" criteria that are testable
      - Tasks must be atomic - completable in one session
      - Dependencies must be ordered - blocking tasks come first
      - Do NOT contradict architect's spec decisions
      - Do NOT plan implementation details - describe WHAT, not HOW
      - Do NOT create mega-tasks - split if > 1 session
      - Verify file paths exist via context${Prompt.when(
        hasExplorer,
        ' or delegate to explorer',
      )}
    </constraints>
  `;
};
