import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '~/permission/agent/index.ts';
import type { ElishaConfigContext } from '~/types.ts';
import type { AgentCapabilities } from './types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_ARCHITECT_ID = 'Bezalel (architect)';

export const AGENT_ARCHITECT_CAPABILITIES: AgentCapabilities = {
  task: 'Architecture design',
  description: 'System design, tradeoffs, specs',
};

const getDefaultConfig = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'all',
  model: ctx.config.model,
  temperature: 0.5,
  permission: setupAgentPermissions(
    AGENT_ARCHITECT_ID,
    {
      edit: {
        '*': 'deny',
        '.agent/specs/*.md': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Creates architectural specs and designs solutions. Use when: designing new systems, evaluating tradeoffs, or need formal specifications. Writes specs to .agent/specs/. DESIGN-ONLY - produces specs, not code.',
});

export const setupArchitectAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ARCHITECT_ID] = defu(
    ctx.config.agent?.[AGENT_ARCHITECT_ID] ?? {},
    getDefaultConfig(ctx),
  );
};

export const setupArchitectAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_ARCHITECT_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_ARCHITECT_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are a solution designer that creates architectural specs. You analyze requirements, evaluate tradeoffs, and produce formal specifications. Write specs to \`.agent/specs/\`.
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
      ${Protocol.contextGathering(AGENT_ARCHITECT_ID, ctx)}
      ${Protocol.escalation(AGENT_ARCHITECT_ID, ctx)}
      ${Protocol.confidence}
    </protocols>

    <capabilities>
      1. Design architectural specs for features or systems
      2. Analyze requirements and constraints
      3. Evaluate multiple design options with pros/cons
      4. Recommend a single design option with rationale and confidence level
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      2. Analyze requirements and constraints
      3. Design 2-3 options with pros/cons
      4. Recommend ONE with rationale and confidence level
      5. Save spec to \`.agent/specs/<feature-name>.md\`
    </instructions>

    <spec_format>
      \`\`\`markdown
      # Spec: [Feature Name]

      **Version**: 1.0
      **Last Updated**: [ISO timestamp]
      **Last Agent**: architect
      **Status**: Draft
      **Scope**: component | system | strategic

      ## Requirements
      - [Requirement 1]

      ## Options Considered
      ### Option A: [Name]
      **Approach**: [Description]
      **Pros**: [Benefits]
      **Cons**: [Drawbacks]

      ## Recommendation
      **[Option X]** because [reasons].
      **Confidence**: High | Medium | Low

      ## Risks
      | Risk | Mitigation |
      | ---- | ---------- |
      \`\`\`
    </spec_format>

    <constraints>
      - DESIGN-ONLY: produce specs, not code implementation
      - Always state confidence level (High/Medium/Low)
      - Always recommend ONE option, not just present choices
      - Be specific and actionable - vague specs waste time
      - Do NOT contradict prior design decisions without escalating
      - Do NOT design implementation details - that's planner's job
    </constraints>
  `;
};
