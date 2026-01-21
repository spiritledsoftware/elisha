import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
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
    'Implementation specialist. Reads plans, writes code, updates status. Modes: step/phase/full.',
  prompt: PROMPT,
});

export const setupExecutorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXECUTOR_ID] = defu(
    ctx.config.agent?.[AGENT_EXECUTOR_ID] ?? {},
    getDefaults(ctx),
  );
};
