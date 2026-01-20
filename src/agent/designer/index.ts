import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../util/index.ts';
import { expandProtocols } from '../util/protocol/index.ts';

import PROMPT from './prompt.md';

export const AGENT_DESIGNER_ID = 'designer';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.7,
  permission: setupAgentPermissions(
    AGENT_DESIGNER_ID,
    {
      edit: 'deny',
      bash: 'deny',
      webfetch: 'allow',
      websearch: 'allow',
      codesearch: 'allow',
      'chrome-devtools*': 'deny',
    },
    ctx,
  ),
  description:
    'Frontend/UX design specialist. Creates visual design specifications: typography, color palettes, layout systems, motion design, component styling. Scope: component/page/system. DESIGN-ONLY, no code.',
  prompt: expandProtocols(PROMPT),
});

export const setupDesignerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_DESIGNER_ID] = defu(
    ctx.config.agent?.[AGENT_DESIGNER_ID] ?? {},
    getDefaults(ctx),
  );
};
