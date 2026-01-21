import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { TOOL_TASK_ID } from '~/task/tool.ts';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_EXPLORER_ID = 'explorer';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',
  hidden: false,
  model: ctx.config.small_model,
  temperature: 0.7,
  permission: setupAgentPermissions(
    AGENT_EXPLORER_ID,
    {
      edit: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
      [`${TOOL_TASK_ID}*`]: 'deny', // Leaf node
    },
    ctx,
  ),
  description:
    "Searches and navigates the codebase to find files, patterns, and structure. Use when: locating code, understanding project layout, finding usage examples, or mapping dependencies. Thoroughness: quick (known locations), medium (pattern search), thorough (exhaustive mapping). READ-ONLY - finds and reports, doesn't modify.",
  prompt: PROMPT,
});

export const setupExplorerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXPLORER_ID] = defu(
    ctx.config.agent?.[AGENT_EXPLORER_ID] ?? {},
    getDefaults(ctx),
  );
};
