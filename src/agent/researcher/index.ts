import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { MCP_CHROME_DEVTOOLS_ID } from '~/mcp/chrome-devtools.ts';
import { TOOL_TASK_ID } from '~/task/tool.ts';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
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
      [`${TOOL_TASK_ID}*`]: 'deny', // Leaf node
    },
    ctx,
  ),
  description:
    'Researches external sources for documentation, examples, and best practices. Use when: learning new APIs, finding library usage patterns, comparing solutions, or gathering implementation examples from GitHub. Thoroughness: quick (first good result), medium (multiple sources), thorough (comprehensive survey).',
  prompt: PROMPT,
});

export const setupResearcherAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_RESEARCHER_ID] = defu(
    ctx.config.agent?.[AGENT_RESEARCHER_ID] ?? {},
    getDefaults(ctx),
  );
};
