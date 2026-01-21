import type { PluginInput } from '@opencode-ai/plugin';
import type { ElishaConfigContext } from '../../types.ts';
import { expandProtocols } from './protocol/index.ts';

const MAX_DESCRIPTION_LENGTH = 80;

export const getActiveAgents = async (ctx: PluginInput) => {
  return await ctx.client.app
    .agents({ query: { directory: ctx.directory } })
    .then(({ data = [] }) => data);
};

export const getSessionModelAndAgent = async (
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
 * Truncates a description to the max length, adding ellipsis if needed.
 */
const truncateDescription = (description: string): string => {
  if (description.length <= MAX_DESCRIPTION_LENGTH) {
    return description;
  }
  return `${description.slice(0, MAX_DESCRIPTION_LENGTH - 3)}...`;
};

/**
 * Gets enabled agents from config, filtering out disabled ones.
 */
const getEnabledAgentsFromConfig = (
  ctx: ElishaConfigContext,
): Array<{ name: string; description: string }> => {
  const agents = ctx.config.agent ?? {};
  return Object.entries(agents)
    .filter(([_, config]) => config?.disable !== true)
    .map(([name, config]) => ({
      name,
      description: config?.description ?? '',
    }))
    .filter((agent) => agent.description) // Only include agents with descriptions
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Formats agents as a markdown table.
 */
const formatAgentsTable = (
  agents: Array<{ name: string; description: string }>,
): string => {
  if (agents.length === 0) {
    return '*No agents available*';
  }

  const lines = ['| Agent | Description |', '|-------|-------------|'];
  for (const agent of agents) {
    lines.push(`| ${agent.name} | ${truncateDescription(agent.description)} |`);
  }
  return lines.join('\n');
};

/**
 * Formats agents as a markdown bullet list.
 */
const formatAgentsList = (
  agents: Array<{ name: string; description: string }>,
): string => {
  if (agents.length === 0) {
    return '*No agents available*';
  }

  return agents
    .map(
      (agent) =>
        `- **${agent.name}**: ${truncateDescription(agent.description)}`,
    )
    .join('\n');
};

/**
 * Expands agent references in a prompt string.
 * Replaces {{agents}}, {{agents:table}}, or {{agents:list}} with formatted agent info.
 */
const expandAgents = (template: string, ctx: ElishaConfigContext): string => {
  const agents = getEnabledAgentsFromConfig(ctx);

  return template
    .replace(/\{\{agents:table\}\}/g, () => formatAgentsTable(agents))
    .replace(/\{\{agents:list\}\}/g, () => formatAgentsList(agents))
    .replace(/\{\{agents\}\}/g, () => formatAgentsTable(agents));
};

/**
 * Expands all variable references in a prompt string.
 * - Protocol references: {{protocol:name}}
 * - Agent references: {{agents}}, {{agents:table}}, {{agents:list}}
 */
const expandVariables = (
  template: string,
  ctx: ElishaConfigContext,
): string => {
  let result = template;

  result = expandProtocols(result);
  result = expandAgents(result, ctx);

  return result;
};

/**
 * Expands prompts for all registered agents.
 * Call this AFTER all agents have been set up to ensure {{agents}} references
 * see all agents, not just those registered before them.
 */
export const expandAgentPrompts = (ctx: ElishaConfigContext): void => {
  ctx.config.agent ??= {};
  for (const [_, config] of Object.entries(ctx.config.agent)) {
    if (config?.prompt && typeof config.prompt === 'string') {
      config.prompt = expandVariables(config.prompt, ctx);
    }
  }
};
