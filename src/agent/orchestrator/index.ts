import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../../permission/agent.ts';
import type { ElishaConfigContext } from '../../types.ts';
import { expandProtocols } from '../util/protocol/index.ts';

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
      webfetch: 'ask',
      websearch: 'deny',
      codesearch: 'deny',
      'chrome-devtools*': 'deny',
    },
    ctx,
  ),
  description:
    'Task coordinator. Delegates all work to specialized agents: explorer (search), researcher (research), architect (design), planner (plans), executor (code). Never touches code directly. Use for complex multi-step tasks or when unsure which agent to use.',
  prompt: expandProtocols(PROMPT),
});

export const setupOrchestratorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ORCHESTRATOR_ID] = defu(
    ctx.config.agent?.[AGENT_ORCHESTRATOR_ID] ?? {},
    getDefaults(ctx),
  );
};
