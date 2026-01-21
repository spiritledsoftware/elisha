import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_REVIEWER_ID = 'reviewer';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'all',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.2,
  permission: setupAgentPermissions(
    AGENT_REVIEWER_ID,
    {
      edit: {
        '.agent/reviews/*.md': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    "Reviews code changes for bugs, security issues, and style violations. Use when: validating implementation quality, checking for regressions, or before merging changes. Scope: quick (obvious issues), standard (comprehensive), thorough (security-focused). READ-ONLY - identifies issues, doesn't fix them.",
  prompt: PROMPT,
});

export const setupReviewerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_REVIEWER_ID] = defu(
    ctx.config.agent?.[AGENT_REVIEWER_ID] ?? {},
    getDefaults(ctx),
  );
};
