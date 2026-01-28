import defu from 'defu';
import { ConfigContext } from '~/context';
import type { McpConfig } from './types';

export type ElishaMcpOptions = {
  id: string;
  capabilities: Array<string>;
  config: McpConfig | ((self: ElishaMcp) => McpConfig | Promise<McpConfig>);
};

export type ElishaMcp = Omit<ElishaMcpOptions, 'config'> & {
  setup: () => Promise<void>;
  isEnabled: boolean;
};

export const defineMcp = ({ config: mcpConfig, ...input }: ElishaMcpOptions): ElishaMcp => {
  return {
    ...input,
    async setup() {
      if (typeof mcpConfig === 'function') {
        mcpConfig = await mcpConfig(this);
      }

      const config = ConfigContext.use();

      config.mcp ??= {};
      config.mcp[input.id] = defu(config.mcp?.[input.id] ?? {}, mcpConfig) as McpConfig;
    },
    get isEnabled() {
      const config = ConfigContext.use();
      const mcps = config.mcp ?? {};
      const mcpConfig = mcps[this.id];
      return mcpConfig?.enabled ?? true;
    },
  };
};
