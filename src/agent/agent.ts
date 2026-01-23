import type { AgentConfig } from '@opencode-ai/sdk/v2';
import defu from 'defu';
import { ConfigContext } from '~/context';
import {
  cleanupPermissions,
  getGlobalPermissions,
  hasPermission,
} from '~/permission/util';
import { taskToolSet } from '~/task/tool';
import { getEnabledAgents, hasSubAgents } from './util';

export type ElishaAgentOptions = {
  id: string;
  capabilities: Array<string>;
  config:
    | AgentConfig
    | ((self: ElishaAgent) => AgentConfig | Promise<AgentConfig>);
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
};

export const defineAgent = ({
  config: agentConfig,
  prompt,
  ...options
}: ElishaAgentOptions): ElishaAgent => {
  return {
    ...options,
    async setupConfig() {
      if (typeof agentConfig === 'function') {
        agentConfig = await agentConfig(this);
      }

      const config = ConfigContext.use();

      const permissions = agentConfig.permission;
      if (permissions) {
        agentConfig.permission = cleanupPermissions(
          defu(
            config.agent?.[this.id]?.permission ?? {},
            permissions,
            getGlobalPermissions(),
          ),
        );
      }

      config.agent ??= {};
      config.agent[this.id] = defu(config.agent?.[this.id] ?? {}, agentConfig);
    },
    async setupPrompt() {
      const config = ConfigContext.use();

      const agentConfig = config.agent?.[this.id];
      // Skip if agent is disabled or prompt is already set
      if (!agentConfig || agentConfig.disable || agentConfig.prompt) {
        return;
      }

      if (typeof prompt === 'function') {
        prompt = await prompt(this);
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
      const exactPermission = permissions[permissionPattern];
      if (exactPermission) {
        return hasPermission(exactPermission);
      }

      const basePattern = permissionPattern.replace(/\*$/, '');
      for (const [key, value] of Object.entries(permissions)) {
        const baseKey = key.replace(/\*$/, '');
        if (basePattern.startsWith(baseKey)) {
          return hasPermission(value);
        }
      }
      return true;
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

      // Must have permission to use task tools
      return (
        this.hasPermission(`${taskToolSet.id}*`) || this.hasPermission(`task`)
      );
    },
  };
};
