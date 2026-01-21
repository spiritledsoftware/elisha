import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import { expandVariables } from '../util/index.ts';
import PROMPT from './prompt.md';

export const AGENT_EXECUTOR_ID = 'executor';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'all',
  hidden: false,
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
    'Implementation executor. Reads plans from `.agent/plans/` (or specs from `.agent/specs/`), writes code, updates plan status. Delegates to explorer (find patterns) and researcher (API docs) when stuck. Specify mode: "step" (one task), "phase" (one phase), "full" (entire plan).',
  prompt: expandVariables(PROMPT, ctx),
});

export const setupExecutorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXECUTOR_ID] = defu(
    ctx.config.agent?.[AGENT_EXECUTOR_ID] ?? {},
    getDefaults(ctx),
  );
};
