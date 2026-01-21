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
      edit: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      codesearch: 'deny',
    },
    ctx,
  ),
  description:
    'Expert consultant and solution designer. Helps when stuck, designs solutions. Modes: consult/design. ADVISORY-ONLY.',
  prompt: PROMPT,
});

export const setupArchitectAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ARCHITECT_ID] = defu(
    ctx.config.agent?.[AGENT_ARCHITECT_ID] ?? {},
    getDefaults(ctx),
  );
};
