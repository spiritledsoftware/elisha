import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import { expandVariables } from '../util/index.ts';
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
    'Expert consultant and solution designer. Call when stuck on bugs, complex problems, or need architecture guidance. Analyzes problems, suggests debugging strategies, recommends solutions. Delegates to explorer (codebase) and researcher (research). Modes: "consult" (debugging/problem-solving), "design" (architecture). ADVISORY-ONLY, no code.',
  prompt: expandVariables(PROMPT, ctx),
});

export const setupArchitectAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ARCHITECT_ID] = defu(
    ctx.config.agent?.[AGENT_ARCHITECT_ID] ?? {},
    getDefaults(ctx),
  );
};
