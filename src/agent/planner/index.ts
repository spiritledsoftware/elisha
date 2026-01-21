import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_PLANNER_ID = 'planner';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'all',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.2,
  permission: setupAgentPermissions(
    AGENT_PLANNER_ID,
    {
      edit: {
        '.agent/plans/*.md': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Creates structured implementation plans from requirements or specs. Use when: starting a new feature, breaking down complex work, or need ordered task lists with acceptance criteria. Detail: outline (quick overview), detailed (full breakdown with edge cases). Outputs PLAN.md files.',
  prompt: PROMPT,
});

export const setupPlannerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_PLANNER_ID] = defu(
    ctx.config.agent?.[AGENT_PLANNER_ID] ?? {},
    getDefaults(ctx),
  );
};
