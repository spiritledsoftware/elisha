import { ConfigContext } from '~/context';
import type { McpConfig } from './types';

export const getEnabledMcps = (): Array<McpConfig & { id: string }> => {
  const config = ConfigContext.use();

  const mcps = config.mcp ?? {};
  return Object.entries(mcps)
    .filter(([_, config]) => config?.enabled ?? true)
    .map(([id, config]) => ({
      id,
      ...config,
    }));
};
