import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import { expandProtocols } from '../util/protocol/index.ts';

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
      'chrome-devtools*': 'deny',
    },
    ctx,
  ),
  description:
    'Creative ideation specialist. Generates diverse ideas, explores unconventional approaches, and brainstorms solutions. Specify mode: "divergent" (maximize variety), "convergent" (refine ideas), "wild" (no constraints). IDEATION-ONLY, no implementation.',
  prompt: expandProtocols(PROMPT),
});

export const setupBrainstormerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_BRAINSTORMER_ID] = defu(
    ctx.config.agent?.[AGENT_BRAINSTORMER_ID] ?? {},
    getDefaults(ctx),
  );
};
