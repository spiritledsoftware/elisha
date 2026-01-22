import defu from 'defu';
import { log } from '~/util/index.ts';
import type { ElishaConfigContext } from '../types.ts';
import type { McpConfig } from './types.ts';

export const MCP_EXA_ID = 'exa';

export const getDefaultConfig = (_ctx: ElishaConfigContext): McpConfig => ({
  enabled: true,
  type: 'remote',
  url: 'https://mcp.exa.ai/mcp?tools=web_search_exa,deep_search_exa',
  headers: process.env.EXA_API_KEY
    ? { 'x-api-key': process.env.EXA_API_KEY }
    : undefined,
});

export const setupExaMcpConfig = (ctx: ElishaConfigContext) => {
  if (!process.env.EXA_API_KEY) {
    log(
      {
        level: 'warn',
        message:
          '[Elisha] EXA_API_KEY not set - Exa search will use public rate limits',
      },
      ctx,
    );
  }
  ctx.config.mcp ??= {};
  ctx.config.mcp[MCP_EXA_ID] = defu(
    ctx.config.mcp?.[MCP_EXA_ID] ?? {},
    getDefaultConfig(ctx),
  ) as McpConfig;
};
