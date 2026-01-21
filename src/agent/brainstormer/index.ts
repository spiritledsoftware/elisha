import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_BRAINSTORMER_ID = 'brainstormer';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'all',
  hidden: false,
  model: ctx.config.model,
  temperature: 1.2,
  permission: setupAgentPermissions(
    AGENT_BRAINSTORMER_ID,
    {
      edit: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Creative ideation specialist. Generates diverse ideas, explores unconventional approaches. Modes: divergent/convergent/wild. IDEATION-ONLY.',
  prompt: PROMPT,
});

export const setupBrainstormerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_BRAINSTORMER_ID] = defu(
    ctx.config.agent?.[AGENT_BRAINSTORMER_ID] ?? {},
    getDefaults(ctx),
  );
};
