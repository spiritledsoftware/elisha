import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_ARCHITECT_ID = 'architect';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'subagent',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.5,
  permission: setupAgentPermissions(
    AGENT_ARCHITECT_ID,
    {
      edit: {
        '.agent/specs/*.md': 'allow',
      },
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Expert consultant for debugging blockers and designing solutions. Use when: stuck on a problem, need architectural guidance, designing new systems, or evaluating tradeoffs between approaches. Modes: consult (get unstuck), design (create specs). ADVISORY-ONLY - produces recommendations, not code.',
  prompt: PROMPT,
});

export const setupArchitectAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ARCHITECT_ID] = defu(
    ctx.config.agent?.[AGENT_ARCHITECT_ID] ?? {},
    getDefaults(ctx),
  );
};
