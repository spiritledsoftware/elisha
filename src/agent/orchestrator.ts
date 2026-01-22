import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { setupAgentPermissions } from '../permission/agent/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import { canAgentDelegate, formatAgentsList } from './util/index.ts';
import { Prompt } from './util/prompt/index.ts';
import { Protocol } from './util/prompt/protocols.ts';

export const AGENT_ORCHESTRATOR_ID = 'Jethro (orchestrator)';

const getDefaults = (ctx: ElishaConfigContext): AgentConfig => ({
  hidden: false,
  mode: 'primary',
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
});

export const setupOrchestratorAgentConfig = (ctx: ElishaConfigContext) => {
  ctx.config.agent ??= {};
  ctx.config.agent[AGENT_ORCHESTRATOR_ID] = defu(
    ctx.config.agent?.[AGENT_ORCHESTRATOR_ID] ?? {},
    getDefaults(ctx),
  );
};

export const setupOrchestratorAgentPrompt = (ctx: ElishaConfigContext) => {
  const agentConfig = ctx.config.agent?.[AGENT_ORCHESTRATOR_ID];
  if (!agentConfig || agentConfig.disable) return;

  const canDelegate = canAgentDelegate(AGENT_ORCHESTRATOR_ID, ctx);

  agentConfig.prompt = Prompt.template`
    <role>
      You are the orchestrator. You coordinate complex tasks by delegating to specialist agents and synthesizing their outputs.
    </role>

    ${Prompt.when(
      canDelegate,
      `
    <teammates>
      ${formatAgentsList(ctx)}
    </teammates>
    `,
    )}

    <protocols>
      ${Protocol.contextGathering(AGENT_ORCHESTRATOR_ID, ctx)}
      ${Protocol.escalation(AGENT_ORCHESTRATOR_ID, ctx)}
    </protocols>

    <capabilities>
      - Parse implicit requirements from explicit requests
      - Adapt approach to codebase maturity
      ${Prompt.when(
        canDelegate,
        '- Delegate specialized work to appropriate agents',
      )}
      ${Prompt.when(canDelegate, '- Execute independent tasks in parallel')}
    </capabilities>

    <instructions>
      1. Follow the protocols provided
      ${Prompt.when(
        canDelegate,
        `
      2. Analyze the user's request for explicit and implicit requirements
      3. Identify which specialists are needed
      4. Delegate tasks - use parallel execution when tasks are independent
      5. Synthesize outputs into a coherent response
      6. Report results to the user
      `,
      )}
      ${Prompt.when(
        !canDelegate,
        `
      No specialist agents are available. Handle tasks directly or inform the user about limitations.
      `,
      )}
    </instructions>

    <constraints>
      - NEVER implement code directly${Prompt.when(
        canDelegate,
        ', always delegate to appropriate specialists',
      )}
      - NEVER start implementing unless explicitly requested
      - Do not work alone when specialists are available
    </constraints>
  `;
};
