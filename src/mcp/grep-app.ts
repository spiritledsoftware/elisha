import defu from 'defu';
import type { ElishaConfigContext } from '../types.ts';
import type { McpConfig } from './types.ts';

export const MCP_GREP_APP_ID = 'grep-app';

export const getDefaultConfig = (_ctx: ElishaConfigContext): McpConfig => ({
  enabled: true,
  type: 'remote',
  url: 'https://mcp.grep.app',
});

export const setupGrepAppMcpConfig = (ctx: ElishaConfigContext) => {
  ctx.config.mcp ??= {};
  ctx.config.mcp[MCP_GREP_APP_ID] = defu(
    ctx.config.mcp?.[MCP_GREP_APP_ID] ?? {},
    getDefaultConfig(ctx),
  ) as McpConfig;
};
