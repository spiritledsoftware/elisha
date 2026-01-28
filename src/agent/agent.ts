import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { ConfigContext } from '~/context';
import {
  taskBroadcastsReadTool,
  taskBroadcastTool,
  taskCreateTool,
  taskSendMessageTool,
} from '~/features/tools/tasks';
import {
  cleanupPermissions,
  getGlobalPermissions,
  hasPermission,
  isPatternMatch,
} from '~/permission/utils';
import { getEnabledAgents, hasSubAgents } from './utils';

export type ElishaAgentOptions = {
  id: string;
  config: AgentConfig | ((self: ElishaAgent) => AgentConfig | Promise<AgentConfig>);
  prompt: string | ((self: ElishaAgent) => string | Promise<string>);
};

export type ElishaAgent = Omit<ElishaAgentOptions, 'config' | 'prompt'> & {
  setupConfig: () => Promise<void>;
  setupPrompt: () => Promise<void>;
  isEnabled: boolean;
  permissions: AgentConfig['permission'];
  hasPermission: (permissionPattern: string) => boolean;
  hasMcp: (mcpName: string) => boolean;
  canDelegate: boolean;
  canCommunicate: boolean;
};

export const defineAgent = ({
  config: agentConfig,
  prompt,
  ...options
}: ElishaAgentOptions): ElishaAgent => {
  const agent: ElishaAgent = {
    ...options,
    async setupConfig() {
      if (typeof agentConfig === 'function') {
        agentConfig = await agentConfig(this);
      }

      const config = ConfigContext.use();

      const permissions = agentConfig.permission;
      if (permissions) {
        agentConfig.permission = cleanupPermissions(
          defu(config.agent?.[this.id]?.permission ?? {}, permissions, getGlobalPermissions()),
        );
      }

      config.agent ??= {};
      config.agent[this.id] = defu(config.agent?.[this.id] ?? {}, agentConfig);
    },
    async setupPrompt() {
      const config = ConfigContext.use();

      const agentConfig = config.agent?.[this.id];
      // Skip if agent is disabled
      if (!agentConfig || agentConfig.disable) {
        return;
      }

      if (agentConfig.prompt) {
        agentConfig.prompt = agentConfig.prompt + agentConfig.prompt_append;
        return;
      }

      if (typeof prompt === 'function') {
        prompt = await prompt(this);
      }

      if (agentConfig.prompt_prepend) {
        prompt = `${agentConfig.prompt_prepend}\n${prompt}`;
      }
      if (agentConfig.prompt_append) {
        prompt = `${prompt}\n${agentConfig.prompt_append}`;
      }

      agentConfig.prompt = prompt;
    },
    get isEnabled() {
      return getEnabledAgents().some((agent) => agent.id === this.id);
    },
    get permissions() {
      const config = ConfigContext.use();
      return config.agent?.[this.id]?.permission ?? {};
    },
    hasPermission(permissionPattern: string): boolean {
      const permissions = this.permissions;
      if (!permissions) {
        return true;
      }
      if (typeof permissions === 'string') {
        return permissions !== 'deny';
      }

      const patterns = permissionPattern.split(':');
      const toolPattern = patterns[0] ?? '';

      // Last-match-wins: iterate through all keys and track the last matching result
      let lastMatchResult: boolean | undefined;

      for (const [key, value] of Object.entries(permissions)) {
        // Check if the permission key matches the requested tool pattern
        // e.g., key="edit*" should match toolPattern="edit" or "editFile"
        if (isPatternMatch(key, toolPattern)) {
          lastMatchResult = hasPermission(value, patterns.slice(1));
        }
      }

      return lastMatchResult ?? true;
    },
    hasMcp(mcpName: string): boolean {
      const { mcp = {} } = ConfigContext.use();

      if (mcp[mcpName]?.enabled === false) return false;

      // Check if agent has permission to use it
      return this.hasPermission(`${mcpName}*`);
    },
    get canDelegate(): boolean {
      // Must have agents to delegate to
      if (!hasSubAgents()) return false;

      return this.hasPermission(taskCreateTool.id) || this.hasPermission('task');
    },
    get canCommunicate(): boolean {
      return (
        this.hasPermission(taskBroadcastTool.id) &&
        this.hasPermission(taskBroadcastsReadTool.id) &&
        this.hasPermission(taskSendMessageTool.id)
      );
    },
  };
  return agent;
};
