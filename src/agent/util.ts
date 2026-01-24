import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { ConfigContext, PluginContext } from '~/context';

export const disableAgent = (name: string) => {
  const config = ConfigContext.use();
  config.agent ??= {};
  config.agent[name] = defu(config.agent?.[name] ?? {}, {
    disable: true,
  });
};

export const changeAgentModel = (name: string, model: string | undefined) => {
  const config = ConfigContext.use();
  config.agent ??= {};
  config.agent[name] = defu(config.agent?.[name] ?? {}, {
    model,
  }) as AgentConfig;
};

export async function getActiveAgents() {
  const { client, directory } = PluginContext.use();

  return await client.app
    .agents({ query: { directory } })
    .then(({ data = [] }) => data);
}

/**
 * Gets enabled agents from config, filtering out disabled ones.
 */
export function getEnabledAgents(): Array<AgentConfig & { id: string }> {
  const { agent = {} } = ConfigContext.use();

  return Object.entries(agent)
    .filter(([_, config]) => config?.disable !== true)
    .map(([id, config]) => ({
      id,
      ...config,
    }));
}

/**
 * Gets enabled agents that are suitable for delegation (have descriptions).
 */
export function getSubAgents(): Array<AgentConfig & { id: string }> {
  return getEnabledAgents().filter(
    (agent) => agent.mode !== 'primary' && Boolean(agent.description),
  );
}

/**
 * Checks if there are any agents available for delegation.
 */
export function hasSubAgents(): boolean {
  return getSubAgents().length > 0;
}

export function formatAgentsList(): string {
  const delegatableAgents = getSubAgents();
  if (delegatableAgents.length === 0) {
    return '';
  }
  return delegatableAgents
    .map((agent) => `- **${agent.id}**: ${agent.description}`)
    .join('\n');
}
