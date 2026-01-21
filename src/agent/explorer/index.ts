import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
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
    },
    ctx,
  ),
  description:
    'Codebase search specialist. Finds files, searches code, maps structure. Specify thoroughness: "quick" (1 search), "medium" (2-3 searches), "thorough" (4-6 searches). Returns file paths with line numbers and brief context. READ-ONLY.',
  prompt: PROMPT,
});

export const setupExplorerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_EXPLORER_ID] = defu(
    ctx.config.agent?.[AGENT_EXPLORER_ID] ?? {},
    getDefaults(ctx),
  );
};
