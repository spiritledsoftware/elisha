import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import PROMPT from './prompt.md';

export const AGENT_ORCHESTRATOR_ID = 'orchestrator';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  mode: 'primary',
  hidden: false,
  model: ctx.config.model,
  temperature: 0.4,
  permission: setupAgentPermissions(
    AGENT_ORCHESTRATOR_ID,
    {
      edit: 'deny',
    },
    ctx,
  ),
  description:
    'Coordinates complex multi-step tasks requiring multiple specialists. Delegates to appropriate agents, synthesizes their outputs, and manages workflow dependencies. Use when: task spans multiple domains, requires parallel work, or needs result aggregation. NEVER writes code or reads files directly.',
  prompt: PROMPT,
});

export const setupOrchestratorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ORCHESTRATOR_ID] = defu(
    ctx.config.agent?.[AGENT_ORCHESTRATOR_ID] ?? {},
    getDefaults(ctx),
  );
};
