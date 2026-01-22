import type { PluginInput } from '@opencode-ai/plugin';
import type { AgentConfig } from '@opencode-ai/sdk/v2';
import { agentHasPermission } from '~/permission/agent/util.ts';
import { TOOL_TASK_ID } from '~/task/tool.ts';
import type { ElishaConfigContext } from '../../types.ts';
import {
  AGENT_ARCHITECT_CAPABILITIES,
  AGENT_ARCHITECT_ID,
} from '../architect.ts';
import {
  AGENT_BRAINSTORMER_CAPABILITIES,
  AGENT_BRAINSTORMER_ID,
} from '../brainstormer.ts';
import {
  AGENT_CONSULTANT_CAPABILITIES,
  AGENT_CONSULTANT_ID,
} from '../consultant.ts';
import { AGENT_DESIGNER_CAPABILITIES, AGENT_DESIGNER_ID } from '../designer.ts';
import {
  AGENT_DOCUMENTER_CAPABILITIES,
  AGENT_DOCUMENTER_ID,
} from '../documenter.ts';
import { AGENT_EXECUTOR_CAPABILITIES, AGENT_EXECUTOR_ID } from '../executor.ts';
import { AGENT_EXPLORER_CAPABILITIES, AGENT_EXPLORER_ID } from '../explorer.ts';
import { AGENT_PLANNER_CAPABILITIES, AGENT_PLANNER_ID } from '../planner.ts';
import {
  AGENT_RESEARCHER_CAPABILITIES,
  AGENT_RESEARCHER_ID,
} from '../researcher.ts';
import { AGENT_REVIEWER_CAPABILITIES, AGENT_REVIEWER_ID } from '../reviewer.ts';
import type { AgentCapabilities } from '../types.ts';

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

/**
 * Agent capability definitions for task matching.
 * Built from individual agent capability exports for easier maintenance.
 */
const AGENT_CAPABILITIES: Record<string, AgentCapabilities> = {
  [AGENT_EXPLORER_ID]: AGENT_EXPLORER_CAPABILITIES,
  [AGENT_RESEARCHER_ID]: AGENT_RESEARCHER_CAPABILITIES,
  [AGENT_ARCHITECT_ID]: AGENT_ARCHITECT_CAPABILITIES,
  [AGENT_PLANNER_ID]: AGENT_PLANNER_CAPABILITIES,
  [AGENT_EXECUTOR_ID]: AGENT_EXECUTOR_CAPABILITIES,
  [AGENT_REVIEWER_ID]: AGENT_REVIEWER_CAPABILITIES,
  [AGENT_DESIGNER_ID]: AGENT_DESIGNER_CAPABILITIES,
  [AGENT_DOCUMENTER_ID]: AGENT_DOCUMENTER_CAPABILITIES,
  [AGENT_BRAINSTORMER_ID]: AGENT_BRAINSTORMER_CAPABILITIES,
  [AGENT_CONSULTANT_ID]: AGENT_CONSULTANT_CAPABILITIES,
};

/**
 * Formats a task matching table showing only enabled agents.
 * Used by orchestrator for task delegation guidance.
 */
export const formatTaskMatchingTable = (ctx: ElishaConfigContext): string => {
  const enabledAgents = getEnabledAgents(ctx);
  const rows: string[] = [];

  for (const agent of enabledAgents) {
    const cap = AGENT_CAPABILITIES[agent.name];
    if (cap) {
      rows.push(`| ${cap.task} | ${agent.name} | ${cap.description} |`);
    }
  }

  if (rows.length === 0) {
    return '';
  }

  return [
    '| Task Type | Specialist | When to Use |',
    '|-----------|------------|-------------|',
    ...rows,
  ].join('\n');
};

/**
 * Formats a simplified task assignment guide showing only enabled agents.
 * Used by planner for task assignment guidance.
 */
export const formatTaskAssignmentGuide = (ctx: ElishaConfigContext): string => {
  const enabledAgents = getEnabledAgents(ctx);
  const rows: string[] = [];

  for (const agent of enabledAgents) {
    const cap = AGENT_CAPABILITIES[agent.name];
    if (cap) {
      rows.push(`| ${cap.task} | ${agent.name} | ${cap.description} |`);
    }
  }

  if (rows.length === 0) {
    return '';
  }

  return [
    '| Task Type | Assign To | Notes |',
    '|-----------|-----------|-------|',
    ...rows,
  ].join('\n');
};
