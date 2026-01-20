import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import { expandProtocols } from '../util/protocol/index.ts';

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
        '.agent/specs/*.md': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
      'chrome-devtools*': 'deny',
    },
    ctx,
  ),
  description:
    'Implementation planner. Creates step-by-step plans in `.agent/plans/` and specs in `.agent/specs/`. Delegates to explorer (file locations), researcher (API details), architect (design decisions). Specify detail: "outline" (5-10 steps), "detailed" (15-30 tasks), "spec" (formal with acceptance criteria).',
  prompt: expandProtocols(PROMPT),
});

export const setupPlannerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_PLANNER_ID] = defu(
    ctx.config.agent?.[AGENT_PLANNER_ID] ?? {},
    getDefaults(ctx),
  );
};
