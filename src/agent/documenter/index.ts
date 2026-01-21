import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_DOCUMENTER_ID = 'documenter';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.2,
  permission: setupAgentPermissions(
    AGENT_DOCUMENTER_ID,
    {
      edit: {
        '**/*.md': 'allow',
        'README*': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Documentation writer. Creates and updates docs. Scope: file/module/project.',
  prompt: PROMPT,
});

export const setupDocumenterAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_DOCUMENTER_ID] = defu(
    ctx.config.agent?.[AGENT_DOCUMENTER_ID] ?? {},
    getDefaults(ctx),
  );
};
