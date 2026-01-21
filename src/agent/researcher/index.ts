import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { MCP_CHROME_DEVTOOLS_ID } from '~/mcp/chrome-devtools.ts';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import { expandProtocols } from '../util/protocol/index.ts';

import PROMPT from './prompt.md';

export const AGENT_RESEARCHER_ID = 'researcher';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',
  hidden: false,
  model: ctx.config.small_model,
  temperature: 0.7,
  permission: setupAgentPermissions(
    AGENT_RESEARCHER_ID,
    {
      edit: 'deny',
      webfetch: 'allow',
      websearch: 'allow',
      codesearch: 'allow',
      [`${MCP_CHROME_DEVTOOLS_ID}*`]: 'allow',
    },
    ctx,
  ),
  description:
    'External research specialist. Finds library docs, API examples, GitHub code patterns. Specify thoroughness: "quick" (1-2 queries), "medium" (3-4 queries), "thorough" (5+ queries). Returns synthesized findings with sources. No local codebase access.',
  prompt: expandProtocols(PROMPT),
});

export const setupResearcherAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_RESEARCHER_ID] = defu(
    ctx.config.agent?.[AGENT_RESEARCHER_ID] ?? {},
    getDefaults(ctx),
  );
};
