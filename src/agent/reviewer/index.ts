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
    'Code reviewer. Analyzes diffs for issues. Delegates to explorer (context) and researcher (best practices). Specify scope: "quick" (obvious issues), "standard" (full review), "thorough" (deep analysis). READ-ONLY.',
  prompt: PROMPT,
});

export const setupReviewerAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_REVIEWER_ID] = defu(
    ctx.config.agent?.[AGENT_REVIEWER_ID] ?? {},
    getDefaults(ctx),
  );
};
