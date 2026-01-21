import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { MCP_CHROME_DEVTOOLS_ID } from '~/mcp/chrome-devtools.ts';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_TESTER_ID = 'tester';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',
  hidden: false,
  model: ctx.config.small_model,
  temperature: 0.2,
  permission: setupAgentPermissions(
    AGENT_TESTER_ID,
    {
      edit: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
      [`${MCP_CHROME_DEVTOOLS_ID}*`]: 'allow',
    },
    ctx,
  ),
  description:
    'Test specialist. Runs tests, analyzes failures, suggests fixes. Modes: run/analyze/suggest.',
  prompt: PROMPT,
});

export const setupTesterAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_TESTER_ID] = defu(
    ctx.config.agent?.[AGENT_TESTER_ID] ?? {},
    getDefaults(ctx),
  );
};
