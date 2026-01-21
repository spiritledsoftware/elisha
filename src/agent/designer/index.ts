import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { MCP_CHROME_DEVTOOLS_ID } from '~/mcp/chrome-devtools.ts';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../util/index.ts';
import { expandProtocols } from '../util/protocol/index.ts';

import PROMPT from './prompt.md';

export const AGENT_DESIGNER_ID = 'designer';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'all',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.7,
  permission: setupAgentPermissions(
    AGENT_DESIGNER_ID,
    {
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
      [`${MCP_CHROME_DEVTOOLS_ID}*`]: 'allow',
    },
    ctx,
  ),
  description:
    'UI/UX implementation specialist. Writes CSS, component styling, layouts, and motion code. Uses chrome-devtools to inspect and verify visual results. Follows bold aesthetic philosophy—no generic AI look.',
  prompt: expandProtocols(PROMPT),
});

export const setupDesignerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_DESIGNER_ID] = defu(
    ctx.config.agent?.[AGENT_DESIGNER_ID] ?? {},
    getDefaults(ctx),
  );
};
