import type { PluginInput } from '@opencode-ai/plugin';
import type { AgentConfig } from '@opencode-ai/sdk/v2';
import { agentHasPermission } from '~/permission/agent/util.ts';
import { TOOL_TASK_ID } from '~/task/tool.ts';
import type { ElishaConfigContext } from '../../types.ts';

// Re-export MCP utilities for convenience
export { getEnabledMcps, isMcpEnabled } from '../../mcp/util.ts';

/**
 * Checks if an MCP is both enabled and allowed for a specific agent.
 *
 * @param mcpName - The MCP ID (e.g., 'chrome-devtools', 'openmemory')
 * @param agentName - The agent ID to check permissions for
 * @param ctx - The Elisha config context
 * @returns true if the MCP is enabled and not denied for the agent
 */
export const isMcpAvailableForAgent = (
  mcpName: string,
  agentName: string,
  ctx: ElishaConfigContext,
): boolean => {
  // Check if MCP is enabled
  const mcpConfig = ctx.config.mcp?.[mcpName];
  const isEnabled = mcpConfig?.enabled ?? true;
  if (!isEnabled) return false;

  // Check if agent has permission to use it
  return agentHasPermission(`${mcpName}*`, agentName, ctx);
};

export const getActiveAgents = async (ctx: PluginInput) => {
  return await ctx.client.app
    .agents({ query: { directory: ctx.directory } })
    .then(({ data = [] }) => data);
};

export const getSessionAgentAndModel = async (
  sessionID: string,
  ctx: PluginInput,
) => {
  return await ctx.client.session
    .messages({
      path: { id: sessionID },
      query: { directory: ctx.directory, limit: 50 },
    })
    .then(({ data = [] }) => {
      for (const msg of data) {
        if ('model' in msg.info && msg.info.model) {
          return { model: msg.info.model, agent: msg.info.agent };
        }
      }
      return { model: undefined, agent: undefined };
    });
};

/**
 * Gets enabled agents from config, filtering out disabled ones.
 */
export const getEnabledAgents = (
  ctx: ElishaConfigContext,
): Array<AgentConfig & { name: string }> => {
  const agents = ctx.config.agent ?? {};
  return Object.entries(agents)
    .filter(([_, config]) => config?.disable !== true)
    .map(([name, config]) => ({
      name,
      ...config,
    }));
};

/**
 * Gets enabled agents that are suitable for delegation (have descriptions).
 */
export const getSubAgents = (
  ctx: ElishaConfigContext,
): Array<AgentConfig & { name: string }> => {
  return getEnabledAgents(ctx).filter(
    (agent) => agent.mode !== 'primary' && Boolean(agent.description),
  );
};

/**
 * Checks if there are any agents available for delegation.
 */
export const hasSubAgents = (ctx: ElishaConfigContext): boolean => {
  return getSubAgents(ctx).length > 0;
};

/**
 * Checks if an agent can delegate to other agents.
 * Requires both: agents available AND permission to use task tools.
 */
export const canAgentDelegate = (
  agentId: string,
  ctx: ElishaConfigContext,
): boolean => {
  // Must have agents to delegate to
  if (!hasSubAgents(ctx)) return false;

  // Must have permission to use task tools
  return (
    agentHasPermission(`${TOOL_TASK_ID}*`, agentId, ctx) ||
    agentHasPermission(`task`, agentId, ctx)
  );
};

export const isAgentEnabled = (
  agentName: string,
  ctx: ElishaConfigContext,
): boolean => {
  return getEnabledAgents(ctx).some((agent) => agent.name === agentName);
};

export const formatAgentsList = (ctx: ElishaConfigContext): string => {
  const delegatableAgents = getSubAgents(ctx);
  if (delegatableAgents.length === 0) {
    return '';
  }
  return delegatableAgents
    .map((agent) => `- **${agent.name}**: ${agent.description}`)
    .join('\n');
};
