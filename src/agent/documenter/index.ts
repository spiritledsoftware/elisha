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
    'Creates and maintains documentation including READMEs, API references, and architecture docs. Use when: documenting new features, updating outdated docs, creating onboarding guides, or writing inline code comments. Scope: file (single file), module (directory), project (full codebase). Matches existing doc style.',
  prompt: PROMPT,
});

export const setupDocumenterAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_DOCUMENTER_ID] = defu(
    ctx.config.agent?.[AGENT_DOCUMENTER_ID] ?? {},
    getDefaults(ctx),
  );
};
