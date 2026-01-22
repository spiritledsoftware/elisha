import type { ElishaConfigContext } from '~/types';
import type { McpConfig } from './types';

export const getEnabledMcps = (
  ctx: ElishaConfigContext,
): Array<McpConfig & { name: string }> => {
  const mcps = ctx.config.mcp ?? {};
  return Object.entries(mcps)
    .filter(([_, config]) => config?.enabled ?? true)
    .map(([name, config]) => ({
      name,
      ...config,
    }));
};

export const isMcpEnabled = (
  mcpName: string,
  ctx: ElishaConfigContext,
): boolean => {
  const mcps = ctx.config.mcp ?? {};
  const config = mcps[mcpName];
  return config?.enabled ?? true;
};
